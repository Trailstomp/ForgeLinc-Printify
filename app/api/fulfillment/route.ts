import {transferOwner,transferJson,transferError,readBounded} from "@/lib/transfer-http";
import {fulfillmentReview,approveFulfillmentArtwork} from "@/lib/fulfillment-review";
export const dynamic="force-dynamic";
export async function GET(req:Request){try{const owner=await transferOwner(),q=new URL(req.url).searchParams;return transferJson(await fulfillmentReview(owner,q.get("order")??"",q.get("printifyOrder")||undefined,Number(q.get("page")??1)));}catch(e){return transferError(e);}}
export async function POST(req:Request){try{
 const owner=await transferOwner(req);let body:any;try{body=JSON.parse(new TextDecoder().decode(await readBounded(req,4096)));}catch{return transferJson({error:"Invalid artwork review request."},400);}
 if(body?.action!=="approve-artwork"||body.confirmed!==true||typeof body.orderId!=="string"||typeof body.printifyOrderId!=="string"||!(/^[a-f0-9]{64}$/).test(body.fingerprint??""))return transferJson({error:"Review the actual Printify order previews and confirm before saving your artwork approval."},400);
 return transferJson(await approveFulfillmentArtwork(owner,body.orderId,body.printifyOrderId,body.fingerprint));
 }catch(e){return transferError(e);}}
