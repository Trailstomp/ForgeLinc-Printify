"use client";
import {apiFetch,readApiJson} from "@/lib/api-client";
import {useEffect,useRef,useState} from "react";
import {CheckCircle2,ExternalLink,Loader2,LockKeyhole,RefreshCw} from "lucide-react";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import type {PrintifyShop,PrintifySummary} from "@/lib/printify-connection";
type State={configured:boolean;secureStorageReady:boolean;lastVerified:PrintifySummary|null};
export default function PrintifyConnectionCard(){
 const [state,setState]=useState<State|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const [shops,setShops]=useState<PrintifyShop[]|null>(null),[shopId,setShopId]=useState("");
 const token=useRef<HTMLInputElement>(null);
 async function load(){setLoading(true);setError("");try{const r=await apiFetch("/api/connections/printify",{cache:"no-store"});const data=await readApiJson(r) as State&{error?:string};if(!r.ok)throw new Error(data.error||"Could not load Printify.");setState(data);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 async function submit(action:"discover"|"connect"|"verify"){
  if(busy)return;setBusy(true);setError("");setMessage("");
  const payload=action==="verify"?{action}:{action,token:token.current?.value??"",shopId:Number(shopId)};
  // Discovery keeps the token only in the password field until a store is selected.
  // Never place it in React state, local storage, URLs, or returned API data.
  if(action==="connect"&&token.current)token.current.value="";
  try{const r=await apiFetch("/api/connections/printify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await readApiJson(r) as {error?:string;shops?:PrintifyShop[];configured?:boolean;lastVerified?:PrintifySummary};if(!r.ok)throw new Error(data.error||"Could not verify Printify.");
   if(action==="discover"){
    if(!Array.isArray(data.shops))throw new Error("Printify returned an incomplete store list. Please retry.");const found=data.shops;setShops(found);setShopId("");
    if(!found.length)setMessage("Printify accepted your token but returned no stores. Open Printify and check your store connections.");
   }else{const summary=data.lastVerified;if(!data.configured||!summary)throw new Error("Printify verification was incomplete. Please retry.");setState(previous=>previous?{...previous,configured:true,lastVerified:summary}:previous);setShops(null);setShopId("");setMessage("Printify connected. Store and product access verified.");}
  }catch(e){setError((e as Error).message);if(action!=="verify"){setShops(null);setShopId("");}}
  finally{setBusy(false);}
 }
 return <section id="printify" className="setup-card printify-connection-card"><span className="step-number">02</span><h2>Connect Printify</h2><p>Select the LincWerks store you already connected to Shopify.</p>
 {loading?<p role="status" className="loading-line"><Loader2 size={18} className="spin"/>Loading Printify connection…</p>:state&&<>
 {state.configured&&<div className="verified-connection"><CheckCircle2 size={19}/><div><strong>{state.lastVerified?.shop.title||"Printify"} — saved connection</strong><small>Store #{state.lastVerified?.shop.id} · {state.lastVerified?.shop.sales_channel}</small><small>Last verified {state.lastVerified&&new Date(state.lastVerified.checkedAt).toLocaleString()}</small></div></div>}
 <a className="text-link" href="https://printify.com/app/account/api" target="_blank" rel="noreferrer">Open Printify token settings <ExternalLink size={14}/></a>
 <p className="token-instructions">Create a personal access token named <strong>ForgeLinc</strong>. Select these permissions for store access, preparing jersey drafts and checking imported orders:</p>
 <ul className="token-scopes"><li>shops.read</li><li>products.read</li><li>products.write</li><li>catalog.read</li><li>uploads.write</li><li>orders.read</li></ul>
 {!state.secureStorageReady&&<p className="connection-error" role="alert">Secure storage is unavailable. Please try again later.</p>}
 <form onSubmit={e=>{e.preventDefault();submit(shops?"connect":"discover");}}>
 <label htmlFor="printify-token">{state.configured?"Replace Printify token":"Printify personal access token"}</label>
 <input id="printify-token" ref={token} type="password" autoComplete="off" spellCheck={false} autoCapitalize="none" minLength={16} maxLength={4096} required placeholder="Paste your token here" disabled={busy||!state.secureStorageReady} onChange={()=>{setShops(null);setShopId("");setMessage("");}}/>
 <p className="secret-note"><LockKeyhole size={15}/>Your token is stored encrypted after the selected store passes verification.</p>
 {shops&&shops.length>0&&<div className="printify-shop-picker"><label htmlFor="printify-shop">Choose your existing Shopify store</label><Select value={shopId} onValueChange={setShopId} disabled={busy}><SelectTrigger id="printify-shop"><SelectValue placeholder="Choose LincWerks"/></SelectTrigger><SelectContent>{shops.map(s=><SelectItem key={s.id} value={String(s.id)} disabled={s.sales_channel.toLowerCase()!=="shopify"}>{s.title} · {s.sales_channel} · #{s.id}</SelectItem>)}</SelectContent></Select><small>Choose the store linked to eewwjf-tt.myshopify.com.</small>{!shops.some(s=>s.sales_channel.toLowerCase()==="shopify")&&<p className="connection-error">No Shopify store was found. Check that this token belongs to the Printify account connected to LincWerks.</p>}</div>}
 <button type="submit" className="primary-button full" disabled={busy||!state.secureStorageReady||!!shops&&!shopId}>{busy?<Loader2 size={17} className="spin"/>:<LockKeyhole size={17}/>} {busy?"Checking Printify…":shops?"Connect selected store":"Find my Printify stores"}</button>
 {shops&&<button type="button" className="text-link" disabled={busy} onClick={()=>{setShops(null);setShopId("");setMessage("");}}>Find stores again</button>}
 </form>
 {state.configured&&<button className="secondary-button full" disabled={busy||!state.secureStorageReady} onClick={()=>submit("verify")}><RefreshCw size={16}/>Recheck saved connection</button>}
 {state.lastVerified&&<div className="verified-products"><a className="primary-button full" href="/send?team=dayton-eagles">Send Dayton Eagles draft</a><h3>Products found at the last check</h3>{state.lastVerified.products.length?<ul>{state.lastVerified.products.map(p=><li key={p.id}>{p.title}</li>)}</ul>:<p>Printify responded successfully. This store has no products yet.</p>}<small>Shows up to five products. Connection checks do not publish products or place orders.</small></div>}
 </>}
 {error&&<div role="alert" className="connection-error">{error}{!state&&<button className="text-link" onClick={load}>Retry</button>}</div>}
 {message&&<p role="status" className="connection-success">{message}</p>}
 </section>;
}
