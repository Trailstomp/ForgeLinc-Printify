import {database} from "./storage";
import {ConnectionError,savedShopifyQuery} from "./shopify-connection";
import {storefront,storefrontToken} from "./shopify-checkout";
import {themeLabel} from "./catalog";
import {sameSize,sizeKey} from "./jersey-sizes";
import type {Transfer} from "./printify-transfer-types";
import type {PreparedCheckout} from "./prepared-checkout";

const tag="ForgeLinc-Checkout-Preview-v1";
const permissions=["read_publications","write_publications"];
export const thumbnailPermissionNotice="To show each custom jersey in Shopify checkout, add read_publications and write_publications to the installed ForgeLinc app, approve its updated permissions, then refresh status. Ordering remains available while thumbnails are being set up.";
export function thumbnailPermissionsReady(scopes:string[]){return permissions.every(scope=>scopes.includes(scope));}
type Mapping={productId:string;variantId:string;imageUrl:string;source:string};
type Appearance={lines:PreparedCheckout["lines"];lineProductIds:string[];lineImageUrls:(string|null)[];thumbnailNotice:string|null};
type Image={url:string;altText:string|null};
type PreviewProduct={id:string;handle:string;tags:string[];status:string;variants:{nodes:{id:string;price:string;selectedOptions:{name:string;value:string}[];inventoryItem:{sku:string};image:Image|null}[];pageInfo:{hasNextPage:boolean}};media:{nodes:{id:string;alt:string|null;status:string}[];pageInfo:{hasNextPage:boolean}}};
const fields="id handle tags status variants(first:2){nodes{id price selectedOptions{name value} inventoryItem{sku} image{url altText}} pageInfo{hasNextPage}} media(first:2){nodes{id alt status} pageInfo{hasNextPage}}";
const key=(id:string)=>"checkout-appearance:"+id;
const fail=()=>new ConnectionError("The jersey checkout preview could not be verified. Your print artwork remains saved.",409);
export const checkoutImageKey=(url:string)=>{try{const u=new URL(url);return u.protocol==="https:"&&u.hostname==="cdn.shopify.com"?u.origin+u.pathname:null;}catch{return null;}};

