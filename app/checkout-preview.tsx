"use client";
import {useEffect,useRef,useState} from "react";
import type {CheckoutItem,CheckoutResult} from "@/lib/checkout-types";
import type {Transfer} from "@/lib/printify-transfer-types";
import {renderCheckoutTransfer} from "@/lib/checkout-render-client";
async function request<T>(body:unknown):Promise<T>{const r=await fetch("/api/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),data=await r.json() as T&{error?:string};if(!r.ok)throw new Error(data.error||"Could not prepare checkout.");return data;}
export default function CheckoutPreview({items,onSaved}:{items:CheckoutItem[];onSaved?:()=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(""),[progress,setProgress]=useState(""),[result,setResult]=useState<(CheckoutResult&{fingerprint:string})|null>(null),attempt=useRef<{id:string;fingerprint:string}|null>(null),lock=useRef(false);
 const clean=items.map(({teamId,size,quantity,config})=>({teamId,size,quantity,config})),fingerprint=JSON.stringify(clean);
 useEffect(()=>{if(!busy)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[busy]);
 async function checkout(){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");setProgress("Saving your exact designs and checking sizes…");
  try{
   if(attempt.current?.fingerprint!==fingerprint)attempt.current={id:crypto.randomUUID(),fingerprint};
   const prepared=await request<{id:string;transfers:Transfer[]}>({action:"prepare",checkout:{id:attempt.current.id,items:clean}});
   for(let i=0;i<prepared.transfers.length;i++)await renderCheckoutTransfer(prepared.transfers[i],message=>setProgress(`Jersey ${i+1} of ${prepared.transfers.length}: ${message}`));
   setProgress("Verifying your print files and preparing payment…");
   const data=await request<CheckoutResult>({action:"checkout",id:prepared.id});
   setResult({...data,fingerprint});setProgress("Your exact artwork and sizes are attached in Printify.");onSaved?.();
  }catch(e){setError((e as Error).message);setProgress("");}finally{setBusy(false);lock.current=false;}
 }
 const quantity=items.reduce((total,item)=>total+item.quantity,0);
 return <div className="checkout-preview"><p className="checkout-quantity-summary"><strong>{quantity} {quantity===1?"jersey":"jerseys"}</strong></p><button className="primary-button full" disabled={busy||!items.length} onClick={checkout}>{busy?"Preparing your custom jerseys…":"Prepare my jerseys & checkout"}</button>{progress&&<p role="status" aria-live="polite">{progress}</p>}{error&&<p role="alert" className="connection-error">{error}</p>}{result?.fingerprint===fingerprint&&<><p>Each item keeps its selected team, colors, stripes, logos, name, number and size. Printify has the five print panels for each design.</p><a className="secondary-button full" href={result.checkoutUrl} target="_blank" rel="noreferrer">Continue to secure checkout ↗</a></>}<p className="fine-print">Keep this tab open while the print files upload. If you edit the bag, prepare checkout again to use the new design. Paid orders use the saved artwork automatically.</p><a className="text-link" href="/connect#checkout">All-team checkout settings</a></div>;
}
