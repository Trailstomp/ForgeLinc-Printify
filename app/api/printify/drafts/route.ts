import {readTransfer,prepareTransfer,prepareOrderTransfer,createProduct,recheckProduct} from "@/lib/printify-transfers";
import {transferOwner,transferJson,transferError,readBounded} from "@/lib/transfer-http";
import {ownerTeam} from "@/lib/team-storage";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{const owner=await transferOwner(),p=new URL(req.url).searchParams;return transferJson({transfer:await readTransfer(owner,p.get("id")??undefined,p.get("teamId")??undefined)});}catch(e){return transferError(e);}}
export async function POST(req:Request){try{
 const owner=await transferOwner(req);if(!req.headers.get("content-type")?.startsWith("application/json"))return transferJson({error:"Invalid request format."},415);
 let b:Record<string,unknown>;try{b=JSON.parse(new TextDecoder().decode(await readBounded(req,8192)));}catch(e){return transferError(e);}
 if(!b||typeof b!=="object"||Array.isArray(b))return transferJson({error:"Invalid request."},400);
 if(b.action==="prepare-order"){
  if(typeof b.orderId!=="string"||typeof b.lineId!=="string")return transferJson({error:"Choose an order item."},400);
  return transferJson({transfer:await prepareOrderTransfer(owner,b.orderId,b.lineId)});
 }
 if(b.action==="prepare"){
  if(typeof b.teamId!=="string"||typeof b.variantId!=="number"||typeof b.price!=="number")return transferJson({error:"Choose a saved team, size and draft price."},400);
  if(b.draftId!==undefined&&(typeof b.draftId!=="string"||b.draftId.length>140))return transferJson({error:"Choose a valid saved design."},400);
  await ownerTeam(owner,b.teamId);
  return transferJson({transfer:await prepareTransfer(owner,b.teamId,b.variantId,b.price,b.draftId as string|undefined)});
 }
 if(typeof b.id!=="string"||!/^[a-f0-9]{64}$/.test(b.id))return transferJson({error:"Invalid transfer reference."},400);
 if(b.action==="create")return transferJson({transfer:await createProduct(owner,b.id)});
 if(b.action==="recheck")return transferJson({transfer:await recheckProduct(owner,b.id)});
 return transferJson({error:"Unknown transfer action."},400);
 }catch(e){return transferError(e);}}
