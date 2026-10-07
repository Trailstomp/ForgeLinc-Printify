import {sameDesign,configSchema,type TemplateConfig} from "./catalog";
import {z} from "zod";
export type BagItem={id:string;teamId:string;size:string;quantity:number;config:TemplateConfig;draftId?:string};
const bagSchema=z.array(z.object({id:z.string().min(1).max(150),teamId:z.string().min(1).max(100),size:z.string().min(1).max(80),quantity:z.number().int().min(1).max(99),config:configSchema,draftId:z.string().max(200).optional()}).strict()).max(100);
const bagKey="forgelinc-preview-bag:v1",attemptKey="forgelinc-checkout-attempt:v1";
export function bagFingerprint(items:Pick<BagItem,"teamId"|"size"|"quantity"|"config">[]){return JSON.stringify(items.map(({teamId,size,quantity,config})=>({teamId,size,quantity,config:configSchema.parse(config)})));}
export function readBagSession():BagItem[]{try{const saved=JSON.parse(sessionStorage.getItem(bagKey)??"null");return saved?.version===1?bagSchema.parse(saved.items):[];}catch{return [];}}
export function writeBagSession(items:BagItem[]){try{sessionStorage.setItem(bagKey,JSON.stringify({version:1,items:bagSchema.parse(items)}));}catch{/* Browser storage may be disabled; the in-memory bag remains usable. */}}
export function readCheckoutAttempt(){try{const saved=JSON.parse(sessionStorage.getItem(attemptKey)??"null");return saved?.version===1&&z.string().uuid().safeParse(saved.id).success&&typeof saved.fingerprint==="string"?{id:saved.id as string,fingerprint:saved.fingerprint as string}:null;}catch{return null;}}
export function rememberCheckoutAttempt(attempt:{id:string;fingerprint:string}){try{sessionStorage.setItem(attemptKey,JSON.stringify({version:1,...attempt}));}catch{}}
export function restorePreparedBag(current:BagItem[],recovered:BagItem[]){const next=[...current];for(const item of recovered){if(!next.some(existing=>existing.id===item.id||(existing.teamId===item.teamId&&existing.size===item.size&&sameDesign(existing.config,item.config))))next.push(item);}return next;}
export function updateBagItem(items:BagItem[],edited:BagItem){
 return items.map(item=>{
  if(item.id!==edited.id)return item;
  const keepDraft=item.teamId===edited.teamId&&sameDesign(item.config,edited.config);
  return {id:item.id,teamId:edited.teamId,size:edited.size,quantity:edited.quantity,config:structuredClone(edited.config),...(keepDraft&&item.draftId?{draftId:item.draftId}:{})};
 });
}
