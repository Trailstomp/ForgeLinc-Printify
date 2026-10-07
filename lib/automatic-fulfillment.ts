import {database} from "./storage";
import {ConnectionError,savedShopifyQuery} from "./shopify-connection";
import {credentials,printifyApi,PrintifyRequestError} from "./printify-transfers";
import {readPreparedCheckout,verifyPreparedProducts,type PreparedCheckout} from "./prepared-checkout";
import {matchPrintifyItems} from "./fulfillment-review";

type Attribute={key:string;value:string};
type PaidOrder={id:string;name:string;createdAt:string;test:boolean;cancelledAt:string|null;displayFinancialStatus:string;displayFulfillmentStatus:string;email:string|null;phone:string|null;shippingAddress:{firstName:string|null;lastName:string|null;address1:string|null;address2:string|null;city:string|null;provinceCode:string|null;countryCodeV2:string|null;zip:string|null;phone:string|null}|null;customAttributes:Attribute[];lineItems:{nodes:{id:string;quantity:number;currentQuantity:number;unfulfilledQuantity:number;variant:{id:string}|null;product:{id:string}|null;customAttributes:Attribute[]}[];pageInfo:{hasNextPage:boolean}}};
type Job={owner:string;id:string;checkout_id:string;state:string;payload:string;printify_order_id:string|null;message:string|null};
const orderFields="id name createdAt test cancelledAt displayFinancialStatus displayFulfillmentStatus email phone shippingAddress{firstName lastName address1 address2 city provinceCode countryCodeV2 zip phone} customAttributes{key value} lineItems(first:50){nodes{id quantity currentQuantity unfulfilledQuantity variant{id} product{id} customAttributes{key value}} pageInfo{hasNextPage}}";
const unique=(attributes:Attribute[],key:string)=>{const matches=attributes.filter(a=>a.key===key);return matches.length===1?matches[0].value:null;};
async function getJob(owner:string,id:string){return database().prepare("SELECT * FROM fulfillment_jobs WHERE owner=? AND id=?").bind(owner,id).first<Job>();}
async function state(owner:string,id:string,next:string,message:string|null=null,remoteId?:string){await database().prepare("UPDATE fulfillment_jobs SET state=?,message=?,printify_order_id=COALESCE(?,printify_order_id),updated_at=? WHERE owner=? AND id=?").bind(next,message,remoteId??null,new Date().toISOString(),owner,id).run();}
export function validatePaidOrder(order:PaidOrder,s:PreparedCheckout){
 if(order.test)throw new ConnectionError("Test order: production is disabled.",409);
 if(order.cancelledAt||order.displayFinancialStatus!=="PAID"||order.displayFulfillmentStatus!=="UNFULFILLED")throw new ConnectionError("Order is not paid, active and unfulfilled. Hold production.",409);
 if(!s.result||s.fulfillment!=="automated-v2"||unique(order.customAttributes,"ForgeLinc checkout")!==s.id||unique(order.customAttributes,"ForgeLinc fulfillment")!=="automated-v2")throw new ConnectionError("The order does not match a completed automated checkout.",409);
 if(order.lineItems.pageInfo.hasNextPage||order.lineItems.nodes.length!==s.items.length||(s.lineProductIds&&s.lineProductIds.length!==s.items.length))throw new ConnectionError("Order items changed after checkout. Hold production.",409);
 const seen=new Set<string>();
 for(let i=0;i<s.items.length;i++){
  const reference=s.id+":"+i,matches=order.lineItems.nodes.filter(l=>unique(l.customAttributes,"_ForgeLinc design")===reference),expected=s.lines[i],item=s.items[i];
  if(matches.length!==1)throw new ConnectionError("Missing or duplicated design reference. Hold production.",409);
  const line=matches[0];if(seen.has(line.id)||line.product?.id!==(s.lineProductIds?.[i]??s.product.id)||line.variant?.id!==expected.merchandiseId||line.quantity!==item.quantity||line.currentQuantity!==item.quantity||line.unfulfilledQuantity!==item.quantity||!expected.attributes.every(a=>unique(line.customAttributes,a.key)===a.value))throw new ConnectionError("The purchased size, quantity or personalization changed. Hold production.",409);
  seen.add(line.id);
 }
 const a=order.shippingAddress;
 if(!a?.firstName||!a.lastName||!a.address1||!a.city||!a.countryCodeV2||!a.zip)throw new ConnectionError("A complete delivery address is required before production.",409);
 return {first_name:a.firstName,last_name:a.lastName,email:order.email??"",phone:a.phone??order.phone??"",country:a.countryCodeV2,region:a.provinceCode??"",address1:a.address1,address2:a.address2??"",city:a.city,zip:a.zip};
}
async function freshOrder(owner:string,id:string){
 const r=await savedShopifyQuery<{order:PaidOrder|null}>(owner,`query ForgeLincPaidDesign($id:ID!){order(id:$id){${orderFields}}}`,{id},"orders");
 if(!r.order||r.order.id!==id)throw new ConnectionError("The Shopify order could not be verified.",409);return r.order;
}
async function providerOrderLookup(owner:string,order:PaidOrder,externalId:string){
 const c=await credentials(owner);const numeric=order.id.split("/").pop();const matches:any[]=[];
 // Complete pagination is required before a write. An incomplete scan holds the order.
 for(let page=1;page<=50;page++){
  const list=await printifyApi(c,`shops/${c.shopId}/orders.json?limit=100&page=${page}`);
  if(!Array.isArray(list.data))throw new ConnectionError("Could not check for an existing Printify order.",502);
  for(const p of list.data){
   if(String(p.metadata?.shop_order_id)===numeric&&p.metadata?.order_type==="external")throw new ConnectionError("Shopify already imported this order into Printify. Review the existing order; another will not be created.",409);
   if(String(p.metadata?.shop_order_id)===externalId)matches.push(p);
  }
  if(!list.next_page_url){if(matches.length>1)throw new ConnectionError("Multiple Printify orders match this checkout. Hold production.",409);return matches[0]??null;}
 }
 throw new ConnectionError("Duplicate-order check reached its page limit. Hold production and review the order.",409);
}
function matchesRemote(remote:any,items:{product_id:string;variant_id:number;quantity:number;print_provider_id:number}[]){
 const combined=new Map<string,{productId:string;variantId:number;providerId:number;quantity:number}>();
 for(const i of items){const key=JSON.stringify([i.product_id,i.variant_id,i.print_provider_id]),prior=combined.get(key);if(prior)prior.quantity+=i.quantity;else combined.set(key,{productId:i.product_id,variantId:i.variant_id,providerId:i.print_provider_id,quantity:i.quantity});}
 return Array.isArray(remote?.line_items)&&matchPrintifyItems(remote.line_items,[...combined.values()]);
}
async function deliveryDigest(address:ReturnType<typeof validatePaidOrder>){return [...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(address))))].map(b=>b.toString(16).padStart(2,"0")).join("");}
async function advanceProduction(owner:string,orderId:string,s:PreparedCheckout,remote:any,items:Parameters<typeof matchesRemote>[1]){
 let job=(await getJob(owner,orderId))!;
 const externalId=JSON.parse(job.payload).externalId;
 if(!remote?.id||remote.id!==job.printify_order_id||String(remote.metadata?.shop_order_id)!==externalId||!matchesRemote(remote,items)||remote.metadata?.is_reprint||remote.metadata?.child_reprinted_order_ids?.length)throw new ConnectionError("The Printify order does not match this purchase. Hold production.",409);
 const progress=["sending-to-production","in-production","partially-fulfilled","fulfilled"];
 if(progress.includes(remote.status)){
  const next=remote.status==="fulfilled"?"complete":"submitted";
  await state(owner,orderId,next,remote.status.replaceAll("-"," "));return {id:orderId,state:next,printifyOrderId:remote.id};
 }
 if(["release_pending","release_uncertain","submitted"].includes(job.state))throw new ConnectionError("Production was already requested. Check the existing Printify order; it will not be submitted twice.",409);
 if(["pending","cost-calculation"].includes(remote.status)){await state(owner,orderId,"awaiting-provider","Printify is preparing the order. The next check will continue automatically.");return {id:orderId,state:"awaiting-provider"};}
 if(remote.status!=="on-hold"||remote.line_items.some((l:any)=>l.status!=="on-hold"||l.sent_to_production_at||l.fulfilled_at))throw new ConnectionError("Printify reports "+String(remote.status)+". Review the existing order before production.",409);
 // Recheck payment and address immediately before the production charge. Never
 // change the delivery address of an already-created order silently.
 const address=validatePaidOrder(await freshOrder(owner,orderId),s),payload=JSON.parse(job.payload);
 if(!payload.deliveryDigest||payload.deliveryDigest!==await deliveryDigest(address))throw new ConnectionError("Delivery details changed after the Printify order was prepared. Review it before production.",409);
 const claim=await database().prepare("UPDATE fulfillment_jobs SET state='release_pending',message=NULL,updated_at=? WHERE owner=? AND id=? AND state IN ('created','awaiting-provider','blocked') RETURNING id").bind(new Date().toISOString(),owner,orderId).all<{id:string}>();
 if(!claim.results.length)return {id:orderId,state:"in-progress"};
 try{
  const c=await credentials(owner);
  await printifyApi(c,`shops/${c.shopId}/orders/${encodeURIComponent(remote.id)}/send_to_production.json`,{});
  await state(owner,orderId,"submitted","Sent to Printify for production.");
  return {id:orderId,state:"submitted",printifyOrderId:remote.id};
 }catch(e){
  await state(owner,orderId,e instanceof PrintifyRequestError&&!e.uncertain?"blocked":"release_uncertain",e instanceof ConnectionError?e.message:"Waiting for Printify to confirm production. The same order will not be sent again.");
  throw e;
 }
}
export async function submitPaidOrder(owner:string,original:PaidOrder){
 const checkoutId=unique(original.customAttributes,"ForgeLinc checkout");
 if(!checkoutId||!/^[-a-f0-9]{36}$/i.test(checkoutId)||unique(original.customAttributes,"ForgeLinc fulfillment")!=="automated-v2")return {id:original.id,state:"ignored"};
 const s=await readPreparedCheckout(owner,checkoutId);if(!s)return {id:original.id,state:"ignored"};
 const now=new Date().toISOString(),externalId="forgelinc-"+original.id.split("/").pop();
 await database().prepare("INSERT INTO fulfillment_jobs(owner,id,checkout_id,state,payload,created_at,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner,id) DO NOTHING").bind(owner,original.id,checkoutId,"ready",JSON.stringify({externalId}),now,now).run();
 let job=(await getJob(owner,original.id))!;
 if(job.checkout_id!==checkoutId)throw new ConnectionError("Order design reference changed.",409);
 if(job.state==="complete")return {id:original.id,state:job.state};
 try{
  let order=await freshOrder(owner,original.id);let address=validatePaidOrder(order,s);
  const transfers=await verifyPreparedProducts(owner,s),c=await credentials(owner);
  const items=transfers.map((t,i)=>({product_id:t.product!.id,variant_id:t.snapshot.variant.id,print_provider_id:t.snapshot.catalog.provider.id,quantity:s.items[i].quantity,external_id:order.id.split("/").pop()+":"+i}));
  let remote=job.printify_order_id?await printifyApi(c,`shops/${c.shopId}/orders/${encodeURIComponent(job.printify_order_id)}.json`):await providerOrderLookup(owner,order,externalId);
  if(remote){
   if(!matchesRemote(remote,items))throw new ConnectionError("The existing Printify order has different artwork or sizes. Hold production.",409);
   if(!job.printify_order_id)await state(owner,order.id,"created",null,remote.id);
   return await advanceProduction(owner,order.id,s,remote,items);
  }
  // Never replay an ambiguous external write, even if the order is not visible yet.
  if(job.state==="submitting"||job.state==="uncertain")throw new ConnectionError("Waiting to reconcile an earlier Printify submission. A duplicate will not be sent.",409);
  order=await freshOrder(owner,order.id);address=validatePaidOrder(order,s);
  const claim=await database().prepare("UPDATE fulfillment_jobs SET state='submitting',payload=?,message=NULL,updated_at=? WHERE owner=? AND id=? AND printify_order_id IS NULL AND state IN ('ready','blocked') RETURNING id").bind(JSON.stringify({externalId,deliveryDigest:await deliveryDigest(address)}),new Date().toISOString(),owner,order.id).all<{id:string}>();
  if(!claim.results.length)return {id:order.id,state:"in-progress"};
  try{
   remote=await printifyApi(c,`shops/${c.shopId}/orders.json`,{external_id:externalId,label:order.name,line_items:items.map(({print_provider_id,...i})=>i),shipping_method:1,send_shipping_notification:false,address_to:address});
   if(!remote||typeof remote.id!=="string")throw new PrintifyRequestError("Printify did not confirm the order reference.",true);
   // Persist immediately. Subsequent runs never create this order again.
   await state(owner,order.id,"created",null,remote.id);
  }catch(e){
   const definite=e instanceof PrintifyRequestError&&!e.uncertain;
   await state(owner,order.id,definite?"blocked":"uncertain",e instanceof ConnectionError?e.message:"Printify did not confirm the submission. Reconciliation is required.");
   throw e;
  }
  remote=await printifyApi(c,`shops/${c.shopId}/orders/${encodeURIComponent(remote.id)}.json`);
  return await advanceProduction(owner,order.id,s,remote,items);
 }catch(e){
  job=(await getJob(owner,original.id))!;
  const message=e instanceof ConnectionError?e.message:"Could not verify this custom order. It remains on hold.";
  const next=["submitting","uncertain","release_pending","release_uncertain","submitted","complete"].includes(job.state)?job.state:"blocked";
  await state(owner,original.id,next,message);
  return {id:original.id,state:next,message};
 }
}
export async function fulfillmentStatus(owner:string){
 return (await database().prepare("SELECT id,checkout_id,state,printify_order_id,message,updated_at FROM fulfillment_jobs WHERE owner=? ORDER BY updated_at DESC LIMIT 30").bind(owner).all()).results;
}
/** Read-only receipt check. Never calls the order processor or any provider mutation. */
export async function recentCheckoutReceipts(owner:string){
 const r=await savedShopifyQuery<{orders:{nodes:PaidOrder[]}}>(owner,`query ForgeLincCheckoutReceipts{orders(first:5,reverse:true,sortKey:CREATED_AT){nodes{${orderFields}}}}`,{},"orders");
 const receipts=[];
 for(const order of r.orders.nodes){
  if(unique(order.customAttributes,"ForgeLinc fulfillment")!=="automated-v2")continue;
  const id=unique(order.customAttributes,"ForgeLinc checkout");if(!id)continue;
  const saved=await readPreparedCheckout(owner,id);if(!saved)continue;
  let matches=false,message:string|null=null;
  try{validatePaidOrder(order,saved);matches=true;}catch(e){message=e instanceof ConnectionError?e.message:"Could not verify the receipt.";}
  const job=await getJob(owner,order.id);
  receipts.push({orderId:order.id,orderName:order.name,paid:order.displayFinancialStatus==="PAID",financialStatus:order.displayFinancialStatus,fulfillmentStatus:order.displayFulfillmentStatus,test:order.test,checkoutId:id,matches,message,productionState:job?.state??"not-processed",printifyOrderId:job?.printify_order_id??null,productionMessage:job?.message??null,items:saved.items.map(item=>({team:saved.teams.find(t=>t.id===item.teamId)?.name??item.teamId,size:item.size,quantity:item.quantity,name:item.config.playerName,number:item.config.playerNumber,theme:item.config.jerseyTheme}))});
 }
 return {receipts};
}
/** Quote-only diagnosis for one paid checkout. This endpoint cannot create an
 * order, request production, change a job, or charge a payment method. */
