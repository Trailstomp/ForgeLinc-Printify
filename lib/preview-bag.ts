import {sameDesign,type TemplateConfig} from "./catalog";
export type BagItem={id:string;teamId:string;size:string;quantity:number;config:TemplateConfig;draftId?:string};
export function updateBagItem(items:BagItem[],edited:BagItem){
 return items.map(item=>{
  if(item.id!==edited.id)return item;
  const keepDraft=item.teamId===edited.teamId&&sameDesign(item.config,edited.config);
  return {id:item.id,teamId:edited.teamId,size:edited.size,quantity:edited.quantity,config:structuredClone(edited.config),...(keepDraft&&item.draftId?{draftId:item.draftId}:{})};
 });
}
