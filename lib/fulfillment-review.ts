import {database} from "./storage";
import {ConnectionError} from "./shopify-connection";
import {credentials,buildProduct} from "./printify-transfers";
import {readFulfillmentOrder,orderProductionHold,matchOrderLine} from "./shopify-orders";
import type {TransferSnapshot} from "./printify-transfer-types";
import type {FulfillmentReview,FulfillmentLine} from "./fulfillment-types";

type TransferRow={id:string;snapshot:string;uploads:string;product_id:string;product:string;updated_at:string};
type Proof={printifyOrderId:string;shopId:number;fingerprint:string;reviewedAt:string};
const idPattern=/^[a-f0-9]{24}$/i;
const proofKey=(orderId:string)=>"fulfillment-review:"+orderId;
const jsonEqual=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
async function digest(value:unknown){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(value))))].map(v=>v.toString(16).padStart(2,"0")).join("");}
/** Read-only provider adapter. It cannot create, cancel, edit or submit orders. */
async function readProvider(token:string,path:string):Promise<any>{
 let response:Response;
 try{response=await fetch("https://api.printify.com/v1/"+path,{method:"GET",headers:{Authorization:"Bearer "+token,"User-Agent":"ForgeLinc/1.0",Accept:"application/json"},cache:"no-store",redirect:"manual",signal:AbortSignal.timeout(20000)});}catch{throw new ConnectionError("Printify could not be reached. Your review has not been approved. Retry the check.",502);}
 if(response.status===403)throw new ConnectionError("Printify order review needs orders.read and products.read on your Printify token. Keep its existing permissions and reconnect it in Connections.",403);
 if(response.status===401)throw new ConnectionError("Reconnect your Printify token in Connections.",401);
 if(response.status===404)throw new ConnectionError("That order or prepared product was not found in your connected Printify store.",404);
 if(response.status===429)throw new ConnectionError("Printify is busy. Wait a moment before checking again.",429);
 if(!response.ok)throw new ConnectionError("Printify could not confirm this order. Retry the check.",502);
 try{return await response.json();}catch{throw new ConnectionError("Printify returned an incomplete order response.",502);}
}
function sourceMatches(remote:any,orderId:string){return remote?.metadata?.order_type==="external"&&String(remote.metadata.shop_order_id)===orderId.split("/").pop()&&remote.metadata.is_reprint!==true;}
function safeUrl(value:unknown){try{const u=new URL(String(value));return u.protocol==="https:"&&!u.username&&!u.password?u.href:null;}catch{return null;}}
/** Verify the prepared product still has the five uploaded panels in their original positions. */
export function productMatches(product:any,row:TransferRow,snapshot:TransferSnapshot){
 const expected=buildProduct(row.id,snapshot,JSON.parse(row.uploads));
 if(product?.id!==row.product_id||product.blueprint_id!==expected.blueprint_id||product.print_provider_id!==expected.print_provider_id)return false;
 if(!Array.isArray(product.variants)||!product.variants.some((v:any)=>v.id===snapshot.variant.id&&v.is_enabled===true))return false;
 const areas=Array.isArray(product.print_areas)?product.print_areas.filter((a:any)=>Array.isArray(a.variant_ids)&&a.variant_ids.includes(snapshot.variant.id)):[];
 if(areas.length!==1||!Array.isArray(areas[0].placeholders))return false;
 // Printify adds one empty aggregate slot to this AOP jersey on read-back.
 // It is not a sixth printed panel. Reject any artwork there or any unknown slot.
 const aggregate=areas[0].placeholders.filter((p:any)=>p?.position==="all");
 if(aggregate.length>1||aggregate.some((p:any)=>!Array.isArray(p.images)||p.images.length!==0))return false;
 const placeholders=areas[0].placeholders.filter((p:any)=>p?.position!=="all");
 if(placeholders.length!==5)return false;
 return expected.print_areas[0].placeholders.every(e=>{
  const found=placeholders.filter((p:any)=>p?.position===e.position);if(found.length!==1)return false;
  const actual=found[0];if(e.decoration_method&&actual.decoration_method!==e.decoration_method)return false;
  if(actual.decoration_method&&!/^(sublimation|dye_sublimation|all_over_print|aop)$/i.test(actual.decoration_method))return false;
  if(!Array.isArray(actual.images)||actual.images.length!==1)return false;
  const a=actual.images[0],b=e.images[0];return a.id===b.id&&a.x===b.x&&a.y===b.y&&a.scale===b.scale&&a.angle===b.angle;
 });
}
export function matchPrintifyItems(items:any[],expected:{productId:string;variantId:number;providerId:number;quantity:number}[]){
 const wanted=new Map<string,number>(),actual=new Map<string,number>();
 for(const e of expected){const key=JSON.stringify([e.productId,e.variantId,e.providerId]);if(wanted.has(key))return false;wanted.set(key,e.quantity);}
 for(const item of items){if(!Number.isSafeInteger(item.quantity)||item.quantity<1)return false;const key=JSON.stringify([item.product_id,item.variant_id,item.print_provider_id]);actual.set(key,(actual.get(key)??0)+item.quantity);}
 return wanted.size===actual.size&&[...wanted].every(([key,quantity])=>actual.get(key)===quantity);
}
async function savedProof(owner:string,orderId:string):Promise<Proof|null>{const row=await database().prepare("SELECT config FROM templates WHERE owner=? AND id=?").bind(owner,proofKey(orderId)).first<{config:string}>();return row?JSON.parse(row.config):null;}
export async function fulfillmentReview(owner:string,orderId:string,requestedId?:string,page=1):Promise<FulfillmentReview>{
 if(requestedId&&!idPattern.test(requestedId))throw new ConnectionError("Enter the Printify order ID from its order URL.");
 if(!Number.isSafeInteger(page)||page<1||page>10000)throw new ConnectionError("Invalid Printify search page.");
 const order=await readFulfillmentOrder(owner,orderId),hold=orderProductionHold(order),c=await credentials(owner),proof=await savedProof(owner,orderId);
 const rows=(await database().prepare("SELECT id,snapshot,uploads,product_id,product,updated_at FROM printify_transfers WHERE owner=? AND status='created' AND json_extract(snapshot,'$.order.id')=? ORDER BY updated_at DESC,id").bind(owner,orderId).all<TransferRow>()).results;
 const response:FulfillmentReview={orderId,shopId:c.shopId,name:order.name,test:order.test,hold,lines:[],printify:null,issues:[],notice:null,nextSearchPage:null,ready:false,fingerprint:null,reviewedAt:null,checkedAt:new Date().toISOString()};
 // Tests remain read-only artwork exercises and never contact Printify orders.
 if(order.test){for(const line of order.lineItems.nodes){const matched=await matchOrderLine(owner,order,line);response.lines.push({...matched,transferId:null,productId:null,productTitle:null,size:matched.artwork?.size??null});}return response;}
 let remote:any=null;
 const lookupId=requestedId??(proof?.shopId===c.shopId?proof.printifyOrderId:undefined);
 if(lookupId){remote=await readProvider(c.token,`shops/${c.shopId}/orders/${lookupId}.json`);if(remote?.id!==lookupId||!sourceMatches(remote,orderId))throw new ConnectionError("This Printify order does not belong to the original Shopify purchase. Choose the imported order, not a new manual or replacement order.",409);}
 else{
  const list=await readProvider(c.token,`shops/${c.shopId}/orders.json?limit=10&page=${page}`);
  if(!Array.isArray(list?.data))throw new ConnectionError("Printify returned an incomplete order list.",502);
  const matches=list.data.filter((entry:any)=>sourceMatches(entry,orderId));
  if(matches.length>1)throw new ConnectionError("More than one Printify order refers to this Shopify purchase. Review possible duplicates in Printify before continuing.",409);
  if(list.next_page_url)response.nextSearchPage=page+1;
  if(matches.length){if(!idPattern.test(matches[0].id))throw new ConnectionError("Printify returned an invalid order ID.",502);remote=await readProvider(c.token,`shops/${c.shopId}/orders/${matches[0].id}.json`);if(remote?.id!==matches[0].id||!sourceMatches(remote,orderId))throw new ConnectionError("The Printify order reference changed. Check again.",409);}
  else response.notice="No matching imported order on this page. Try the next page or paste its Printify order ID. Orders may take time to import.";
 }
 if(remote){
  if(!Array.isArray(remote.line_items)||remote.line_items.length>100||typeof remote.status!=="string")throw new ConnectionError("Printify returned incomplete order items.",502);
  // Addresses and contact details in provider responses are deliberately not returned or stored.
  response.printify={id:remote.id,status:remote.status,label:String(remote.metadata.shop_order_label??order.name),items:remote.line_items.map((item:any)=>({productId:String(item.product_id??""),quantity:item.quantity,size:String(item.metadata?.variant_label??"")})),shipments:(Array.isArray(remote.shipments)?remote.shipments:[]).slice(0,20).map((s:any)=>({carrier:String(s.carrier??"Carrier"),number:String(s.number??""),url:safeUrl(s.url)}))};
  if(remote.status!=="on-hold"||remote.sent_to_production_at||remote.fulfilled_at||remote.line_items.some((l:any)=>l.status!=="on-hold"||l.sent_to_production_at||l.fulfilled_at))response.issues.push("This Printify order is not fully on hold. Check its status before approving or making changes.");
  if(remote.metadata.child_reprinted_order_ids?.length)response.issues.push("This order has a reprint. Review it in Printify to avoid producing a duplicate.");
 }
 const expected:{productId:string;variantId:number;providerId:number;quantity:number}[]=[],fingerprints:unknown[]=[];
 for(const line of order.lineItems.nodes){
  const matched=await matchOrderLine(owner,order,line),art=matched.artwork;
  const item:FulfillmentLine={...matched,transferId:null,productId:null,productTitle:null,size:art?.size??null};response.lines.push(item);
  if(!art||matched.issue)continue;
  const valid=rows.filter(row=>{const s=JSON.parse(row.snapshot) as TransferSnapshot;return s.shopId===c.shopId&&s.order?.lineId===line.id&&s.order.quantity===art.quantity&&s.order.name===order.name&&s.variant.size.toLowerCase()===art.size.toLowerCase()&&jsonEqual(s.config,art.config)&&jsonEqual(s.team,art.team);});
  // Keep using the matching prepared product if it was already attached in Printify.
  const present=valid.filter(row=>remote?.line_items.some((l:any)=>l.product_id===row.product_id));
  if(present.length>1){item.issue="Multiple prepared versions of this jersey are in the order. Remove the extra version in Printify.";continue;}
  const row=present[0]??valid[0];
  if(!row){item.issue="Prepare this item’s Printify artwork first.";continue;}
  const s=JSON.parse(row.snapshot) as TransferSnapshot;item.transferId=row.id;item.productId=row.product_id;item.productTitle=JSON.parse(row.product).title;
  expected.push({productId:row.product_id,variantId:s.variant.id,providerId:s.catalog.provider.id,quantity:art.quantity});
  if(remote){const product=await readProvider(c.token,`shops/${c.shopId}/products/${encodeURIComponent(row.product_id)}.json`);if(!productMatches(product,row,s)){item.issue="The prepared Printify product’s artwork or size has changed. Review its five panels before continuing.";}fingerprints.push([line.id,row.id,row.product_id,row.uploads,s]);}
 }
 if(response.lines.some(l=>l.issue))response.issues.push("Every item in this order must have its own matching prepared artwork. Resolve the item notes first.");
 if(remote&&!matchPrintifyItems(remote.line_items,expected))response.issues.push("Printify’s products, sizes or quantities do not match the prepared jerseys. Add the listed products, remove the original unpersonalized items and check quantities.");
 response.ready=!!remote&&!hold&&!response.issues.length&&response.lines.length>0;
 if(response.ready){
  // Hash sensitive delivery data without persisting or returning it. Address edits invalidate the review.
  response.fingerprint=await digest([order.id,order.name,c.shopId,remote.id,remote.status,remote.line_items,remote.address_to,remote.shipping_method,remote.total_price,remote.total_shipping,remote.total_tax,fingerprints]);
  if(proof?.shopId===c.shopId&&proof.printifyOrderId===remote.id&&proof.fingerprint===response.fingerprint)response.reviewedAt=proof.reviewedAt;
 }
 return response;
}
export async function approveFulfillmentArtwork(owner:string,orderId:string,printifyOrderId:string,fingerprint:string){
 const review=await fulfillmentReview(owner,orderId,printifyOrderId);
 if(!review.ready||!review.fingerprint||review.fingerprint!==fingerprint)throw new ConnectionError("The order, artwork or delivery details changed. Refresh the check and review the current Printify order again.",409);
 const c=await credentials(owner),now=new Date().toISOString();
 if(c.shopId!==review.shopId)throw new ConnectionError("The connected Printify store changed. Refresh the review.",409);
 const proof:Proof={printifyOrderId:review.printify!.id,shopId:c.shopId,fingerprint:review.fingerprint,reviewedAt:review.reviewedAt??now};
 await database().prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at").bind(owner,proofKey(orderId),JSON.stringify(proof),now).run();
 return {...review,reviewedAt:proof.reviewedAt};
}