/** The image must come from this verified Printify product and this exact size. */
export function checkoutThumbnail(t:Transfer){
 if(!t.product)return null;
 return t.product.images.find(image=>{
  try{const u=new URL(image.src);return u.protocol==="https:"&&u.hostname==="images.printify.com"&&!u.username&&!u.password&&u.pathname.startsWith(`/mockup/${t.product!.id}/${t.snapshot.variant.id}/`)&&(image.position==="front"||u.searchParams.get("camera_label")==="front");}catch{return false;}
 })?.src??null;
}
async function publication(owner:string,productId:string,token:string|null){
 const r=await savedShopifyQuery<{product:{resourcePublicationsV2:{nodes:{isPublished:boolean;publication:{id:string;name:string}}[];pageInfo:{hasNextPage:boolean}}}|null}>(owner,"query ForgeLincPreviewChannel($id:ID!){product(id:$id){resourcePublicationsV2(first:100,onlyPublished:true){nodes{isPublished publication{id name}} pageInfo{hasNextPage}}}}",{id:productId});
 if(!r.product||r.product.resourcePublicationsV2.pageInfo.hasNextPage)throw fail();
 const channels=r.product.resourcePublicationsV2.nodes.filter(n=>n.isPublished).map(n=>n.publication);
 // Match the existing shared listing's one headless channel. Never broaden
 // publication to other channels or publish personalized names in the store.
 const candidates=channels.filter(p=>token?/headless|gamelinc storefront/i.test(p.name):/^online store$/i.test(p.name));
 if(candidates.length!==1)throw new ConnectionError("Checkout thumbnails need one verified storefront channel for the shared jersey. Check its publishing settings.",409);
 return candidates[0].id;
}
function verifyProduct(p:PreviewProduct,t:Transfer,handle:string,alt:string,mapping:Mapping|null){
 const variant=p.variants.nodes[0];
 if(p.handle!==handle||p.status!=="ACTIVE"||!p.tags.includes(tag)||!p.tags.includes("forgelinc-transfer-"+t.id)||p.variants.nodes.length!==1||p.variants.pageInfo.hasNextPage||variant.inventoryItem.sku!=="FORGELINC-DESIGN-"+t.id||Math.round(Number(variant.price)*100)!==t.snapshot.price||variant.selectedOptions.length!==1||variant.selectedOptions[0].name!=="Size"||!sameSize(variant.selectedOptions[0].value,t.snapshot.variant.size)||p.media.nodes.length!==1||p.media.pageInfo.hasNextPage||p.media.nodes[0].alt!==alt)throw fail();
 if(mapping&&(p.id!==mapping.productId||variant.id!==mapping.variantId))throw fail();
 return variant;
}
async function ensurePreview(owner:string,t:Transfer,publicationId:string,token:string|null):Promise<Mapping>{
 const source=checkoutThumbnail(t);if(!source||!t.snapshot.team||!/^[a-f0-9]{64}$/.test(t.id))throw fail();
 const handle="forgelinc-design-"+t.id,alt=`${t.snapshot.team.name} ${themeLabel(t.snapshot.config)} jersey — ${t.id}`;
 const row=await database().prepare("SELECT config FROM templates WHERE owner=? AND id=?").bind(owner,key(t.id)).first<{config:string}>();
 const mapping:Mapping|null=row?JSON.parse(row.config):null;
 if(mapping&&mapping.source!==source)throw fail();
 const lookup=await savedShopifyQuery<{products:{nodes:PreviewProduct[]}}>(owner,`query ForgeLincPreviewLookup($query:String!){products(first:2,query:$query){nodes{${fields}}}}`,{query:"handle:"+handle});
 if(lookup.products.nodes.length>1||(mapping&&!lookup.products.nodes.length))throw fail();
 let product=lookup.products.nodes[0];
 if(!product){
  // Claim before the remote write. A lost response is recovered by the exact
  // handle; it never results in a second product or overwrites another design.
  const claim=await database().prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO NOTHING RETURNING id").bind(owner,key(t.id)+":claim",JSON.stringify({source}),new Date().toISOString()).all<{id:string}>();
  if(!claim.results.length)throw new ConnectionError("Shopify is still preparing this jersey preview. It will be reused on your next checkout.",409);
  const personal=[t.snapshot.config.playerName,t.snapshot.config.playerNumber?"#"+t.snapshot.config.playerNumber:""].filter(Boolean).join(" ");
  const file={originalSource:source,contentType:"IMAGE",filename:`forgelinc-${t.id}.jpg`,alt};
  const result=await savedShopifyQuery<{productSet:{product:PreviewProduct|null;userErrors:unknown[]}}>(owner,`mutation ForgeLincCreatePreview($input:ProductSetInput!){productSet(input:$input,synchronous:true){product{${fields}} userErrors{field message}}}`,{input:{handle,title:[t.snapshot.team.name,themeLabel(t.snapshot.config),personal].filter(Boolean).join(" · ").slice(0,255),status:"ACTIVE",vendor:"ForgeLinc",productType:"Personalized jersey",tags:[tag,"forgelinc-transfer-"+t.id],descriptionHtml:"<p>Prepared from the exact saved ForgeLinc design for this jersey.</p>",productOptions:[{name:"Size",position:1,values:[{name:sizeKey(t.snapshot.variant.size)}]}],files:[file],variants:[{price:(t.snapshot.price/100).toFixed(2),optionValues:[{optionName:"Size",name:sizeKey(t.snapshot.variant.size)}],file,inventoryPolicy:"CONTINUE",inventoryItem:{sku:"FORGELINC-DESIGN-"+t.id,tracked:false,requiresShipping:true}}]}});
  if(result.productSet.userErrors.length||!result.productSet.product){
   // A definite rejection is safe to retry; ambiguous transport errors retain
   // the claim and must reconcile an existing remote product first.
   if(result.productSet.userErrors.length)await database().prepare("DELETE FROM templates WHERE owner=? AND id=?").bind(owner,key(t.id)+":claim").run();
   throw fail();
  }
  product=result.productSet.product;
 }
 let variant=verifyProduct(product,t,handle,alt,mapping);
 // Media processing is asynchronous. Bounded reads give a new image time to
 // become ready; missing/changed images never masquerade as another design.
 for(let attempt=0;attempt<3&&(!variant.image||product.media.nodes[0].status!=="READY");attempt++){
  const refreshed=await savedShopifyQuery<{product:PreviewProduct|null}>(owner,`query ForgeLincPreviewReady($id:ID!){product(id:$id){${fields}}}`,{id:product.id});
  if(!refreshed.product)throw fail();product=refreshed.product;variant=verifyProduct(product,t,handle,alt,mapping);
 }
 if(!variant.image||variant.image.altText!==alt||!checkoutImageKey(variant.image.url)||product.media.nodes[0].status!=="READY"||(mapping&&checkoutImageKey(mapping.imageUrl)!==checkoutImageKey(variant.image.url)))throw fail();
 const publish=await savedShopifyQuery<{publishablePublish:{userErrors:unknown[]}}>(owner,"mutation ForgeLincPublishPreview($id:ID!,$input:[PublicationInput!]!){publishablePublish(id:$id,input:$input){userErrors{field message}}}",{id:product.id,input:[{publicationId}]});
 if(publish.publishablePublish.userErrors.length)throw fail();
 const visible=await storefront<{node:{id:string;product:{id:string};availableForSale:boolean;price:{amount:string;currencyCode:string};image:Image|null}|null}>(token,"query ForgeLincVisiblePreview($id:ID!){node(id:$id){... on ProductVariant{id product{id} availableForSale price{amount currencyCode} image{url altText}}}}",{id:variant.id});
 const v=visible.node;
 if(!v||v.id!==variant.id||v.product.id!==product.id||!v.availableForSale||v.price.currencyCode!=="USD"||Math.round(Number(v.price.amount)*100)!==t.snapshot.price||!v.image||checkoutImageKey(v.image.url)!==checkoutImageKey(variant.image.url)||v.image.altText!==alt)throw fail();
 const saved={productId:product.id,variantId:variant.id,imageUrl:v.image.url,source};
 await database().prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO NOTHING").bind(owner,key(t.id),JSON.stringify(saved),new Date().toISOString()).run();
 return saved;
}

