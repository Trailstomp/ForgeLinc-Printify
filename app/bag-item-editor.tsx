"use client";
import {useEffect,useMemo,useState} from "react";
import {Minus,Plus} from "lucide-react";
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from "@/components/ui/select";
import {applyArtworkChoices,defaultLogoOptions,shopperLogoOptions,draftKey,isCustomTheme,teamDefaultConfig,themeDesign,type Team,type TeamLogoOptions,type TemplateConfig,type PanelChoices} from "@/lib/catalog";
import type {BagItem} from "@/lib/preview-bag";
import {JerseySizeError,loadJerseySizes} from "@/lib/jersey-sizes-client";
import {sameSize} from "@/lib/jersey-sizes";
import Jersey3D from "./jersey-3d";
import PlayerDetails from "./player-details";
import {ThemePicker,ShopperArtworkChoices} from "./jersey-options";

export default function BagItemEditor({item,teams,templates,logoOptions,allowCustomImages,isAdmin,onSave,onCancel}:{item:BagItem;teams:Team[];templates:Record<string,TemplateConfig>;logoOptions:Record<string,TeamLogoOptions>;allowCustomImages:boolean;isAdmin:boolean;onSave:(item:BagItem)=>void;onCancel:()=>void}){
 const [teamId,setTeamId]=useState(item.teamId),[theme,setTheme]=useState(item.config.jerseyTheme);
 const [name,setName]=useState(item.config.playerName),[number,setNumber]=useState(item.config.playerNumber),[size,setSize]=useState(item.size),[quantity,setQuantity]=useState(item.quantity);
 // Capture the starting designs once. Editing the bag never writes to team templates.
 const [bases]=useState(()=>({...structuredClone(templates),[draftKey(item.teamId,item.config.jerseyTheme)]:structuredClone(item.config)}));
 const [choices,setChoices]=useState<Record<string,PanelChoices>>({}),[uploading,setUploading]=useState(false),[sizes,setSizes]=useState<string[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(""),[retry,setRetry]=useState(0);
 const [signInRequired,setSignInRequired]=useState(false);
 const team=teams.find(t=>t.id===teamId)!,key=draftKey(teamId,theme),options=shopperLogoOptions(logoOptions[teamId]??defaultLogoOptions,allowCustomImages);
 const base=useMemo(()=>bases[key]??themeDesign(bases[draftKey(teamId)]??teamDefaultConfig(teamId,teams),theme),[bases,key,teamId,theme,teams]);
 const config=useMemo(()=>({...applyArtworkChoices(base,choices[key]??{},options),playerName:name.trim(),playerNumber:number}),[base,choices,key,options,name,number]);
 const customThemes=Object.entries(bases).filter(([id,c])=>id===draftKey(teamId,c.jerseyTheme)&&isCustomTheme(c.jerseyTheme)).map(([,c])=>c);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError("");setSignInRequired(false);
  loadJerseySizes(isAdmin,controller.signal).then(available=>{if(!controller.signal.aborted){setSizes(available);setSize(current=>available.find(value=>sameSize(value,current))??current);}})
   .catch(e=>{if(!controller.signal.aborted){setSizes([]);setError(e.message||"Could not load sizes.");setSignInRequired(e instanceof JerseySizeError&&e.signInRequired);}})
   .finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
 },[isAdmin,retry]);
 const validSize=sizes.some(value=>sameSize(value,size));
 return <><div className="bag-edit-layout"><div className="bag-edit-preview"><Jersey3D team={team} config={config} pending={false} unavailable={false} fallback={<p>Your saved design details are available here. The 3D preview could not load.</p>}/></div><div className="bag-edit-controls"><label htmlFor="bag-edit-team">Team</label><Select value={teamId} onValueChange={id=>{setTeamId(id);setTheme("light");}} disabled={uploading}><SelectTrigger id="bag-edit-team"><SelectValue/></SelectTrigger><SelectContent>{teams.map(t=><SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select><label>Jersey theme</label><ThemePicker value={theme} onChange={setTheme} customThemes={customThemes} disabled={uploading}/><PlayerDetails name={name} number={number} onName={setName} onNumber={setNumber} disabled={uploading}/><ShopperArtworkChoices key={key} team={team} config={base} options={options} choices={choices[key]??{}} onSelect={(panel,choice)=>setChoices(current=>{const next={...current[key]};if(choice)next[panel]=choice;else delete next[panel];return {...current,[key]:next};})} onBusy={setUploading} disabled={uploading} busy={uploading} defaultLabel={key===draftKey(item.teamId,item.config.jerseyTheme)?"In your bag":"Theme default"}/><label>Size</label>{loading?<p role="status">Checking available sizes…</p>:error?<div role="alert"><p>{error}</p>{signInRequired&&<a className="text-link" href="/signin-with-chatgpt?return_to=%2F" target="_top">Sign in again</a>}<button className="text-link" onClick={()=>setRetry(n=>n+1)}>Retry sizes</button></div>:<><div className="sizes">{sizes.map(s=><button type="button" key={s} aria-pressed={size===s} className={size===s?"active":""} disabled={uploading} onClick={()=>setSize(s)}>{s}</button>)}</div>{!validSize&&<p role="alert" className="connection-error">Your saved size ({size}) is no longer listed. Choose an available size before updating.</p>}</>}<label>Quantity</label><div className="quantity"><button type="button" aria-label="Decrease bag item quantity" disabled={uploading||quantity<=1} onClick={()=>setQuantity(n=>Math.max(1,n-1))}><Minus size={17}/></button><span>{quantity}</span><button type="button" aria-label="Increase bag item quantity" disabled={uploading||quantity>=99} onClick={()=>setQuantity(n=>Math.min(99,n+1))}><Plus size={17}/></button></div></div></div><div className="bag-edit-footer"><button type="button" className="secondary-button" onClick={onCancel}>Cancel edits</button><button type="button" className="primary-button" disabled={uploading||loading||!!error||!validSize} onClick={()=>onSave({...item,teamId,size,quantity,config})}>Update item in bag</button></div><p className="fine-print">Changes apply when you update this item. If you already opened Shopify checkout, prepare a new checkout preview from the updated bag.</p></>;
}
