"use client";
import {apiFetch,readApiJson} from "@/lib/api-client";
import {useEffect,useRef,useState} from "react";
import {CheckCircle2,ExternalLink,Loader2,RefreshCw,Send} from "lucide-react";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {teams as builtInTeams,getTeam as findTeam,panels,themeLabel,sameDesign,type Team,type Draft,type TemplateConfig} from "@/lib/catalog";
import {renderPanel} from "@/lib/panel-renderer";
import {sameSize} from "@/lib/jersey-sizes";
import type {JerseyCatalog,Transfer,PrintArea} from "@/lib/printify-transfer-types";
async function response<T>(r:Response):Promise<T>{const data=await readApiJson(r) as T&{error?:string};if(!r.ok)throw new Error(data.error||"The transfer request could not finish.");return data;}
const post=(body:unknown)=>apiFetch("/api/printify/drafts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(r=>response<{transfer:Transfer}>(r));
function PanelPreview({area,team,config}:{area:PrintArea;team:Team;config:TemplateConfig}){
 const ref=useRef<HTMLCanvasElement>(null);const [error,setError]=useState(false);
 useEffect(()=>{let cancelled=false;setError(false);const canvas=document.createElement("canvas");renderPanel(canvas,area.panel,team,config,true,false,area).then(()=>{if(!cancelled&&ref.current){ref.current.width=canvas.width;ref.current.height=canvas.height;ref.current.getContext("2d")?.drawImage(canvas,0,0);}canvas.width=1;canvas.height=1;}).catch(()=>{if(!cancelled)setError(true);});return()=>{cancelled=true;};},[area,team,config]);
 return <figure>{error?<p role="alert">Panel preview unavailable</p>:<canvas ref={ref} aria-label={area.panel+" print panel"}/>}<figcaption>{panels.find(p=>p.id===area.panel)?.name}<small>{area.width} × {area.height} px</small></figcaption></figure>;
}
export default function PrintifyDraftSender(){
 const [teams,setTeams]=useState<Team[]>(builtInTeams);const getTeam=(id:string)=>findTeam(id,teams);
 const [draftId,setDraftId]=useState("");
 const [teamId,setTeamId]=useState("dayton-eagles"),[drafts,setDrafts]=useState<Draft[]>([]),[catalog,setCatalog]=useState<JerseyCatalog|null>(null),[variantId,setVariantId]=useState(""),[price,setPrice]=useState("49.99");
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(""),[progress,setProgress]=useState(""),[transfer,setTransfer]=useState<Transfer|null>(null);
 const lock=useRef(false),selectedTeam=useRef(teamId);selectedTeam.current=teamId;
 const saved=drafts.find(d=>d.teamId===teamId&&(!draftId||d.id===draftId)),variant=catalog?.variants.find(v=>String(v.id)===variantId);
 async function load(){setLoading(true);setError("");try{const [studio,provider]=await Promise.all([apiFetch("/api/studio",{cache:"no-store"}).then(r=>response<{drafts:Draft[];teams:Team[]}>(r)),apiFetch("/api/printify/catalog",{cache:"no-store"}).then(r=>response<JerseyCatalog>(r))]);setTeams(studio.teams);const requested=new URLSearchParams(window.location.search).get("team");if(loading&&requested&&studio.teams.some(t=>t.id===requested))setTeamId(requested);setDrafts(studio.drafts);setCatalog(provider);setVariantId(String((provider.variants.find(v=>sameSize(v.size,(new URLSearchParams(window.location.search).get("size")??"L")))??(new URLSearchParams(window.location.search).has("size")?null:provider.variants[0]))?.id??""));}catch(e){setError((e as Error).message);}finally{setLoading(false);}}
 const currentSaved=useRef(saved);currentSaved.current=saved;
 async function loadTransfer(id=selectedTeam.current){const expected=currentSaved.current;const r=await apiFetch("/api/printify/drafts?teamId="+encodeURIComponent(id),{cache:"no-store"});const data=await response<{transfer:Transfer|null}>(r);if(selectedTeam.current===id&&currentSaved.current===expected)setTransfer(data.transfer&&expected&&sameDesign(data.transfer.snapshot.config,expected.config)?data.transfer:null);}
 useEffect(()=>{const params=new URLSearchParams(window.location.search);const team=params.get("team");setDraftId(params.get("draft")??"");if(team&&teams.some(t=>t.id===team))setTeamId(team);load();},[]);
 useEffect(()=>{setTransfer(null);loadTransfer(teamId).catch(e=>setError((e as Error).message));},[teamId,saved]);
 useEffect(()=>{if(!busy)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};window.addEventListener("beforeunload",warn);return()=>window.removeEventListener("beforeunload",warn);},[busy]);
 async function send(){
  if(lock.current||!variant||!saved)return;
  const cents=Math.round(Number(price)*100);if(!Number.isFinite(cents)||cents<100||cents>100000){setError("Enter a draft price between $1 and $1,000.");return;}
  lock.current=true;setBusy(true);setError("");setProgress("Checking saved design and provider…");
  try{
   let active:Transfer=(await post({action:"prepare",teamId,variantId:variant.id,price:cents,draftId:saved.id})).transfer;setTransfer(active);
   if(active.status==="created"){setProgress("This exact draft is already in Printify.");return;}
   if(active.status!=="preparing")throw new Error("This draft may already be in Printify. Use Check Printify status before sending again.");
   for(const area of active.snapshot.variant.areas){
    if(active.uploaded.includes(area.panel))continue;
    setProgress("Preparing "+panels.find(p=>p.id===area.panel)?.name.toLowerCase()+"…");
    const canvas=document.createElement("canvas");let blob:Blob;
    try{await renderPanel(canvas,area.panel,(active.snapshot.team??getTeam(active.snapshot.teamId)),active.snapshot.config,false,false,area);blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Could not render the panel.")),"image/png"));}
    finally{canvas.width=1;canvas.height=1;}
    if(blob.size>20*1024*1024)throw new Error("This panel exceeds the 20 MB transfer limit. Your saved design is still available.");
    setProgress("Uploading "+panels.find(p=>p.id===area.panel)?.name.toLowerCase()+"…");
    const result:{transfer:Transfer}=await response<{transfer:Transfer}>(await apiFetch("/api/printify/panel?id="+active.id+"&panel="+area.panel,{method:"POST",headers:{"Content-Type":"image/png"},body:blob}));active=result.transfer;setTransfer(active);
   }
   setProgress("Creating your draft in Printify…");active=(await post({action:"create",id:active.id})).transfer;setTransfer(active);setProgress("Draft created in Printify. Review its mockups below.");
  }catch(e){setError((e as Error).message);setProgress("");try{await loadTransfer(teamId);}catch{}}
  finally{lock.current=false;setBusy(false);}
 }
 async function recheck(){if(!transfer||lock.current)return;lock.current=true;setBusy(true);setError("");setProgress("Checking Printify…");try{const data=await post({action:"recheck",id:transfer.id});setTransfer(data.transfer);setProgress(data.transfer.status==="created"?"Printify draft confirmed.":"Ready to resume the panel upload.");}catch(e){setError((e as Error).message);setProgress("");}finally{lock.current=false;setBusy(false);}}
 return <><p className="eyebrow">MERCH STUDIO / PRINTIFY</p><h1>Send your team jersey.</h1><p className="connection-intro">Send a saved design as a Printify draft for review. To order with your exact artwork and size, use Prepare my jerseys & checkout from your bag.</p>
 {loading?<p role="status" className="loading-line"><Loader2 className="spin" size={20}/>Checking the current jersey and print provider…</p>:<div className="transfer-layout"><section className="setup-card transfer-controls"><h2>Saved team design</h2><label htmlFor="send-team">Team</label><Select value={teamId} onValueChange={id=>{setTeamId(id);setDraftId("");}} disabled={busy}><SelectTrigger id="send-team"><SelectValue/></SelectTrigger><SelectContent>{teams.map(t=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
 <label htmlFor="send-design">Jersey design</label><select id="send-design" value={saved?.id??""} disabled={busy} onChange={e=>setDraftId(e.target.value)}>{!saved&&<option value="">Choose a saved design</option>}{drafts.filter(d=>d.teamId===teamId).map(d=><option key={d.id} value={d.id}>{themeLabel(d.config)} · {d.config.frontLogoLabel} · {d.id.startsWith("selection:")?"Custom selection":"Team template"} · {new Date(d.updatedAt).toLocaleString()}</option>)}</select>
 {saved?<p className="saved-design">Saved {new Date(saved.updatedAt).toLocaleString()}</p>:<p className="connection-error">Save this team's template in Merch Studio first.</p>}
 {catalog&&<><div className="transfer-provider"><strong>{catalog.blueprint.title}</strong><span>{catalog.provider.title}</span></div><label htmlFor="send-size">Size for this draft</label><Select value={variantId} onValueChange={setVariantId} disabled={busy}><SelectTrigger id="send-size"><SelectValue/></SelectTrigger><SelectContent>{catalog.variants.map(v=><SelectItem key={v.id} value={String(v.id)}>{v.title}</SelectItem>)}</SelectContent></Select></>}
 {catalog&&!variant&&<p className="connection-error" role="alert">The requested size is unavailable. Choose an available size above; your selection has not been substituted.</p>}
 <label htmlFor="draft-price">Draft selling price (USD)</label><input id="draft-price" type="number" min="1" max="1000" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} disabled={busy}/><p className="fine-print">Editable in Printify before publishing. No payment is collected by sending a draft.</p>
 <button className="primary-button full" disabled={busy||!catalog||!saved||!variant||transfer?.status==="creating"||transfer?.status==="uncertain"} onClick={send}>{busy?<Loader2 className="spin" size={17}/>:<Send size={17}/>} {busy?"Transfer in progress…":"Send to Printify draft"}</button><button className="text-link" disabled={busy} onClick={load}>Refresh saved design and provider</button><a className="text-link" href={"/?tab=studio&team="+teamId+"&theme="+encodeURIComponent(saved?.config.jerseyTheme??"light")}>Edit this team’s artwork</a><a className="text-link" href="/connect#printify">Printify connection settings</a>
 </section><section className="setup-card transfer-artwork"><h2>Five print panels</h2><p>Rendered from your saved colors and artwork to the selected provider's print dimensions.</p>{saved&&variant?<div className="transfer-panel-grid">{variant.areas.map(a=><PanelPreview key={a.panel} area={a} team={getTeam(teamId)} config={saved.config}/>)}</div>:<p>Choose an available saved design and size to see its panels.</p>}</section></div>}
 {error&&<div role="alert" className="connection-error">{error}{!catalog&&!loading&&<button className="text-link" onClick={load}>Retry provider check</button>}</div>}
 {progress&&<p role="status" className="transfer-progress">{progress}</p>}
 {transfer&&<section className="setup-card transfer-status"><h2>{transfer.status==="created"?"Draft created in Printify":"Saved transfer"}</h2><p>{(transfer.snapshot.team??getTeam(transfer.snapshot.teamId)).name} · {themeLabel(transfer.snapshot.config)} · {transfer.snapshot.config.frontLogoLabel||"Team crest"} · {transfer.snapshot.variant.title} · ${(transfer.snapshot.price/100).toFixed(2)}</p><ul className="transfer-checks">{panels.map(p=><li key={p.id}>{transfer.uploaded.includes(p.id)?<CheckCircle2 size={17}/>:<span className="pending-panel"/>}{p.name}{transfer.uploaded.includes(p.id)?" uploaded":" pending"}</li>)}</ul><div className="transfer-actions"><button className="secondary-button" disabled={busy} onClick={recheck}><RefreshCw size={17}/>{transfer.status==="created"?"Refresh Printify mockups":"Check Printify status"}</button><a className="secondary-button" href="https://printify.com/app/store/products" target="_blank" rel="noreferrer">Open Printify My Products <ExternalLink size={17}/></a></div>
 {transfer.product&&<><p><strong>{transfer.product.title}</strong></p>{transfer.product.images.length?<div className="printify-mockups">{transfer.product.images.map((image,i)=><figure key={image.src+String(i)}><img src={image.src} alt={image.position+" Printify mockup"}/><figcaption>{image.position}</figcaption></figure>)}</div>:<p>Printify is preparing the mockups. Refresh them in a moment or open My Products.</p>}<p className="fine-print">Check front, back, both sleeves, collar and seam alignment in Printify before publishing.</p></>}
 </section>}</>;
}