export async function diagnoseCheckoutShipping(owner:string,orderId:string){
 const order=await freshOrder(owner,orderId),id=unique(order.customAttributes,"ForgeLinc checkout");
 if(!id)throw new ConnectionError("This order has no prepared design reference.",409);
 const saved=await readPreparedCheckout(owner,id);if(!saved)throw new ConnectionError("Prepared checkout not found.",404);
 const address=validatePaidOrder(order,saved),transfers=await verifyPreparedProducts(owner,saved),connection=await credentials(owner);
 const line_items=transfers.map((t,i)=>({product_id:t.product!.id,variant_id:t.snapshot.variant.id,quantity:saved.items[i].quantity}));
 // Printify documents orders/shipping.json as calculation only. Keep this
 // fixed path separate from the processor's consequential orders.json write.
 const response=await fetch(`https://api.printify.com/v1/shops/${connection.shopId}/orders/shipping.json`,{method:"POST",headers:{Authorization:"Bearer "+connection.token,"User-Agent":"ForgeLinc/1.0","Content-Type":"application/json"},body:JSON.stringify({line_items,address_to:address}),redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(45000)});
 const body=await response.json().catch(()=>null);
 // Never include the delivery/contact values or a credential in diagnostics.
 let detail=JSON.stringify(body??{}).replaceAll(connection.token,"[redacted]");
 for(const value of Object.values(address).filter(value=>typeof value==="string"&&value.length>3))detail=detail.replaceAll(value,"[delivery value]");
 return {orderName:order.name,orderId,quoteOnly:true,createdOrder:false,artworkVerified:true,itemCount:line_items.reduce((n,i)=>n+i.quantity,0),hasEmail:!!address.email,hasPhone:!!address.phone,httpStatus:response.status,shippingAvailable:response.ok,detail:detail.slice(0,1600)};
}
async function scanPaidCheckouts(owner:string){
 // Never scan or submit old orders when no new, fully prepared checkout exists.
 const earliest=await database().prepare("SELECT MIN(json_extract(config,'$.createdAt')) AS since FROM templates WHERE owner=? AND id LIKE 'prepared-checkout:%' AND json_extract(config,'$.result') IS NOT NULL").bind(owner).first<{since:string|null}>();
 if(!earliest?.since)return {processed:[],message:"No completed custom checkouts are awaiting payment."};
 const cursorKey="automated-fulfillment-cursor",cursorRow=await database().prepare("SELECT config FROM templates WHERE owner=? AND id=?").bind(owner,cursorKey).first<{config:string}>(),cursor=cursorRow?JSON.parse(cursorRow.config).cursor:null;
 const query=`created_at:>=${earliest.since} financial_status:paid`;
 const r=await savedShopifyQuery<{orders:{nodes:PaidOrder[];pageInfo:{hasNextPage:boolean;endCursor:string|null}}}>(owner,`query ForgeLincPaidCheckouts($query:String!,$after:String){orders(first:20,reverse:true,sortKey:CREATED_AT,query:$query,after:$after){nodes{${orderFields}} pageInfo{hasNextPage endCursor}}}`,{query,after:cursor??null},"orders");
 const processed=[];
 for(const order of r.orders.nodes){if(unique(order.customAttributes,"ForgeLinc fulfillment")==="automated-v2")processed.push(await submitPaidOrder(owner,order));}
 await database().prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at").bind(owner,cursorKey,JSON.stringify({cursor:r.orders.pageInfo.hasNextPage?r.orders.pageInfo.endCursor:null}),new Date().toISOString()).run();
 return {processed,more:r.orders.pageInfo.hasNextPage};
}
export async function fulfillmentLastRun(owner:string){const row=await database().prepare("SELECT config FROM templates WHERE owner=? AND id='automated-fulfillment-last-run'").bind(owner).first<{config:string}>();return row?JSON.parse(row.config):null;}
export async function processPaidCheckouts(owner:string){
 const startedAt=new Date().toISOString();let result:unknown;
 try{result=await scanPaidCheckouts(owner);return result;}
 catch(e){result={error:e instanceof ConnectionError?e.message:"Could not check paid orders."};throw e;}
 finally{await database().prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,'automated-fulfillment-last-run',?,?) ON CONFLICT(owner,id) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at").bind(owner,JSON.stringify({startedAt,completedAt:new Date().toISOString(),result}),new Date().toISOString()).run();}
}
