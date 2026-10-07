import {database} from "./storage";
import {ConnectionError,savedShopifyQuery} from "./shopify-connection";
import {storefront,storefrontToken,checkoutStatus} from "./shopify-checkout";
import {credentials,jerseyCatalog} from "./printify-transfers";
import {sizeKey} from "./jersey-sizes";
import {assertOrderAccess} from "./checkout-readiness";
import type {CheckoutProduct} from "./checkout-types";

const settingsId="checkout-catalog-v2";
const handle="forgelinc-custom-jersey";
const tag="ForgeLinc-Automated-Checkout-v2";
export type CatalogSettings={productId:string;price:string;blueprintId:number;providerId:number;updatedAt:string};
export async function savedCatalog(owner:string):Promise<CatalogSettings|null>{
 const row=await database().prepare("SELECT config FROM templates WHERE owner=? AND id=?").bind(owner,settingsId).first<{config:string}>();
 return row?JSON.parse(row.config):null;
}
export const checkoutSku=(blueprint:number,provider:number,size:string)=>`FORGELINC-CUSTOM-${blueprint}-${provider}-${sizeKey(size)}`;
const productFields="id title handle status tags variants(first:100){nodes{id title price selectedOptions{name value} inventoryItem{sku}} pageInfo{hasNextPage}}";
type AdminProduct={id:string;title:string;handle:string;status:string;tags:string[];variants:{nodes:{id:string;title:string;price:string;selectedOptions:{name:string;value:string}[];inventoryItem:{sku:string}}[];pageInfo:{hasNextPage:boolean}}};
export async function automatedCatalog(owner:string):Promise<CheckoutProduct>{
 const settings=await savedCatalog(owner);
 if(!settings)throw new ConnectionError("Set up all-team checkout in Connections first. Your jersey design is saved.",409);
 const admin=await savedShopifyQuery<{product:AdminProduct|null}>(owner,`query ForgeLincCustomCatalog($id:ID!){product(id:$id){${productFields}}}`,{id:settings.productId});
 if(!admin.product||!admin.product.tags.includes(tag)||admin.product.variants.pageInfo.hasNextPage)throw new ConnectionError("The dedicated ForgeLinc checkout product could not be verified. Check Connections.",409);
 const p=await storefront<{product:CheckoutProduct&{variants:{nodes:{id:string;title:string;availableForSale:boolean;selectedOptions:{name:string;value:string}[];price:{amount:string;currencyCode:string}}[];pageInfo:{hasNextPage:boolean}};onlineStoreUrl:string|null}}>(await storefrontToken(owner),"query ForgeLincPreparedProduct($id:ID!){product(id:$id){id title onlineStoreUrl variants(first:100){nodes{id title availableForSale selectedOptions{name value} price{amount currencyCode}} pageInfo{hasNextPage}}}}",{id:settings.productId});
 if(!p.product||p.product.variants.pageInfo.hasNextPage)throw new ConnectionError("Make the ForgeLinc custom jersey available to the storefront channel used by your saved token. This is a one-time product setup.",409);
 const variants=p.product.variants.nodes.map(v=>{
  const size=v.selectedOptions.find(o=>/^sizes?$/i.test(o.name))?.value??v.title;
  const match=admin.product!.variants.nodes.find(a=>a.id===v.id);
  if(!match||match.inventoryItem.sku!==checkoutSku(settings.blueprintId,settings.providerId,size))throw new ConnectionError("Checkout contains a size linked to different fulfillment. Refresh all-team checkout in Connections.",409);
  return {id:v.id,title:v.title,size:sizeKey(size),available:v.availableForSale,amount:v.price.amount,currency:v.price.currencyCode};
 });
 return {id:p.product.id,title:p.product.title,url:p.product.onlineStoreUrl,variants};
}
export async function customCheckoutStatus(owner:string){
 const settings=await savedCatalog(owner);let product:CheckoutProduct|null=null;const issues:string[]=[];
 let providerSizes:string[]=[],grantedScopes:string[]=[];
 if(settings){
  // Check independent prerequisites even if the storefront is not published yet.
  const checks=await Promise.allSettled([
   automatedCatalog(owner),assertOrderAccess(owner),credentials(owner).then(jerseyCatalog),
   savedShopifyQuery<{currentAppInstallation:{accessScopes:{handle:string}[]}}>(owner,"query ForgeLincCheckoutPermissions{currentAppInstallation{accessScopes{handle}}}",{})
  ]);
  if(checks[0].status==="fulfilled")product=checks[0].value;else issues.push(checks[0].reason instanceof ConnectionError?checks[0].reason.message:"Could not verify the checkout product.");
  if(checks[1].status==="rejected")issues.push(checks[1].reason instanceof ConnectionError?checks[1].reason.message:"Could not verify order access.");
  if(checks[2].status==="fulfilled")providerSizes=checks[2].value.variants.map(v=>sizeKey(v.size));else issues.push("Could not read the current Printify size catalog.");
  if(checks[3].status==="fulfilled")grantedScopes=checks[3].value.currentAppInstallation.accessScopes.map(s=>s.handle).filter(s=>/^[a-z_]+$/.test(s));
 }
 return {configured:!!settings,ready:!issues.length&&!!product&&product.variants.some(v=>v.available),settings,product,error:issues.join(" ")||null,issues,providerSizes,grantedScopes};
}
/** Create one independent Shopify checkout product. Never repurpose a Printify-linked listing. */
export async function setupCustomCatalog(owner:string,requestedPrice?:string){
 const previous=await savedCatalog(owner),catalog=await jerseyCatalog(await credentials(owner));
 let price=requestedPrice??previous?.price;
 if(!price){const old=await checkoutStatus(owner);const source=old.product?.variants.find(v=>v.currency==="USD");price=source?.amount;}
 if(!price||!/^\d+(\.\d{1,2})?$/.test(price)||Number(price)<1||Number(price)>1000)throw new ConnectionError("Enter the jersey selling price in Connections before setting up checkout.",409);
 price=Number(price).toFixed(2);
 const sizes=[...new Set(catalog.variants.map(v=>sizeKey(v.size)))];
 if(sizes.length!==catalog.variants.length)throw new ConnectionError("The provider returned more than one jersey variant for a size. Resolve the mapping before checkout.",409);
 const found=await savedShopifyQuery<{products:{nodes:AdminProduct[]}}>(owner,`query ForgeLincCheckoutLookup($query:String!){products(first:2,query:$query){nodes{${productFields}}}}`,{query:`handle:${handle}`});
 if(found.products.nodes.length>1)throw new ConnectionError("More than one custom checkout product was found.",409);
 const current=found.products.nodes[0];
 if(current&&!current.tags.includes(tag))throw new ConnectionError("The custom checkout handle is already used by another product. No existing product was changed.",409);
 if(current?.variants.pageInfo.hasNextPage)throw new ConnectionError("Load the complete checkout catalog before changing it.",409);
 // productSet reconciles lists. Preserve existing variant IDs, prices, and sizes.
 const variants:{id?:string;price:string;optionValues:{optionName:string;name:string}[];inventoryPolicy:string;inventoryItem:{sku:string;tracked:boolean;requiresShipping:boolean}}[]=(current?.variants.nodes??[]).map(v=>({id:v.id,price:v.price,optionValues:v.selectedOptions.map(o=>({optionName:o.name,name:o.value})),inventoryPolicy:"CONTINUE",inventoryItem:{sku:v.inventoryItem.sku,tracked:false,requiresShipping:true}}));
 for(const size of sizes){
  const matching=variants.filter(v=>v.optionValues.some(o=>/^sizes?$/i.test(o.optionName)&&sizeKey(o.name)===size));
  if(matching.length>1)throw new ConnectionError("Duplicate Shopify size mappings. Resolve them before syncing.",409);
  const sku=checkoutSku(catalog.blueprint.id,catalog.provider.id,size);
  if(matching.length){if(matching[0].inventoryItem.sku!==sku)throw new ConnectionError("An existing checkout SKU was changed. Review it before syncing.",409);if(requestedPrice)matching[0].price=price;}
  else variants.push({price,optionValues:[{optionName:"Size",name:size}],inventoryPolicy:"CONTINUE",inventoryItem:{sku,tracked:false,requiresShipping:true}});
 }
 const values=[...new Set(variants.flatMap(v=>v.optionValues.map(o=>o.name)))];
 const result=await savedShopifyQuery<{productSet:{product:AdminProduct|null;userErrors:{field:string[];message:string}[]}}>(owner,`mutation ForgeLincSetupCheckout($input:ProductSetInput!){productSet(input:$input,synchronous:true){product{${productFields}} userErrors{field message}}}`,{input:{...(current?{id:current.id}:{}),title:"ForgeLinc Custom Team Jersey",handle,status:"ACTIVE",vendor:"ForgeLinc",productType:"Custom jersey",tags:[tag],descriptionHtml:"<p>Made to order from your saved ForgeLinc design, including your team colors, artwork, stripes and personalization.</p>",productOptions:[{name:"Size",position:1,values:values.map(name=>({name}))}],variants}});
 if(result.productSet.userErrors.length||!result.productSet.product)throw new ConnectionError("Shopify could not create the all-team jersey. Verify write_products access and the product options.",409);
 const settings:CatalogSettings={productId:result.productSet.product.id,price,blueprintId:catalog.blueprint.id,providerId:catalog.provider.id,updatedAt:new Date().toISOString()};
 await database().prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at").bind(owner,settingsId,JSON.stringify(settings),settings.updatedAt).run();
 // Publish only the shared checkout item to the channel used for the saved token.
 // Headless is preferred; Online Store is the tokenless fallback. No custom artwork is published.
 let publicationNotice:string|null=null;
 try{
  const channels=await savedShopifyQuery<{publications:{nodes:{id:string;name:string}[]}}>(owner,"query ForgeLincCheckoutChannels{publications(first:100){nodes{id name}}}",{});
  const hasToken=!!await storefrontToken(owner),preferred=channels.publications.nodes.filter(p=>hasToken?/headless/i.test(p.name):/^online store$/i.test(p.name));
  if(preferred.length!==1)throw new Error("channel");
  const published=await savedShopifyQuery<{publishablePublish:{userErrors:unknown[]}}>(owner,"mutation ForgeLincCheckoutPublish($id:ID!,$input:[PublicationInput!]!){publishablePublish(id:$id,input:$input){userErrors{field message}}}",{id:settings.productId,input:[{publicationId:preferred[0].id}]});
  if(published.publishablePublish.userErrors.length)throw new Error("publication");
 }catch{publicationNotice="The checkout product and sizes are saved. Make it available to the storefront channel used by your saved token in Shopify, or grant ForgeLinc read_publications and write_publications and sync again.";}
 return {...await customCheckoutStatus(owner),publicationNotice};
}
