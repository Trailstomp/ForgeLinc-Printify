import {z} from "zod";
import {database} from "./storage";
import {ConnectionError,SHOPIFY_DOMAIN,savedShopifyQuery,seal,unseal} from "./shopify-connection";
import {CHECKOUT_PRODUCT_ID,type CheckoutProduct,type CheckoutStatus,type CheckoutResult} from "./checkout-types";
import {configSchema,themeLabel} from "./catalog";
import {ownerTeams} from "./team-storage";
import {validateArtworkOwnership} from "./artwork-storage";
import {sameSize} from "./jersey-sizes";

const settingsId="checkout-product-v1",provider="shopify-storefront";
type Settings={productId:string;teamId:string};
const settingsSchema=z.object({productId:z.string().regex(/^\d{8,20}$/),teamId:z.string().min(1).max(100)}).strict();
export const checkoutRequestSchema=z.object({id:z.string().uuid(),items:z.array(z.object({teamId:z.string().max(100),size:z.string().min(1).max(80),quantity:z.number().int().min(1).max(99),config:configSchema}).strict()).min(1).max(10)}).strict();
export async function checkoutSettings(owner:string):Promise<Settings>{const row=await database().prepare("SELECT config FROM templates WHERE owner=? AND id=?").bind(owner,settingsId).first<{config:string}>();return row?settingsSchema.parse(JSON.parse(row.config)):{productId:CHECKOUT_PRODUCT_ID,teamId:"dayton-eagles"};}
export async function storefrontToken(owner:string){const row=await database().prepare("SELECT sealed_secret FROM shop_connections WHERE owner=? AND provider=?").bind(owner,provider).first<{sealed_secret:string}>();return row?(await unseal(owner+":storefront",row.sealed_secret)).clientSecret:null;}
export async function storefront<T>(token:string|null,query:string,variables:unknown):Promise<T>{
 let response:Response;try{response=await fetch(`https://${SHOPIFY_DOMAIN}/api/2026-07/graphql.json`,{method:"POST",headers:{"Content-Type":"application/json",...(token?{"X-Shopify-Storefront-Access-Token":token}:{})},body:JSON.stringify({query,variables}),redirect:"manual",signal:AbortSignal.timeout(20000),cache:"no-store"});}catch{throw new ConnectionError("Shopify checkout could not be reached. Try again.",502);}
 const result=await response.json().catch(()=>null) as {data?:T;errors?:{message?:string}[]}|null;
 if(result?.errors?.some(e=>e.message?.includes("Online Store channel is locked")))throw new ConnectionError("Shopify says the Online Store channel is locked. Add a public Storefront API token from your Shopify Headless channel, or finish the Online Store setup, then verify again.",409);
 if(!response.ok||result?.errors?.length||!result?.data)throw new ConnectionError(token?"Shopify Storefront access failed. Check the public Storefront token and product availability for that channel.":"Shopify Storefront access is unavailable. Add a public Storefront token, then verify again.",409);
 return result.data;
}
type RawProduct={id:string;title:string;onlineStoreUrl:string|null;variants:{nodes:{id:string;title:string;availableForSale:boolean;selectedOptions:{name:string;value:string}[];price:{amount:string;currencyCode:string}}[];pageInfo:{hasNextPage:boolean}}};
const productQuery="query ForgeLincCheckoutProduct($id:ID!){product(id:$id){id title onlineStoreUrl variants(first:100){nodes{id title availableForSale selectedOptions{name value} price{amount currencyCode}} pageInfo{hasNextPage}}}}";
async function product(settings:Settings,token:string|null):Promise<CheckoutProduct>{
 const r=await storefront<{product:RawProduct|null}>(token,productQuery,{id:"gid://shopify/Product/"+settings.productId});
 if(!r.product)throw new ConnectionError("This jersey is not available to the Shopify storefront channel. Make the product available to that channel, then verify again.",409);
 if(r.product.variants.pageInfo.hasNextPage)throw new ConnectionError("This product needs more size mappings than this jersey connector supports.",409);
 return {id:r.product.id,title:r.product.title,url:r.product.onlineStoreUrl,variants:r.product.variants.nodes.map(v=>{const size=v.selectedOptions.find(o=>/^(size|sizes)$/i.test(o.name))?.value;return {id:v.id,title:v.title,size:size??v.title,available:v.availableForSale,amount:v.price.amount,currency:v.price.currencyCode};})};
}
export async function checkoutStatus(owner:string):Promise<CheckoutStatus>{
 const settings=await checkoutSettings(owner),token=await storefrontToken(owner);let adminProduct:CheckoutStatus["adminProduct"]=null,error:string|null=null,p:CheckoutProduct|null=null;
 try{const r=await savedShopifyQuery<{product:{title:string;status:string;variants:{nodes:{title:string}[]}}|null}>(owner,"query ForgeLincLinkedProduct($id:ID!){product(id:$id){title status variants(first:100){nodes{title}}}}",{id:"gid://shopify/Product/"+settings.productId});if(r.product)adminProduct={title:r.product.title,status:r.product.status,sizes:r.product.variants.nodes.map(v=>v.title)};}catch(e){error=e instanceof ConnectionError?e.message:"Shopify product access is unavailable.";}
 try{p=await product(settings,token);error=null;}catch(e){error=e instanceof ConnectionError?e.message:"Shopify storefront verification failed.";}
 return {...settings,product:p,adminProduct,tokenConfigured:!!token,ready:!!p&&p.variants.some(v=>v.available),error};
}
export async function configureCheckout(owner:string,input:unknown){
 const parsed=z.object({productId:settingsSchema.shape.productId,token:z.string().trim().min(10).max(4096).optional()}).strict().parse(input);
 const settings={...(await checkoutSettings(owner)),productId:parsed.productId},token=parsed.token??await storefrontToken(owner);
 // Verify before replacing a working token or product mapping.
 await product(settings,token);const now=new Date().toISOString(),db=database();
 const statements=[db.prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at").bind(owner,settingsId,JSON.stringify(settings),now)];
 if(parsed.token)statements.push(db.prepare("INSERT INTO shop_connections(owner,provider,sealed_secret,summary,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,provider) DO UPDATE SET sealed_secret=excluded.sealed_secret,summary=excluded.summary,updated_at=excluded.updated_at").bind(owner,provider,await seal(owner+":storefront",{clientSecret:parsed.token}),JSON.stringify({domain:SHOPIFY_DOMAIN,checkedAt:now}),now));
 await db.batch(statements);return checkoutStatus(owner);
}
export function cartLines(items:z.infer<typeof checkoutRequestSchema>["items"],p:CheckoutProduct,id:string,teamNames:Map<string,string>){
 return items.map((item,i)=>{const matches=p.variants.filter(v=>sameSize(v.size,item.size));if(matches.length!==1||!matches[0].available)throw new ConnectionError("Size "+item.size+" is unavailable or needs a unique Shopify mapping. Check the published product's sizes.",409);
  return {merchandiseId:matches[0].id,quantity:item.quantity,attributes:[{key:"Team",value:teamNames.get(item.teamId)!},{key:"Theme",value:themeLabel(item.config)},{key:"Front artwork",value:item.config.frontLogoLabel},{key:"Player name",value:item.config.playerName||"None"},{key:"Player number",value:item.config.playerNumber||"None"},{key:"_ForgeLinc design",value:id+":"+i},{key:"_ForgeLinc fulfillment",value:"Artwork review required"}]};
 });
}
export async function previewCheckout(owner:string,input:unknown):Promise<CheckoutResult>{
 const parsed=checkoutRequestSchema.parse(input),settings=await checkoutSettings(owner);
 if(parsed.items.some(i=>i.teamId!==settings.teamId))throw new ConnectionError("This first checkout connection is for Dayton Eagles. Remove other teams from the preview bag before testing.",409);
 await validateArtworkOwnership(owner,parsed.items.map(i=>i.config));const teams=await ownerTeams(owner);
 if(parsed.items.some(i=>!teams.some(t=>t.id===i.teamId)))throw new ConnectionError("Unknown team.");
 const db=database(),key="checkout:"+parsed.id,existing=await db.prepare("SELECT config FROM templates WHERE owner=? AND id=?").bind(owner,key).first<{config:string}>();
 if(existing){const record=JSON.parse(existing.config);if(JSON.stringify(record.items)!==JSON.stringify(parsed.items))throw new ConnectionError("The bag changed. Start a new checkout preview.",409);if(record.result)return record.result;}
 const token=await storefrontToken(owner),p=await product(settings,token),lines=cartLines(parsed.items,p,parsed.id,new Map(teams.map(t=>[t.id,t.name]))),now=new Date().toISOString();
 const selections=parsed.items.map((i,n)=>({draftId:"selection:checkout:"+parsed.id+":"+n,teamId:i.teamId,size:i.size}));
 const snapshot={id:parsed.id,items:parsed.items,teams:teams.filter(t=>parsed.items.some(i=>i.teamId===t.id)),product:p,lines,selections,createdAt:now,status:"checkout-preview",fulfillment:"not-connected"};
 await db.batch([db.prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO NOTHING").bind(owner,key,JSON.stringify(snapshot),now),...selections.map((s,i)=>db.prepare("INSERT INTO drafts(owner,id,team_id,config,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,id) DO NOTHING").bind(owner,s.draftId,s.teamId,JSON.stringify(parsed.items[i].config),now))]);
 const r=await storefront<{cartCreate:{cart:{checkoutUrl:string;lines:{nodes:{quantity:number;merchandise:{id:string};attributes:{key:string;value:string}[]}[]}}|null;userErrors:{message:string}[];warnings:unknown[]}}>(token,"mutation ForgeLincCheckout($input:CartInput!){cartCreate(input:$input){cart{checkoutUrl lines(first:100){nodes{quantity merchandise{... on ProductVariant{id}} attributes{key value}}}} userErrors{message} warnings{code}}}",{input:{lines,attributes:[{key:"ForgeLinc checkout",value:parsed.id}]}});
 const result=r.cartCreate;if(result.userErrors.length||result.warnings?.length||!result.cart)throw new ConnectionError("Shopify could not add every jersey as selected. Refresh the product sizes and try again.",409);
 if(result.cart.lines.nodes.length!==lines.length||lines.some(l=>!result.cart!.lines.nodes.some(n=>n.quantity===l.quantity&&n.merchandise.id===l.merchandiseId&&l.attributes.every(a=>n.attributes.some(b=>a.key===b.key&&a.value===b.value)))))throw new ConnectionError("Shopify did not retain every design detail. The checkout was not opened.",502);
 const url=new URL(result.cart.checkoutUrl);if(url.protocol!=="https:")throw new ConnectionError("Shopify returned an invalid checkout link.",502);
 const completed={id:parsed.id,checkoutUrl:url.href,selections};await db.prepare("UPDATE templates SET config=?,updated_at=? WHERE owner=? AND id=?").bind(JSON.stringify({...snapshot,result:completed}),new Date().toISOString(),owner,key).run();return completed;
}