/** Visual enhancement only: inability to publish an image must not stop an
 * otherwise verified order. Shared checkout products and paid carts are never
 * edited. Each successful preview has its own immutable product and variant. */
export async function prepareCheckoutAppearance(owner:string,s:PreparedCheckout,transfers:Transfer[]):Promise<Appearance>{
 const fallback={lines:s.lines,lineProductIds:s.items.map(()=>s.product.id),lineImageUrls:s.items.map(()=>null),thumbnailNotice:null as string|null};
 try{
  const r=await savedShopifyQuery<{currentAppInstallation:{accessScopes:{handle:string}[]}}>(owner,"query ForgeLincPreviewPermissions{currentAppInstallation{accessScopes{handle}}}",{});
  if(!thumbnailPermissionsReady(r.currentAppInstallation.accessScopes.map(x=>x.handle)))return {...fallback,thumbnailNotice:thumbnailPermissionNotice};
  const token=await storefrontToken(owner),channel=await publication(owner,s.product.id,token);
  const previews:Mapping[]=[];const reused=new Map<string,Mapping>();
  for(const transfer of transfers){let preview=reused.get(transfer.id);if(!preview){preview=await ensurePreview(owner,transfer,channel,token);reused.set(transfer.id,preview);}previews.push(preview);}
  return {lines:s.lines.map((line,i)=>({...line,merchandiseId:previews[i].variantId})),lineProductIds:previews.map(p=>p.productId),lineImageUrls:previews.map(p=>p.imageUrl),thumbnailNotice:null};
 }catch{return {...fallback,thumbnailNotice:"Shopify thumbnails are still being prepared. Your exact designs and print files are saved; checkout can continue."};}
}
