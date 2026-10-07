import {ownerTeam} from "./team-storage";
import {sameSize} from "./jersey-sizes";
import {database} from "./storage";
import {ConnectionError} from "./shopify-connection";
import {readPrintifyConnection,unsealPrintify} from "./printify-connection";
import {purchasedArtwork} from "./shopify-orders";
import {validateArtworkOwnership} from "./artwork-storage";
import {panels,themeLabel,configSchema,draftKey,getTeam,upgradeSleeveArtwork,type PanelId} from "./catalog";
import type {JerseyCatalog,PrintArea,TransferVariant,TransferSnapshot,TransferProduct,Transfer} from "./printify-transfer-types";
type Credential={token:string;shopId:number};
type Row={id:string;snapshot:string;uploads:string;status:Transfer["status"];product_id:string|null;product:string|null;updated_at:string};
type ImageUpload={id:string;width:number;height:number};
export class PrintifyRequestError extends ConnectionError {constructor(message:string,public uncertain=false,status=502){super(message,status);}}
export async function credentials(owner:string):Promise<Credential>{const record=await readPrintifyConnection(owner);if(!record)throw new ConnectionError("Connect Printify before sending a draft.",409);return unsealPrintify(owner,record.sealed_secret);}
export async function printifyApi(c:Credential,path:string,body?:unknown):Promise<any>{
 // Callers construct provider paths server-side. Tokens never reach the browser.
 let r:Response;
 try{r=await fetch("https://api.printify.com/v1/"+path,{method:body===undefined?"GET":"POST",headers:{Authorization:"Bearer "+c.token,"User-Agent":"ForgeLinc/1.0","Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(45000)});}
 catch{throw new PrintifyRequestError("Printify did not confirm the request. Check the transfer status before trying again.",true);}
 if(r.status>=300&&r.status<400){await r.body?.cancel();throw new PrintifyRequestError("Printify redirected the request. Transfer stopped.");}
 if(!r.ok){
  let message="Printify could not complete this step. Please retry.";
  if(r.status===401)message="Your Printify token expired or was rejected. Reconnect Printify.";
  if(r.status===403)message=path.includes("/orders")?"Your Printify token needs orders.read and orders.write. Update it in Connections.":"Your Printify token needs catalog.read, products.read, products.write and uploads.write. Update it in Connections.";
  if(r.status===429)message="Printify is rate limiting requests. Wait a moment, then resume.";
  if(r.status===400||r.status===422)message=path.includes("/orders")?"Printify rejected the order. Check its delivery address, available size and Printify payment method.":"Printify rejected the panel or product settings. Check the selected size and image quality before retrying.";
  if((r.status===400||r.status===422)&&path.includes("/orders")){
   const detail=await r.json().catch(()=>null) as {code?:unknown;message?:unknown;errors?:{reason?:unknown;code?:unknown}}|null;
   const code=detail?.code??detail?.errors?.code;
   let reason=[detail?.message,detail?.errors?.reason].filter((v):v is string=>typeof v==="string").join(" ").replaceAll(c.token,"[redacted]");
   const address=(body as {address_to?:Record<string,unknown>}|undefined)?.address_to;
   for(const value of Object.values(address??{}))if(typeof value==="string"&&value.length>3)reason=reason.replaceAll(value,"[delivery value]");
   if(reason||typeof code==="number")message=`Printify rejected the order${typeof code==="number"?" (code "+code+")":""}. ${reason.slice(0,1200)}`.trim();
  }
  throw new PrintifyRequestError(message,r.status>=500,r.status>=500?502:r.status);
 }
 if(r.status===204)return {};
 try{const text=await r.text();return text?JSON.parse(text):{};}catch{throw new PrintifyRequestError("Printify returned an incomplete response. Check the transfer status.",true);}
}
const api=printifyApi;
const normalized=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,"");
export function mapAreas(raw:unknown):PrintArea[]{
 if(!Array.isArray(raw))throw new ConnectionError("The provider did not return print areas.",502);
 const mapping:Record<string,PanelId>={front:"front",back:"back",leftsleeve:"left-sleeve",rightsleeve:"right-sleeve",sleeveleft:"left-sleeve",sleeveright:"right-sleeve",collar:"collar"};
 const result:PrintArea[]=[];
 for(const p of raw){
  if(!p||typeof p.position!=="string")throw new ConnectionError("The provider returned an invalid print area.",502);
  const panel=mapping[normalized(p.position)];
  if(!panel||result.some(a=>a.panel===panel))throw new ConnectionError("This provider's print areas do not match the five-panel jersey template.",409);
  if(!Number.isSafeInteger(p.width)||!Number.isSafeInteger(p.height)||p.width<1||p.height<1||p.width>12000||p.height>12000||p.width*p.height>50000000)throw new ConnectionError("The provider returned unsupported print dimensions.",409);
  if(p.decoration_method&& !/^(sublimation|dye_sublimation|all_over_print|aop)$/i.test(p.decoration_method))throw new ConnectionError("The provider returned a different printing method. Check the jersey catalog.",409);
  result.push({panel,position:p.position,width:p.width,height:p.height,...(p.decoration_method?{decoration_method:p.decoration_method}:{})});
 }
 if(result.length!==5||panels.some(p=>!result.some(a=>a.panel===p.id)))throw new ConnectionError("All five print areas are required: front, back, both sleeves and collar.",409);
 return panels.map(p=>result.find(a=>a.panel===p.id)!);
}
export async function jerseyCatalog(c:Credential):Promise<JerseyCatalog>{
 const all=await api(c,"catalog/blueprints.json");
 if(!Array.isArray(all))throw new ConnectionError("Printify's catalog is unavailable.",502);
 const matches=all.filter(b=>typeof b.title==="string"&&normalized(b.title)==="menssportsjerseyaop");
 if(matches.length!==1||!Number.isSafeInteger(matches[0].id))throw new ConnectionError("Could not uniquely locate Men's Sports Jersey (AOP) in Printify's current catalog.",409);
 const blueprint={id:matches[0].id,title:matches[0].title};
 const providers=await api(c,`catalog/blueprints/${blueprint.id}/print_providers.json`);
 if(!Array.isArray(providers))throw new ConnectionError("Printify's provider list is unavailable.",502);
 const matchesP=providers.filter(p=>typeof p.title==="string"&&normalized(p.title)==="miamisublimation");
 if(matchesP.length!==1||!Number.isSafeInteger(matchesP[0].id))throw new ConnectionError("Miami Sublimation is not available for this jersey. Transfer paused.",409);
 const provider={id:matchesP[0].id,title:matchesP[0].title};
 const result=await api(c,`catalog/blueprints/${blueprint.id}/print_providers/${provider.id}/variants.json`);
 if(!Array.isArray(result.variants))throw new ConnectionError("Printify did not return jersey sizes.",502);
 const variants:TransferVariant[]=result.variants.map((v:any)=>{if(!Number.isSafeInteger(v.id)||typeof v.title!=="string")throw new ConnectionError("Invalid jersey size returned by Printify.",502);return {id:v.id,title:v.title,size:String(v.options?.size??v.title),areas:mapAreas(v.placeholders)};});
 if(!variants.length)throw new ConnectionError("This jersey has no available sizes right now.",409);
 return {blueprint,provider,variants};
}
async function row(owner:string,id:string){return (await database().prepare("SELECT id,snapshot,uploads,status,product_id,product,updated_at FROM printify_transfers WHERE owner=? AND id=?").bind(owner,id).all<Row>()).results[0]??null;}
function publicRow(r:Row):Transfer{return {id:r.id,snapshot:JSON.parse(r.snapshot),uploaded:Object.keys(JSON.parse(r.uploads)),status:r.status,product:r.product?JSON.parse(r.product):null,updatedAt:r.updated_at};}
export async function readTransfer(owner:string,id?:string,teamId?:string){
 const r=id?await row(owner,id):(await database().prepare("SELECT id,snapshot,uploads,status,product_id,product,updated_at FROM printify_transfers WHERE owner=? AND team_id=? AND json_extract(snapshot,'$.order') IS NULL ORDER BY updated_at DESC LIMIT 1").bind(owner,teamId??"dayton-eagles").all<Row>()).results[0];
 return r?publicRow(r):null;
}
export async function prepareTransfer(owner:string,teamId:string,variantId:number,price:number,selectedDraftId?:string){
 const team=await ownerTeam(owner,teamId);if(!Number.isSafeInteger(price)||price<100||price>100000)throw new ConnectionError("Enter a draft price between $1 and $1,000.");
 const c=await credentials(owner);
 const saved=(await database().prepare("SELECT config FROM drafts WHERE owner=? AND id=? AND team_id=?").bind(owner,selectedDraftId??draftKey(teamId),teamId).all<{config:string}>()).results[0];
 if(!saved)throw new ConnectionError("Save this team's template in Merch Studio first.",409);
 const config=upgradeSleeveArtwork(configSchema.parse(JSON.parse(saved.config))),catalog=await jerseyCatalog(c),variant=catalog.variants.find(v=>v.id===variantId);
 if(!variant)throw new ConnectionError("That size is no longer available. Refresh the provider details.",409);
 const snapshot:TransferSnapshot={teamId,team,config,shopId:c.shopId,catalog:{...catalog,variants:[variant]},variant,price};
 return saveTransferSnapshot(owner,snapshot);
}
export async function saveTransferSnapshot(owner:string,snapshot:TransferSnapshot){
 const hash=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify([["lightning","twist","blade-bolts"].includes(snapshot.config.stripeStyle)?"five-panel-renderer-v6-sculpted-trim":"five-panel-renderer-v5-angled-membership-sleeve",owner,snapshot])));
 const id=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,"0")).join("");
 await database().prepare("INSERT INTO printify_transfers(owner,id,team_id,snapshot,uploads,status,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(owner,id) DO NOTHING").bind(owner,id,snapshot.teamId,JSON.stringify(snapshot),"{}","preparing",new Date().toISOString()).run();
 return publicRow((await row(owner,id))!);
}
export async function prepareOrderTransfer(owner:string,orderId:string,lineId:string){
 const purchase=await purchasedArtwork(owner,orderId,lineId),c=await credentials(owner);
 await validateArtworkOwnership(owner,[purchase.artwork.config]);
 const catalog=await jerseyCatalog(c),matches=catalog.variants.filter(v=>sameSize(v.size,purchase.artwork.size));
 if(matches.length!==1)throw new ConnectionError("The purchased size needs a unique Printify size mapping. Review the provider catalog.",409);
 const variant=matches[0];
 return saveTransferSnapshot(owner,{teamId:purchase.artwork.team.id,team:purchase.artwork.team,config:purchase.artwork.config,shopId:c.shopId,catalog:{...catalog,variants:[variant]},variant,price:purchase.price,order:purchase.order});
}
async function checkOrderSnapshot(owner:string,s:TransferSnapshot){
 if(!s.order)return;
 const current=await purchasedArtwork(owner,s.order.id,s.order.lineId);
 if(JSON.stringify(current.order)!==JSON.stringify(s.order)||JSON.stringify(current.artwork.config)!==JSON.stringify(s.config)||JSON.stringify(current.artwork.team)!==JSON.stringify(s.team)||!sameSize(current.artwork.size,s.variant.size)||current.price!==s.price)throw new ConnectionError("This order changed after its artwork was prepared. Return to Orders and review it again.",409);
}
async function owned(owner:string,id:string){const r=await row(owner,id);if(!r)throw new ConnectionError("Transfer not found.",404);const c=await credentials(owner),snapshot=JSON.parse(r.snapshot) as TransferSnapshot;if(c.shopId!==snapshot.shopId)throw new ConnectionError("This transfer belongs to the previously connected Printify store. Reconnect that store to resume.",409);return {r,c,snapshot};}
export function checkPng(bytes:Uint8Array,area:PrintArea){
 if(bytes.length<33||[137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v)||String.fromCharCode(...bytes.slice(12,16))!=="IHDR")throw new ConnectionError("Upload a rendered PNG panel.");
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(dv.getUint32(16)!==area.width||dv.getUint32(20)!==area.height)throw new ConnectionError("Panel dimensions no longer match the provider template. Refresh and render again.",409);
}
export async function uploadPanel(owner:string,id:string,panel:string,bytes:Uint8Array){
 const {r,c,snapshot}=await owned(owner,id),area=snapshot.variant.areas.find(p=>p.panel===panel);
 if(!area)throw new ConnectionError("Unknown print panel.");
 const uploaded=JSON.parse(r.uploads) as Record<string,ImageUpload>;
 if(uploaded[panel])return publicRow(r);
 if(r.status!=="preparing")throw new ConnectionError("This transfer has already reached product creation. Check its status.",409);
 checkPng(bytes,area);
 let binary="";for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
 const image=await api(c,"uploads/images.json",{file_name:`${snapshot.teamId}-${panel}-${id.slice(0,12)}.png`,contents:btoa(binary)});
 if(typeof image.id!=="string"||image.width!==area.width||image.height!==area.height)throw new ConnectionError("Printify could not verify the uploaded panel dimensions.",502);
 await database().prepare("UPDATE printify_transfers SET uploads=json_set(uploads,?,json(?)),updated_at=? WHERE owner=? AND id=? AND status='preparing'").bind('$.'+JSON.stringify(panel),JSON.stringify({id:image.id,width:image.width,height:image.height}),new Date().toISOString(),owner,id).run();
 return publicRow((await row(owner,id))!);
}
function productView(p:any):TransferProduct{
 if(!p||typeof p.id!=="string"||typeof p.title!=="string")throw new PrintifyRequestError("Printify did not return a product reference. Check the transfer status.",true);
 return {id:p.id,title:p.title,images:(Array.isArray(p.images)?p.images:[]).filter((i:any)=>{try{const u=new URL(i.src);return u.protocol==="https:"&&!u.username&&!u.password;}catch{return false;}}).slice(0,8).map((i:any)=>({src:i.src,position:typeof i.position==="string"?i.position:"Preview"}))};
}
async function saveProduct(owner:string,id:string,p:any){const product=productView(p);await database().prepare("UPDATE printify_transfers SET status='created',product_id=?,product=?,updated_at=? WHERE owner=? AND id=?").bind(product.id,JSON.stringify(product),new Date().toISOString(),owner,id).run();return publicRow((await row(owner,id))!);}
export function buildProduct(id:string,s:TransferSnapshot,uploads:Record<string,ImageUpload>){
 if(s.variant.areas.length!==5||panels.some(p=>!uploads[p.id]))throw new ConnectionError("Upload all five panels before creating the product.",409);
 return {title:`${s.order?"Order "+s.order.name+" · "+(s.config.playerName||"No name")+" · #"+(s.config.playerNumber||"none")+" — ":""}${(s.team??getTeam(s.teamId)).name} — ${themeLabel(s.config)} — ${s.config.frontLogoLabel||"Team crest"} — MLBL Brotherhood Jersey`,description:"Team pride up front. The whole league behind you. MLBL Brotherhood all-over-print jersey.",blueprint_id:s.catalog.blueprint.id,print_provider_id:s.catalog.provider.id,tags:["ForgeLinc","MLBL","forgelinc-transfer-"+id],variants:[{id:s.variant.id,price:s.price,is_enabled:true}],print_areas:[{variant_ids:[s.variant.id],placeholders:s.variant.areas.map(a=>({position:a.position,...(a.decoration_method?{decoration_method:a.decoration_method}:{}),images:[{id:uploads[a.panel].id,x:.5,y:.5,scale:1,angle:0}]}))}]};
}
export async function createProduct(owner:string,id:string){
 const {r,c,snapshot}=await owned(owner,id);
 if(r.status==="created")return publicRow(r);
 if(r.status!=="preparing")throw new ConnectionError("Printify may already have received this draft. Use Check Printify status to avoid a duplicate.",409);
 await checkOrderSnapshot(owner,snapshot);
 const body=buildProduct(id,snapshot,JSON.parse(r.uploads));
 // Revalidate size and all print dimensions immediately before the external write.
 const current=await jerseyCatalog(c),v=current.variants.find(v=>v.id===snapshot.variant.id);
 if(current.blueprint.id!==snapshot.catalog.blueprint.id||current.provider.id!==snapshot.catalog.provider.id||!v||JSON.stringify(v.areas)!==JSON.stringify(snapshot.variant.areas))throw new ConnectionError("The provider template changed. Start a new transfer with the current template.",409);
 const claim=await database().prepare("UPDATE printify_transfers SET status='creating',updated_at=? WHERE owner=? AND id=? AND status='preparing' RETURNING id").bind(new Date().toISOString(),owner,id).all<{id:string}>();
 if(!claim.results.length)throw new ConnectionError("This draft is already being sent. Check its status.",409);
 try{return await saveProduct(owner,id,await api(c,`shops/${snapshot.shopId}/products.json`,body));}
 catch(e){const definite=e instanceof PrintifyRequestError&&!e.uncertain;await database().prepare("UPDATE printify_transfers SET status=?,updated_at=? WHERE owner=? AND id=? AND status='creating'").bind(definite?"preparing":"uncertain",new Date().toISOString(),owner,id).run();throw e;}
}
export async function recheckProduct(owner:string,id:string){
 const {r,c,snapshot}=await owned(owner,id);
 if(r.product_id)return saveProduct(owner,id,await api(c,`shops/${snapshot.shopId}/products/${encodeURIComponent(r.product_id)}.json`));
 if(r.status==="preparing")return publicRow(r);
 // Read-only recovery for a lost create response. Never auto-submit a second product.
 for(let page=1;page<=10;page++){
  const data=await api(c,`shops/${snapshot.shopId}/products.json?limit=100&page=${page}`);
  if(!Array.isArray(data.data))throw new ConnectionError("Could not read Printify's product list.",502);
  const found=data.data.find((p:any)=>Array.isArray(p.tags)&&p.tags.includes("forgelinc-transfer-"+id));
  if(found)return saveProduct(owner,id,found);
  if(!data.next_page_url)break;
 }
 throw new ConnectionError("Printify has not confirmed this draft yet. Wait and check again, or review My Products in Printify. Another product will not be submitted automatically.",409);
}
