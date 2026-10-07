import {database} from "./storage";
import {ConnectionError,savedShopifyQuery} from "./shopify-connection";
import {checkoutSettings,checkoutRequestSchema} from "./shopify-checkout";
import type {Team} from "./catalog";
import type {OrderLineReview,OrderReview,OrderReviewPage} from "./order-review-types";

type Attribute={key:string;value:string};
export type ShopifyOrderLine={id:string;title:string;quantity:number;currentQuantity:number;unfulfilledQuantity:number;variant:{id:string}|null;product:{id:string}|null;customAttributes:Attribute[];originalUnitPriceSet?:{shopMoney:{amount:string;currencyCode:string}}};
export type ShopifyOrder={id:string;name:string;createdAt:string;test:boolean;cancelledAt:string|null;displayFinancialStatus:string|null;displayFulfillmentStatus:string;customAttributes:Attribute[];lineItems:{nodes:ShopifyOrderLine[];pageInfo:{hasNextPage:boolean}}};
// Only order state and design references are requested. No addresses, email or payment details.
const query=`query ForgeLincOrderReview($after:String,$query:String!){orders(first:3,after:$after,reverse:true,sortKey:CREATED_AT,query:$query){nodes{id name createdAt test cancelledAt displayFinancialStatus displayFulfillmentStatus customAttributes{key value} lineItems(first:50){nodes{id title quantity currentQuantity unfulfilledQuantity variant{id} product{id} customAttributes{key value}} pageInfo{hasNextPage}}} pageInfo{hasNextPage endCursor}}}`;
const refPattern=/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([0-9])$/i;
export async function purchasedArtwork(owner:string,orderId:string,lineId:string){
 if(!/^gid:\/\/shopify\/Order\/\d+$/.test(orderId)||!/^gid:\/\/shopify\/LineItem\/\d+$/.test(lineId))throw new ConnectionError("Invalid order item.");
 const order=await readFulfillmentOrder(owner,orderId);
 const blocked=hold(order);if(blocked)throw new ConnectionError(blocked,409);
 const line=order.lineItems.nodes.find(l=>l.id===lineId);if(!line)throw new ConnectionError("Order item not found.",404);
 const matched=await matchOrderLine(owner,order,line);if(matched.issue||!matched.artwork)throw new ConnectionError(matched.issue??"Saved artwork is unavailable.",409);
 const money=line.originalUnitPriceSet?.shopMoney;
 if(money?.currencyCode!=="USD"||!/^\d+(\.\d{1,2})?$/.test(money.amount))throw new ConnectionError("This order needs a manual draft-price review.",409);
 const price=Math.round(Number(money.amount)*100);if(!Number.isSafeInteger(price)||price<100||price>100000)throw new ConnectionError("This order needs a manual draft-price review.",409);
 return {artwork:matched.artwork,price,order:{id:order.id,lineId:line.id,name:order.name,quantity:line.quantity}};
}
export async function readFulfillmentOrder(owner:string,orderId:string){
 if(!/^gid:\/\/shopify\/Order\/\d+$/.test(orderId))throw new ConnectionError("Invalid Shopify order.");
 const data=await savedShopifyQuery<{order:ShopifyOrder|null}>(owner,`query ForgeLincPurchasedArtwork($id:ID!){order(id:$id){id name createdAt test cancelledAt displayFinancialStatus displayFulfillmentStatus customAttributes{key value} lineItems(first:50){nodes{id title quantity currentQuantity unfulfilledQuantity variant{id} product{id} customAttributes{key value} originalUnitPriceSet{shopMoney{amount currencyCode}}} pageInfo{hasNextPage}}}}`,{id:orderId},"orders");
 const order=data.order;if(!order||order.id!==orderId)throw new ConnectionError("Order not found.",404);
 return order;
}
export const orderProductionHold=hold;
function uniqueAttribute(attrs:Attribute[],key:string){const matches=attrs.filter(a=>a.key===key);return matches.length===1?matches[0].value:null;}
function hold(order:ShopifyOrder){
 if(order.cancelledAt)return "Cancelled order. Do not produce.";
 if(order.displayFinancialStatus!=="PAID")return "Payment is "+(order.displayFinancialStatus??"unknown").toLowerCase().replaceAll("_"," ")+". Hold production.";
 if(order.lineItems.pageInfo.hasNextPage)return "This order has more than 50 items. Review the complete order in Shopify.";
 if(order.displayFulfillmentStatus!=="UNFULFILLED")return "Fulfillment is "+order.displayFulfillmentStatus.toLowerCase().replaceAll("_"," ")+". Review it in Shopify before doing anything else.";
 if(order.test)return "Shopify test order. Use for artwork review only.";
 return null;
}
export async function matchOrderLine(owner:string,order:ShopifyOrder,line:ShopifyOrderLine):Promise<OrderLineReview>{
 const base={id:line.id,title:line.title,quantity:line.quantity,artwork:null};
 const reference=uniqueAttribute(line.customAttributes,"_ForgeLinc design"),match=reference?.match(refPattern);
 if(!match)return {...base,issue:"No unique saved ForgeLinc design reference. Review this item manually."};
 if(order.lineItems.nodes.filter(l=>uniqueAttribute(l.customAttributes,"_ForgeLinc design")===reference).length!==1)return {...base,issue:"Duplicate design reference in this order. Review the quantities manually."};
 const row=await database().prepare("SELECT config FROM templates WHERE owner=? AND id=?").bind(owner,"checkout:"+match[1]).first<{config:string}>();
 if(!row)return {...base,issue:"The original checkout artwork could not be found. Do not substitute the current team template."};
 try{
  const snapshot=JSON.parse(row.config),parsed=checkoutRequestSchema.parse({id:snapshot.id,items:snapshot.items}),index=Number(match[2]),item=parsed.items[index];
  const expected=snapshot.lines?.[index] as {merchandiseId:string;quantity:number;attributes:Attribute[]}|undefined;
  const team=(snapshot.teams as Team[]|undefined)?.find(t=>t.id===item?.teamId);
  if(parsed.id!==match[1]||!snapshot.result||!item||!team||!expected)return {...base,issue:"The saved checkout is incomplete. Review this item manually."};
  if(uniqueAttribute(order.customAttributes,"ForgeLinc checkout")!==parsed.id)return {...base,issue:"The order does not match the saved checkout reference."};
  if(line.product?.id!==snapshot.product?.id||line.variant?.id!==expected.merchandiseId)return {...base,issue:"The purchased product or size differs from the saved design."};
  if(line.quantity!==item.quantity||line.quantity!==expected.quantity||line.currentQuantity!==line.quantity||line.unfulfilledQuantity!==line.quantity)return {...base,issue:"The quantity was changed, refunded or fulfilled. Review this item in Shopify."};
  if(!expected.attributes.every(a=>uniqueAttribute(line.customAttributes,a.key)===a.value))return {...base,issue:"Personalization details changed after the design was saved. Review before printing."};
  return {...base,issue:null,artwork:{team,config:item.config,size:item.size,quantity:item.quantity}};
 }catch{return {...base,issue:"The saved artwork could not be read. Review this item manually."};}
}
export async function reviewOrders(owner:string,after?:string):Promise<OrderReviewPage>{
 if(after&&after.length>1000)throw new ConnectionError("Invalid order page.");
 const settings=await checkoutSettings(owner),since=new Date(Date.now()-59*86400000).toISOString();
 const data=await savedShopifyQuery<{orders:{nodes:ShopifyOrder[];pageInfo:{hasNextPage:boolean;endCursor:string|null}}}>(owner,query,{after:after||null,query:"created_at:>="+since},"orders");
 const orders:OrderReview[]=[];
 for(const order of data.orders.nodes){
  // New custom checkout orders have their own automatic fulfillment status.
  if(order.customAttributes.some(a=>a.key==="ForgeLinc fulfillment"&&a.value==="automated-v2"))continue;
  const lines=order.lineItems.nodes.filter(l=>l.product?.id==="gid://shopify/Product/"+settings.productId||l.customAttributes.some(a=>a.key==="_ForgeLinc design"));
  if(!lines.length)continue;
  const id=order.id.match(/^gid:\/\/shopify\/Order\/(\d+)$/)?.[1];if(!id)throw new ConnectionError("Shopify returned an invalid order reference.",502);
  orders.push({id:order.id,name:order.name,createdAt:order.createdAt,test:order.test,payment:order.displayFinancialStatus??"UNKNOWN",fulfillment:order.displayFulfillmentStatus,hold:hold(order),url:"https://admin.shopify.com/store/eewwjf-tt/orders/"+id,lines:await Promise.all(lines.map(l=>matchOrderLine(owner,order,l)))});
 }
 return {orders,nextCursor:data.orders.pageInfo.hasNextPage?data.orders.pageInfo.endCursor:null,checkedAt:new Date().toISOString(),scanned:data.orders.nodes.length};
}
