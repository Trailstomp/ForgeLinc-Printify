"use client";
import {apiFetch,readApiJson,ApiResponseError} from "@/lib/api-client";
import {useEffect,useRef,useState} from "react";
import type {CheckoutItem,CheckoutResult} from "@/lib/checkout-types";
import type {Transfer} from "@/lib/printify-transfer-types";
import {renderCheckoutTransfer} from "@/lib/checkout-render-client";
import {bagFingerprint,readCheckoutAttempt,rememberCheckoutAttempt} from "@/lib/preview-bag";

async function request<T>(body:unknown):Promise<T>{
 const response=await apiFetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
 return readApiJson<T>(response);
}

export default function CheckoutPreview({items,onSaved,onBusyChange}:{items:CheckoutItem[];onSaved?:()=>void;onBusyChange?:(busy:boolean)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [signInRequired,setSignInRequired]=useState(false),[progress,setProgress]=useState("");
 const [result,setResult]=useState<(CheckoutResult&{fingerprint:string})|null>(null);
 const attempt=useRef<{id:string;fingerprint:string}|null>(null),lock=useRef(false);
 const releaseUnloadGuard=useRef<(()=>void)|null>(null),feedback=useRef<HTMLDivElement>(null);
 const clean=items.map(({teamId,size,quantity,config})=>({teamId,size,quantity,config}));
 const fingerprint=bagFingerprint(clean),currentFingerprint=useRef(fingerprint);
 currentFingerprint.current=fingerprint;

 useEffect(()=>{
  if(!busy)return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
  const release=()=>window.removeEventListener("beforeunload",warn);
  releaseUnloadGuard.current=release;
  window.addEventListener("beforeunload",warn);
  return()=>{release();releaseUnloadGuard.current=null;};
 },[busy]);
 useEffect(()=>{if(error)feedback.current?.focus();},[error]);

 async function checkout(){
  if(lock.current)return;
  lock.current=true;setBusy(true);onBusyChange?.(true);
  setError("");setSignInRequired(false);setResult(null);
  setProgress("Saving your exact designs and checking sizes…");
  try{
   if(attempt.current?.fingerprint!==fingerprint){
    const saved=readCheckoutAttempt();
    attempt.current=saved?.fingerprint===fingerprint?saved:{id:crypto.randomUUID(),fingerprint};
   }
   rememberCheckoutAttempt(attempt.current);
   const prepared=await request<{id:string;transfers:Transfer[]}>({action:"prepare",checkout:{id:attempt.current.id,items:clean}});
   for(let i=0;i<prepared.transfers.length;i++){
    await renderCheckoutTransfer(prepared.transfers[i],message=>setProgress(`Jersey ${i+1} of ${prepared.transfers.length}: ${message}`));
   }
   if(currentFingerprint.current!==fingerprint)throw new Error("Your bag changed during preparation. Review your jerseys, then prepare checkout again.");
   setProgress("Verifying your jerseys and preparing payment…");
   const data=await request<CheckoutResult>({action:"checkout",id:prepared.id});
   if(currentFingerprint.current!==fingerprint)throw new Error("Your bag changed during preparation. Review your jerseys, then prepare checkout again.");
   setResult({...data,fingerprint});
   setProgress("Your jerseys are ready. Opening secure checkout…");
   onSaved?.();
   // Upload protection must not block the intentional handoff to payment.
   // Same-tab navigation needs no popup permission after the asynchronous upload.
   releaseUnloadGuard.current?.();
   try{window.location.assign(data.checkoutUrl);}
   catch{setProgress("Your jerseys are ready. Select Continue to secure checkout below.");}
  }catch(e){
   setError(e instanceof Error?e.message:"Checkout could not finish. Your jerseys are still in the bag.");
   setSignInRequired(e instanceof ApiResponseError&&e.signInRequired);setProgress("");
  }finally{
   setBusy(false);onBusyChange?.(false);lock.current=false;
  }
 }

 const quantity=items.reduce((total,item)=>total+item.quantity,0);
 const ready=result?.fingerprint===fingerprint?result:null;
 return <div className="checkout-preview" aria-busy={busy}>
  <p className="checkout-quantity-summary"><strong>{quantity} {quantity===1?"jersey":"jerseys"}</strong></p>
  {error&&<div ref={feedback} role="alert" tabIndex={-1} className="connection-error">
   <p>{error}</p><p>Your jerseys and completed uploads are saved. Retry to continue.</p>
   {signInRequired&&<a className="text-link" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in again</a>}
  </div>}
  {progress&&<p role="status" aria-live="polite">{progress}</p>}
  {ready?<a className="primary-button full" href={ready.checkoutUrl} target="_top">Continue to secure checkout →</a>:
   <button type="button" className="primary-button full" disabled={busy||!items.length} onClick={checkout}>
    {busy?"Preparing your custom jerseys…":error?"Retry checkout":"Prepare my jerseys & checkout"}
   </button>}
  <p className="fine-print">{ready?"Your selected designs, sizes and quantities are ready. Review your order in secure checkout before paying.":"Keep this tab open while your jerseys are prepared. Checkout opens automatically when they are ready."}</p>
  <a className="text-link" href="/connect#checkout">All-team checkout settings</a>
 </div>;
}
