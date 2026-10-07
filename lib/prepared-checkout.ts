import {database} from "./storage";
import {ConnectionError} from "./shopify-connection";
import {checkoutRequestSchema,cartLines,storefront,storefrontToken} from "./shopify-checkout";
import {automatedCatalog,savedCatalog} from "./checkout-catalog";
import {ownerTeams} from "./team-storage";
import {validateArtworkOwnership} from "./artwork-storage";
import {credentials,jerseyCatalog,saveTransferSnapshot,readTransfer,printifyApi} from "./printify-transfers";
import {productMatches} from "./fulfillment-review";
import {upgradeSleeveArtwork} from "./catalog";
import {sameSize,sizeKey} from "./jersey-sizes";
import {assertOrderAccess} from "./checkout-readiness";
import type {CheckoutResult,CheckoutProduct,CheckoutItem} from "./checkout-types";
import type {Transfer} from "./printify-transfer-types";
import type {Team} from "./catalog";

export type PreparedCheckout={id:string;items:CheckoutItem[];teams:Team[];product:CheckoutProduct;lines:ReturnType<typeof cartLines>;transferIds:string[];selections:CheckoutResult["selections"];createdAt:string;fulfillment:"automated-v2";result?:CheckoutResult};
const key=(id:string)=>"prepared-checkout:"+id;
export async function readPreparedCheckout(owner:string,id:string):Promise<PreparedCheckout|null>{
 const row=await database().prepare("SELECT config FROM templates WHERE owner=? AND id=?").bind(owner,key(id)).first<{config:string}>();
 return row?JSON.parse(row.config):null;
}
export function canonicalItems(input:CheckoutItem[]){return input.map(item=>({...item,size:sizeKey(item.size),config:upgradeSleeveArtwork(item.config)}));}
async function transfersFor(owner:string,s:PreparedCheckout){
 const transfers:Transfer[]=[];
 for(const id of s.transferIds){const t=await readTransfer(owner,id);if(!t)throw new ConnectionError("Prepared artwork is missing. Start checkout again.",409);transfers.push(t);}
 return transfers;
}
export async function prepareCheckout(owner:string,input:unknown){
 const parsed=checkoutRequestSchema.parse(input);parsed.items=canonicalItems(parsed.items);
 const existing=await readPreparedCheckout(owner,parsed.id);
 if(existing){if(JSON.stringify(existing.items)!==JSON.stringify(parsed.items))throw new ConnectionError("Your bag changed. Prepare checkout again.",409);return {id:existing.id,transfers:await transfersFor(owner,existing)};}
 await validateArtworkOwnership(owner,parsed.items.map(i=>i.config));
 const teams=await ownerTeams(owner),product=await automatedCatalog(owner),connection=await credentials(owner),catalog=await jerseyCatalog(connection),settings=await savedCatalog(owner);
 if(settings?.blueprintId!==catalog.blueprint.id||settings.providerId!==catalog.provider.id)throw new ConnectionError("The jersey provider changed. Sync checkout sizes in Connections.",409);
 const lines=cartLines(parsed.items,product,parsed.id,new Map(teams.map(t=>[t.id,t.name])));
 const transfers:Transfer[]=[];
 for(const item of parsed.items){
  const team=teams.find(t=>t.id===item.teamId);if(!team)throw new ConnectionError("Choose a team from your saved catalog.");
  const matches=catalog.variants.filter(v=>sameSize(v.size,item.size)),prices=product.variants.filter(v=>sameSize(v.size,item.size));
  if(matches.length!==1||prices.length!==1||!prices[0].available)throw new ConnectionError("Size "+item.size+" has no unique available provider mapping. Refresh sizes.",409);
  if(prices[0].currency!=="USD")throw new ConnectionError("This Printify checkout currently requires USD pricing.",409);
  const price=Math.round(Number(prices[0].amount)*100);
  if(!Number.isSafeInteger(price)||price<100||price>100000)throw new ConnectionError("Check the jersey price in Connections.",409);
  transfers.push(await saveTransferSnapshot(owner,{teamId:team.id,team,config:item.config,shopId:connection.shopId,catalog:{...catalog,variants:matches},variant:matches[0],price}));
 }
 const now=new Date().toISOString(),selections=parsed.items.map((item,i)=>({draftId:"selection:checkout:"+parsed.id+":"+i,teamId:item.teamId,size:item.size}));
 const snapshot:PreparedCheckout={...parsed,teams:teams.filter(t=>parsed.items.some(i=>i.teamId===t.id)),product,lines:lines.map(line=>({...line,attributes:line.attributes.map(a=>a.key==="_ForgeLinc fulfillment"?{...a,value:"automated-v2"}:a)})),transferIds:transfers.map(t=>t.id),selections,createdAt:now,fulfillment:"automated-v2"};
 await database().batch([database().prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO NOTHING").bind(owner,key(parsed.id),JSON.stringify(snapshot),now),...selections.map((s,i)=>database().prepare("INSERT INTO drafts(owner,id,team_id,config,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,id) DO NOTHING").bind(owner,s.draftId,s.teamId,JSON.stringify(parsed.items[i].config),now))]);
 const saved=(await readPreparedCheckout(owner,parsed.id))!;
 if(JSON.stringify(saved.items)!==JSON.stringify(parsed.items))throw new ConnectionError("A different bag already uses this checkout reference.",409);
 return {id:saved.id,transfers:await transfersFor(owner,saved)};
}
export async function verifyPreparedProducts(owner:string,s:PreparedCheckout){
 const transfers=await transfersFor(owner,s),connection=await credentials(owner);
 for(let i=0;i<transfers.length;i++){
  const t=transfers[i],item=s.items[i];
  if(t.status!=="created"||!t.product||t.snapshot.shopId!==connection.shopId||t.snapshot.teamId!==item.teamId||!sameSize(t.snapshot.variant.size,item.size)||JSON.stringify(t.snapshot.config)!==JSON.stringify(item.config))throw new ConnectionError("The exact artwork and size must finish transferring before checkout.",409);
  const row=await database().prepare("SELECT id,snapshot,uploads,product_id,product,updated_at FROM printify_transfers WHERE owner=? AND id=?").bind(owner,t.id).first<any>();
  const remote=await printifyApi(connection,`shops/${connection.shopId}/products/${encodeURIComponent(t.product.id)}.json`);
  if(!row||!productMatches(remote,row,t.snapshot))throw new ConnectionError("Printify’s artwork differs from your saved design. Prepare a new transfer before ordering.",409);
 }
 return transfers;
}
export async function completePreparedCheckout(owner:string,id:string):Promise<CheckoutResult>{
 const s=await readPreparedCheckout(owner,id);if(!s)throw new ConnectionError("Prepare your jersey artwork first.",409);
 if(s.result)return s.result;
 await assertOrderAccess(owner);
 await verifyPreparedProducts(owner,s);
 const product=await automatedCatalog(owner);
 if(product.id!==s.product.id)throw new ConnectionError("Checkout settings changed. Start checkout again.",409);
 for(const item of s.items){const variant=product.variants.find(v=>sameSize(v.size,item.size));if(!variant?.available)throw new ConnectionError("Size "+item.size+" is no longer available.",409);const prior=s.product.variants.find(v=>v.id===variant.id);if(!prior||prior.amount!==variant.amount||prior.currency!==variant.currency)throw new ConnectionError("The jersey price changed. Start checkout again to review it.",409);}
 const r=await storefront<{cartCreate:{cart:{checkoutUrl:string;lines:{nodes:{quantity:number;merchandise:{id:string};attributes:{key:string;value:string}[]}[]}}|null;userErrors:unknown[];warnings:unknown[]}}>(await storefrontToken(owner),"mutation ForgeLincPreparedCheckout($input:CartInput!){cartCreate(input:$input){cart{checkoutUrl lines(first:100){nodes{quantity merchandise{... on ProductVariant{id}} attributes{key value}}}} userErrors{message} warnings{code}}}",{input:{lines:s.lines,attributes:[{key:"ForgeLinc checkout",value:s.id},{key:"ForgeLinc fulfillment",value:"automated-v2"}]}});
 const cart=r.cartCreate.cart;
 if(!cart||r.cartCreate.userErrors.length||r.cartCreate.warnings?.length||cart.lines.nodes.length!==s.lines.length||s.lines.some(line=>!cart.lines.nodes.some(v=>v.quantity===line.quantity&&v.merchandise.id===line.merchandiseId&&line.attributes.every(a=>v.attributes.some(b=>a.key===b.key&&a.value===b.value)))))throw new ConnectionError("Shopify did not retain every custom design and quantity. Checkout was not opened.",502);
 const url=new URL(cart.checkoutUrl);if(url.protocol!=="https:")throw new ConnectionError("Shopify returned an invalid checkout link.",502);
 const result={id:s.id,checkoutUrl:url.href,selections:s.selections};
 // Keep the original immutable artwork for every paid order, including old open carts.
 await database().prepare("UPDATE templates SET config=json_set(config,'$.result',json(?)),updated_at=? WHERE owner=? AND id=? AND json_extract(config,'$.result') IS NULL").bind(JSON.stringify(result),new Date().toISOString(),owner,key(id)).run();
 return (await readPreparedCheckout(owner,id))!.result!;
}
