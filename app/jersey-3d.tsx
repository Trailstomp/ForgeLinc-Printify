"use client";
import {useEffect,useRef,useState,type ReactNode} from "react";
import {Rotate3D,ZoomIn,ZoomOut,Pause,Play} from "lucide-react";
import {panels,type Team,type TemplateConfig,type PanelId} from "@/lib/catalog";
import {renderPanel} from "@/lib/panel-renderer";
import type {createJerseyView,JerseyAngle} from "@/lib/jersey-3d-view";
export default function Jersey3D({team,config,pending,unavailable,fallback,autoRotate=false,hero=false}:{team:Team;config:TemplateConfig;pending:boolean;unavailable:boolean;fallback:ReactNode;autoRotate?:boolean;hero?:boolean}){
 const [spinning,setSpinning]=useState(autoRotate);
 useEffect(()=>{const preference=window.matchMedia("(prefers-reduced-motion: reduce)");const sync=()=>{if(preference.matches)setSpinning(false);};sync();preference.addEventListener("change",sync);return()=>preference.removeEventListener("change",sync);},[]);
 const host=useRef<HTMLDivElement>(null),runtime=useRef<ReturnType<typeof createJerseyView>|null>(null);
 const [ready,setReady]=useState(0),[retry,setRetry]=useState(0),[error,setError]=useState(""),[painting,setPainting]=useState(true);
 useEffect(()=>{let cancelled=false;setError("");setPainting(true);
  import("@/lib/jersey-3d-view").then(({createJerseyView})=>{if(cancelled||!host.current)return;runtime.current=createJerseyView(host.current,()=>{setError("3D is unavailable. Showing your front and back views.");});setReady(v=>v+1);}).catch(()=>{if(!cancelled)setError("3D is unavailable in this browser. Showing front and back views.");});
  return()=>{cancelled=true;runtime.current?.dispose();runtime.current=null;};
 },[retry]);
 useEffect(()=>{if(!ready||pending||unavailable||error)return;let cancelled=false;setPainting(true);
  // Coalesce rapid sliders and drags before repainting the five shared print textures.
  const timer=setTimeout(()=>{const textures={} as Record<PanelId,HTMLCanvasElement>;Promise.all(panels.map(async p=>{const canvas=document.createElement("canvas");await renderPanel(canvas,p.id,team,config,"texture",false);textures[p.id]=canvas;})).then(()=>{if(cancelled||!runtime.current)return;runtime.current.update(textures);setPainting(false);}).catch(()=>{if(!cancelled)setError("The 3D artwork could not load. Showing your flat previews.");});},90);
  return()=>{cancelled=true;clearTimeout(timer);};
 },[team,config,ready,pending,unavailable,error]);
 const busy=pending||painting||!ready;
 useEffect(()=>{runtime.current?.setAutoRotate(autoRotate&&spinning&&!busy&&!unavailable&&!error);},[autoRotate,spinning,busy,unavailable,error,ready]);
 const view=(angle:JerseyAngle)=>runtime.current?.view(angle);
 return <section className={"jersey-3d"+(hero?" jersey-3d-hero":"")}><div className="jersey-3d-stage" ref={host} hidden={!!error} aria-busy={busy||unavailable}>{(busy||unavailable)&&<div className="jersey-3d-status" role="status">{unavailable?"Saved design unavailable":pending?"Loading your design…":"Updating 3D jersey…"}</div>}</div>{error?<><p role="alert" className="fine-print">{error}</p>{fallback}<button type="button" className="secondary-button full" onClick={()=>setRetry(v=>v+1)}>Try 3D again</button></>:<><p className="jersey-3d-hint"><Rotate3D size={17}/>Drag to rotate · scroll or pinch to zoom</p><div className="jersey-3d-views" role="group" aria-label="Jersey viewing angle">{(["front","back","left","right"] as const).map(angle=><button type="button" key={angle} disabled={busy||unavailable} onClick={()=>view(angle)}>{angle[0].toUpperCase()+angle.slice(1)}</button>)}</div><div className="jersey-3d-zoom"><button type="button" disabled={busy||unavailable} aria-label="Zoom out" onClick={()=>runtime.current?.zoom(1.15)}><ZoomOut size={18}/></button>{autoRotate?<button type="button" className="jersey-auto-spin" aria-pressed={spinning} disabled={busy||unavailable} onClick={()=>setSpinning(v=>!v)}>{spinning?<Pause size={16}/>:<Play size={16}/>} {spinning?"Pause spin":"Auto spin"}</button>:<span>360° view</span>}<button type="button" disabled={busy||unavailable} aria-label="Zoom in" onClick={()=>runtime.current?.zoom(.87)}><ZoomIn size={18}/></button></div></>}<p className="fine-print">3D placement preview. Check final fit and seams in Printify.</p></section>;
}
