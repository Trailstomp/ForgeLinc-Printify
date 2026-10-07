import {prepareCheckout,completePreparedCheckout,readPreparedCheckout} from "@/lib/prepared-checkout";
import {customCheckoutStatus,setupCustomCatalog} from "@/lib/checkout-catalog";
import {fulfillmentStatus,fulfillmentLastRun,processPaidCheckouts} from "@/lib/automatic-fulfillment";
import {transferOwner,readBounded,transferJson,transferError} from "@/lib/transfer-http";
import {ZodError} from "zod";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{
 const owner=await transferOwner(),params=new URL(req.url).searchParams,resume=params.get("resume");
 if(resume){
  if(!/^[a-f0-9-]{36}$/i.test(resume))return transferJson({error:"Invalid saved checkout reference."},400);
  const saved=await readPreparedCheckout(owner,resume);if(!saved)return transferJson({error:"Saved checkout not found."},404);
  return transferJson({id:saved.id,items:saved.items.map((item,index)=>({...item,id:saved.id+":"+index,draftId:saved.selections[index]?.draftId}))});
 }
 const orders=params.has("orders");return transferJson({...(!orders?await customCheckoutStatus(owner):{}),jobs:await fulfillmentStatus(owner),lastRun:await fulfillmentLastRun(owner)});
 }catch(e){return transferError(e);}}
export async function POST(req:Request){try{
 const owner=await transferOwner(req);if(!req.headers.get("content-type")?.startsWith("application/json"))return transferJson({error:"Use JSON."},415);
 const b=JSON.parse(new TextDecoder().decode(await readBounded(req,150000)));
 if(b?.action==="setup")return transferJson(await setupCustomCatalog(owner,typeof b.price==="string"?b.price:undefined));
 if(b?.action==="prepare")return transferJson(await prepareCheckout(owner,b.checkout));
 if(b?.action==="checkout"&&typeof b.id==="string"&&/^[a-f0-9-]{36}$/i.test(b.id))return transferJson(await completePreparedCheckout(owner,b.id));
 if(b?.action==="process")return transferJson(await processPaidCheckouts(owner));
 return transferJson({error:"Unknown checkout action."},400);
 }catch(e){if(e instanceof ZodError||e instanceof SyntaxError)return transferJson({error:"Check the sizes, quantity and design settings."},400);return transferError(e);}}
