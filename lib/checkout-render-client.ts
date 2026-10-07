"use client";
import {renderPanel} from "./panel-renderer";
import {panels} from "./catalog";
import type {Transfer} from "./printify-transfer-types";

async function transferResult(response:Response):Promise<Transfer>{
 const body=await response.json() as {transfer?:Transfer;error?:string};
 if(!response.ok||!body.transfer)throw new Error(body.error||"Could not prepare this jersey. Your selection is still in the bag.");
 return body.transfer;
}
export async function renderCheckoutTransfer(initial:Transfer,progress:(message:string)=>void){
 let transfer=initial;
 if(transfer.status==="created")return transfer;
 if(transfer.status!=="preparing"){
  transfer=await transferResult(await fetch("/api/printify/drafts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"recheck",id:transfer.id})}));
  if(transfer.status==="created")return transfer;
 }
 if(!transfer.snapshot.team)throw new Error("The saved team artwork is incomplete.");
 for(const area of transfer.snapshot.variant.areas){
  if(transfer.uploaded.includes(area.panel))continue;
  progress("Preparing "+panels.find(panel=>panel.id===area.panel)?.name.toLowerCase()+"…");
  const canvas=document.createElement("canvas");let blob:Blob;
  try{
   await renderPanel(canvas,area.panel,transfer.snapshot.team!,transfer.snapshot.config,false,false,area);
   blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("The print panel could not be rendered.")),"image/png"));
  }finally{canvas.width=1;canvas.height=1;}
  if(blob.size>20*1024*1024)throw new Error("This panel exceeds the 20 MB limit.");
  transfer=await transferResult(await fetch("/api/printify/panel?id="+transfer.id+"&panel="+area.panel,{method:"POST",headers:{"Content-Type":"image/png"},body:blob}));
 }
 progress("Attaching your artwork and size in Printify…");
 return transferResult(await fetch("/api/printify/drafts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"create",id:transfer.id})}));
}
