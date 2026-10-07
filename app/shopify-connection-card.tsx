"use client";
import {apiFetch,readApiJson} from "@/lib/api-client";
import {useEffect,useRef,useState} from "react";
import {CheckCircle2,Loader2,LockKeyhole,RefreshCw} from "lucide-react";
import type {ShopifySummary} from "@/lib/shopify-connection";
type State={configured:boolean;secureStorageReady:boolean;clientId:string;domain:string;lastVerified:ShopifySummary|null};
export default function ShopifyConnectionCard(){
 const [state,setState]=useState<State|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const secret=useRef<HTMLInputElement>(null);
 async function load(){setLoading(true);setError("");try{const r=await apiFetch("/api/connections/shopify",{cache:"no-store"});const data=await readApiJson(r) as State&{error?:string};if(!r.ok)throw new Error(data.error||"Could not load the connection.");setState(data);}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 useEffect(()=>{load();},[]);
 async function submit(action:"connect"|"verify"){
  if(busy)return;setBusy(true);setError("");setMessage("");
  const payload=action==="connect"?{action,clientSecret:secret.current?.value??""}:{action};
  // Secrets are never saved in browser storage or placed in a URL.
  if(secret.current)secret.current.value="";
  try{const r=await apiFetch("/api/connections/shopify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const data=await readApiJson(r) as {configured:boolean;lastVerified:ShopifySummary;error?:string};if(!r.ok)throw new Error(data.error||"Could not verify Shopify.");setState(previous=>previous?{...previous,...data}:previous);setMessage("Shopify verified. ForgeLinc can read your store’s products.");}
  catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 return <section className="setup-card shopify-connection-card"><span className="step-number">01</span><h2>Connect Shopify</h2><p>Link your installed ForgeLinc app to your LincWerks products.</p>
 {loading?<p role="status" className="loading-line"><Loader2 size={18} className="spin"/>Loading connection…</p>:state&&<>
 <label htmlFor="connection-domain">Shopify store</label><input id="connection-domain" value={state.domain} readOnly/>
 <label htmlFor="connection-client">ForgeLinc Client ID</label><input id="connection-client" value={state.clientId} readOnly className="client-id"/>
 {state.configured&&<div className="verified-connection"><CheckCircle2 size={19}/><div><strong>{state.lastVerified?.name||"Shopify"} — saved connection</strong><small>Last verified {state.lastVerified&&new Date(state.lastVerified.checkedAt).toLocaleString()}</small></div></div>}
 {!state.secureStorageReady&&<p className="connection-error" role="alert">Secure storage is unavailable. Please try again later.</p>}
 <form onSubmit={e=>{e.preventDefault();submit("connect");}}>
 <label htmlFor="shopify-client-secret">{state.configured?"Replace Client secret":"Client secret"}</label>
 <input id="shopify-client-secret" ref={secret} type="password" autoComplete="off" spellCheck={false} autoCapitalize="none" placeholder={state.configured?"Enter only to replace the saved secret":"Paste from Shopify → ForgeLinc → App settings"} minLength={16} maxLength={4096} required disabled={busy||!state.secureStorageReady}/>
 <p className="secret-note"><LockKeyhole size={15}/>Sent to Shopify to authorize this app, then stored encrypted on the server. The saved secret is never displayed.</p>
 <button type="submit" className="primary-button full" disabled={busy||!state.secureStorageReady}>{busy?<Loader2 size={17} className="spin"/>:<LockKeyhole size={17}/>} {busy?"Checking Shopify…":state.configured?"Replace & verify":"Connect & verify Shopify"}</button>
 </form>
 {state.configured&&<button className="secondary-button full" disabled={busy||!state.secureStorageReady} onClick={()=>submit("verify")}><RefreshCw size={16}/>Recheck saved connection</button>}
 {state.lastVerified&&<div className="verified-products"><h3>Products found at the last check</h3>{state.lastVerified.products.length?<ul>{state.lastVerified.products.map(p=><li key={p.id}><span>{p.title}</span><small>{p.status.toLowerCase()}</small></li>)}</ul>:<p>Shopify responded successfully. No products were returned.</p>}<small>Shows up to five products. Verification does not change products or submit orders.</small></div>}
 </>}
 {error&&<div role="alert" className="connection-error">{error}{!state&&<button className="text-link" onClick={load}>Retry</button>}</div>}
 {message&&<p role="status" className="connection-success">{message}</p>}
 </section>;
}
