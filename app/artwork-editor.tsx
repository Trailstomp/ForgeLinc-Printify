"use client";
import {useEffect,useRef,useState,type PointerEvent,type ReactNode} from "react";
import {Trash2} from "lucide-react";
import {artworkPanels,artworkLayer,panels,restoreOriginalArtwork,type ArtworkPanel,type ArtworkLayer,type Team,type TemplateConfig} from "@/lib/catalog";
import {backImageFrame} from "@/lib/back-artwork-layout";
import {backRosterFrame,isWaistRoster} from "@/lib/waist-roster";
import {stripeLayout} from "@/lib/stripe-layout";
import {renderPanel} from "@/lib/panel-renderer";
import {uploadArtwork} from "@/lib/artwork-upload";
import {snapToVerticalCenter} from "@/lib/artwork-alignment";

type Props={team:Team;config:TemplateConfig;onChange:(update:(previous:TemplateConfig)=>TemplateConfig)=>void;disabled:boolean;panel:ArtworkPanel;onPanelChange:(panel:ArtworkPanel)=>void;library?:ReactNode};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
function PanelThumbnail({id,team,config}:{id:ArtworkPanel;team:Team;config:TemplateConfig}){
 const ref=useRef<HTMLCanvasElement>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{let cancelled=false;setFailed(false);const scratch=document.createElement("canvas");
  renderPanel(scratch,id,team,config,true,false).then(()=>{if(cancelled||!ref.current)return;const cv=ref.current;const ratio=Math.min(240/scratch.width,160/scratch.height);cv.width=Math.round(scratch.width*ratio);cv.height=Math.round(scratch.height*ratio);cv.getContext("2d")!.drawImage(scratch,0,0,cv.width,cv.height);}).catch(()=>{if(!cancelled)setFailed(true);});
  return()=>{cancelled=true;};
 },[id,team,config]);
 return failed?<span className="panel-thumbnail-fallback">Preview unavailable</span>:<canvas ref={ref} aria-hidden="true"/>;
}
export default function ArtworkEditor({team,config,onChange,disabled,panel,onPanelChange,library}:Props){
 const [uploading,setUploading]=useState(false),[error,setError]=useState(""),[ready,setReady]=useState(false);
 const [showCenterline,setShowCenterline]=useState(true),[snapEnabled,setSnapEnabled]=useState(true);
 const canvas=useRef<HTMLCanvasElement>(null),input=useRef<HTMLInputElement>(null),alive=useRef(true),drag=useRef<{x:number;y:number;left:number;top:number;snapped:boolean}|null>(null);
 const layer=artworkLayer(config,panel),busy=disabled||uploading,dimensions=panels.find(p=>p.id===panel)!;
 const adaptiveBack=panel==="back"&&!layer.assetId&&config.backBadgePosition==="waist"&&isWaistRoster(team.back);
 const roster=panel==="back"&&!layer.assetId&&team.back.startsWith("/assets/rosters/");
 const bw=dimensions.width*config.backScale*(roster?1.65:1)*layer.scale,bh=bw*(roster?2800/2400:1.5);
 const frame=adaptiveBack?backRosterFrame(config,dimensions.width,dimensions.height):panel==="back"&&config.backBadgePosition!=="bottom"?backImageFrame(config,dimensions.width,dimensions.height,layer.x,layer.y,bw,bh):null;
 const displayLayer={...layer,y:frame?(frame.top+frame.height/2)/dimensions.height:layer.y};
 const centered=layer.visible&&Math.abs(layer.x-.5)<.0001;
 useEffect(()=>{drag.current=null;},[panel,team.id,busy]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{let cancelled=false;setReady(false);setError("");const scratch=document.createElement("canvas");renderPanel(scratch,panel,team,config,true,true).then(()=>{if(cancelled||!canvas.current)return;const cv=canvas.current;cv.width=scratch.width;cv.height=scratch.height;cv.getContext("2d")!.drawImage(scratch,0,0);setReady(true);}).catch(()=>{if(!cancelled)setError("Artwork preview could not load. Try replacing the image again.");});return()=>{cancelled=true;};},[panel,team,config]);
 function update(values:Partial<ArtworkLayer>){onChange(previous=>({...previous,artwork:{...previous.artwork,[panel]:{...artworkLayer(previous,panel),...values}}}));}
 function start(e:PointerEvent<HTMLCanvasElement>){if(busy||!ready||!layer.visible)return;e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,left:layer.x,top:layer.y,snapped:snapEnabled&&centered};}
 function move(e:PointerEvent<HTMLCanvasElement>){if(!drag.current||busy)return;const bounds=e.currentTarget.getBoundingClientRect();if(!bounds.width||!bounds.height)return;const snapped=snapToVerticalCenter(drag.current.left+(e.clientX-drag.current.x)/bounds.width,bounds.width,snapEnabled&&!e.shiftKey,drag.current.snapped);drag.current.snapped=snapped.snapped;update({x:snapped.x,y:clamp(drag.current.top+(e.clientY-drag.current.y)/bounds.height)});}
 async function upload(file:File){setUploading(true);setError("");try{
  const asset=await uploadArtwork(file);
  if(alive.current)onChange(previous=>({...previous,...(panel==="front"?{frontLogoLabel:asset.name.replace(/\.[^.]+$/,"").slice(0,80)||"Custom logo"}:{}),artwork:{...previous.artwork,[panel]:{...artworkLayer(previous,panel),assetId:asset.id,visible:true,...(panel==="left-sleeve"?{caption:false}:{})}}}));
 }catch(e){if(alive.current)setError((e as Error).message);}finally{if(alive.current)setUploading(false);if(input.current)input.current.value="";}}
 const reset=()=>{const original=artworkLayer({...config,artwork:{}},panel);update({x:original.x,y:original.y,scale:1});};
 return <section className="artwork-editor"><div className="canvas-heading"><div><h2>Edit panel artwork</h2><p>Move, resize or replace an image. Save your team template to keep it.</p></div></div>
 <fieldset disabled={busy}><div className="artwork-panel-picker" role="group" aria-label="Choose a panel">{artworkPanels.map(id=><button type="button" key={id} className="artwork-panel-thumbnail" aria-pressed={panel===id} onClick={()=>{drag.current=null;onPanelChange(id);}}><span className="panel-thumbnail-image"><PanelThumbnail id={id} team={team} config={config}/></span><span>{panels.find(p=>p.id===id)!.name}</span></button>)}</div>
 <div className="artwork-editor-layout"><div className="artwork-stage"><div className="artwork-canvas-wrap" style={{width:`min(100%, calc(clamp(280px, 100vh - 370px, 550px) * ${dimensions.width/dimensions.height}))`,marginInline:"auto"}}><canvas ref={canvas} onPointerDown={start} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}} role="img" aria-label={team.name+" "+panel+" artwork placement"}/>{showCenterline&&<div className={"artwork-center-guide"+(centered?" is-aligned":"")} aria-hidden="true"><span>{centered?"Centered":"Center"}</span></div>}{showCenterline&&layer.visible&&<span className={"artwork-center-mark"+(centered?" is-aligned":"")} style={{left:layer.x*100+"%",top:displayLayer.y*100+"%"}} aria-hidden="true"/>}</div><p>{layer.visible?(snapEnabled?"Drag near the centerline to snap. Hold Shift to move freely.":"Drag on the panel to move the artwork, or use the controls."):"Artwork is hidden on this panel."}</p><p>Alignment markers are editor guides only.</p></div>
 <div className="artwork-controls"><label className="check-label"><input type="checkbox" checked={layer.visible} onChange={e=>update({visible:e.target.checked})}/>Show artwork</label>
 <label className="check-label"><input type="checkbox" checked={showCenterline} onChange={e=>setShowCenterline(e.target.checked)}/>Show centerline</label>
 <label className="check-label"><input type="checkbox" checked={snapEnabled} onChange={e=>setSnapEnabled(e.target.checked)}/>Snap to center</label>
 <button type="button" className="secondary-button full center-artwork-button" disabled={!layer.visible} onClick={()=>update({x:.5})}>Center artwork</button>
 {([ ["x","Horizontal",0,1,.005], ["y","Vertical position",0,1,.005], ["scale","Size",.2,3,.01] ] as const).map(([key,label,min,max,step])=><label className="artwork-range" key={key}>{label}<output>{Math.round(displayLayer[key]*100)}%</output><input type="range" aria-label={label} min={min} max={max} step={step} value={displayLayer[key]} onChange={e=>update({[key]:key==="y"?clamp(Number(e.target.value)+layer.y-displayLayer.y):Number(e.target.value)})}/></label>)}
 {panel==="back"&&<p className="fine-print">Adding a back name moves the artwork down and fits it below the name. Clear the name to restore your saved placement.</p>}
 {panel==="left-sleeve"&&<label className="check-label"><input type="checkbox" checked={layer.caption} onChange={e=>update({caption:e.target.checked})}/>“Proud member of…” caption</label>}
 {panel==="back"&&stripeLayout(config)==="bands"&&<p className="fine-print">Back artwork stays in front of the band.</p>}
 {panel==="back"&&stripeLayout(config)!=="bands"&&<label className="check-label"><input type="checkbox" checked={config.backBehindStripes} onChange={e=>{const checked=e.target.checked;onChange(previous=>({...previous,backBehindStripes:checked}));}}/>Place artwork behind stripes</label>}
 <input ref={input} type="file" accept="image/png,image/jpeg" hidden onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);}}/>
 <button type="button" className="primary-button full" onClick={()=>input.current?.click()}>{uploading?"Uploading…":"Replace image"}</button>
 <button type="button" className="secondary-button full delete-artwork" disabled={!layer.visible&&!layer.assetId} onClick={()=>{drag.current=null;update({assetId:null,visible:false,caption:false});}}><Trash2 size={16} aria-hidden="true"/>Delete image</button>
 <button type="button" className="secondary-button full" onClick={reset}>Reset position and size</button>
 <button type="button" className="secondary-button full" onClick={()=>onChange(previous=>restoreOriginalArtwork(previous,panel))}>Use original artwork</button>

 <p className="fine-print">{layer.assetId?"Custom image. ":"Original artwork. "}PNG keeps transparency; JPG includes its background.</p></div></div>{library}</fieldset>{error&&<p className="error-banner" role="alert">{error}</p>}
 </section>;
}
