import {env} from "cloudflare:workers";
import {database} from "./storage";
import {ConnectionError,secureStorageReady} from "./shopify-connection";

export type PrintifyShop={id:number;title:string;sales_channel:string};
export type PrintifySummary={shop:PrintifyShop;checkedAt:string;products:{id:string;title:string;blueprintId:number;providerId:number}[]};
type Credentials={token:string;shopId:number};
type RecordRow={sealed_secret:string;summary:string;updated_at:string};
const encoder=new TextEncoder();
const context=(owner:string)=>encoder.encode(JSON.stringify(["forgelinc-printify-v1",owner,"api.printify.com"]));
async function key(){
 if(!secureStorageReady())throw new ConnectionError("Secure connection storage is unavailable. Please try again later.",503);
 const value=(env as unknown as Record<string,string>).CONNECTION_ENCRYPTION_KEY;
 return crypto.subtle.importKey("raw",Uint8Array.from(value.match(/../g)!,v=>parseInt(v,16)),"AES-GCM",false,["encrypt","decrypt"]);
}
function encode(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes));}
function decode(value:string){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
export async function sealPrintify(owner:string,credentials:Credentials){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const data=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:context(owner)},await key(),encoder.encode(JSON.stringify(credentials)));
 return JSON.stringify({v:1,iv:encode(iv),data:encode(new Uint8Array(data))});
}
export async function unsealPrintify(owner:string,sealed:string):Promise<Credentials>{
 try{const body=JSON.parse(sealed);if(body.v!==1)throw new Error();
 const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(body.iv),additionalData:context(owner)},await key(),decode(body.data));
 const result=JSON.parse(new TextDecoder().decode(clear));
 if(typeof result.token!=="string"||!Number.isSafeInteger(result.shopId)||result.shopId<=0)throw new Error();
 return result;
 }catch{throw new ConnectionError("The saved Printify connection could not be unlocked. Enter a token to reconnect.",503);}
}
async function readPrintify(token:string,path:string):Promise<unknown>{
 // Only fixed-origin, read-only API paths supplied by this module are accepted.
 let response:Response;
 try{response=await fetch("https://api.printify.com/v1/"+path,{method:"GET",headers:{Authorization:"Bearer "+token,"User-Agent":"ForgeLinc/1.0",Accept:"application/json"},redirect:"manual",cache:"no-store",signal:AbortSignal.timeout(15000)});}
 catch{throw new ConnectionError("Printify could not be reached. Please try again.",502);}
 if(response.status>=300&&response.status<400){await response.body?.cancel();throw new ConnectionError("Printify redirected the request. The connection was not saved.",502);}
 if(response.status===401)throw new ConnectionError("Printify did not accept that token. Create a new token in Printify Connections and try again.",401);
 if(response.status===403)throw new ConnectionError("Printify denied access. Check that your token includes shops.read and products.read.",403);
 if(response.status===429)throw new ConnectionError("Printify is busy. Wait a moment and try again.",429);
 if(!response.ok)throw new ConnectionError("Printify could not verify this store. Please try again.",502);
 try{return await response.json();}catch{throw new ConnectionError("Printify returned an unreadable response. Please retry.",502);}
}
export async function listPrintifyShops(token:string):Promise<PrintifyShop[]>{
 const data=await readPrintify(token,"shops.json");
 if(!Array.isArray(data)||data.some(s=>!s||!Number.isSafeInteger(s.id)||s.id<=0||typeof s.title!=="string"||typeof s.sales_channel!=="string"))throw new ConnectionError("Printify returned an incomplete store list. Please retry.",502);
 return data.map(s=>({id:s.id,title:s.title,sales_channel:s.sales_channel}));
}
export async function verifyPrintify(token:string,shopId:number):Promise<PrintifySummary>{
 if(!Number.isSafeInteger(shopId)||shopId<=0)throw new ConnectionError("Choose your LincWerks store from the list.");
 const shops=await listPrintifyShops(token),shop=shops.find(s=>s.id===shopId);
 if(!shop)throw new ConnectionError("That store is not available to this token. Find your stores again.",403);
 if(shop.sales_channel.toLowerCase()!=="shopify")throw new ConnectionError("Choose the Printify store already connected to Shopify.");
 const result=await readPrintify(token,`shops/${shop.id}/products.json?limit=5`) as {data?:unknown};
 if(!result||!Array.isArray(result.data)||result.data.some(p=>!p||typeof p.id!=="string"||typeof p.title!=="string"||!Number.isSafeInteger(p.blueprint_id)||!Number.isSafeInteger(p.print_provider_id)))throw new ConnectionError("Printify returned an incomplete product list. Please retry.",502);
 return {shop,checkedAt:new Date().toISOString(),products:result.data.slice(0,5).map(p=>({id:p.id,title:p.title,blueprintId:p.blueprint_id,providerId:p.print_provider_id}))};
}
export async function readPrintifyConnection(owner:string){
 const rows=await database().prepare("SELECT sealed_secret, summary, updated_at FROM shop_connections WHERE owner=? AND provider=?").bind(owner,"printify").all<RecordRow>();
 return rows.results[0]??null;
}
export async function savePrintifyConnection(owner:string,sealed:string,summary:PrintifySummary){
 await database().prepare("INSERT INTO shop_connections(owner,provider,sealed_secret,summary,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,provider) DO UPDATE SET sealed_secret=excluded.sealed_secret,summary=excluded.summary,updated_at=excluded.updated_at").bind(owner,"printify",sealed,JSON.stringify(summary),summary.checkedAt).run();
}
