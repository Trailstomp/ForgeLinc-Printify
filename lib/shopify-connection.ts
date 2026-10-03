import {env} from "cloudflare:workers";
import {database} from "./storage";

export const SHOPIFY_DOMAIN="eewwjf-tt.myshopify.com";
export const SHOPIFY_CLIENT_ID="91c3b99ceb14ffcb3805a9a4002a752d";
const API_VERSION="2026-07";
export class ConnectionError extends Error {constructor(message:string,public status=400){super(message);}}
export type OrderFailureReason="missing_scope"|"order_data_access"|"access_denied"|"query_limit"|"throttled"|"query_error"|"authorization"|"upstream"|"installation_scope_missing";
export class ShopifyOrderError extends ConnectionError {
 constructor(message:string,status:number,public reason:OrderFailureReason,public grantedScopes:string[]=[],public installation?:{requestedScopes:string[];tokenScopes:string[];clientId:string}){super(message,status);}
}
type GraphQLError={message?:string;extensions?:{code?:string}};
function orderQueryFailure(errors:GraphQLError[],scopes:string[]):ShopifyOrderError{
 const code=(value:string)=>errors.some(e=>e.extensions?.code===value);
 // Classify provider text locally; never return or log raw messages or credentials.
 if(code("THROTTLED"))return new ShopifyOrderError("Shopify is temporarily limiting requests. Wait a few seconds, then refresh orders.",429,"throttled",scopes);
 if(code("MAX_COST_EXCEEDED")||errors.some(e=>/query cost.*exceed|cost.*maximum|maximum.*cost/i.test(e.message??"")))return new ShopifyOrderError("Shopify rejected the size of the order request. This is an app query issue; adding permissions will not fix it.",502,"query_limit",scopes);
 if(errors.some(e=>/protected customer|protected.*data|not approved.*access.*order|not approved.*access.*data/i.test(e.message??"")))return new ShopifyOrderError("Shopify is blocking access to protected order data. Check ForgeLinc’s API access or data-access requirements in the Dev Dashboard. Adding read_orders alone does not resolve this approval.",403,"order_data_access",scopes);
 if(code("ACCESS_DENIED"))return new ShopifyOrderError("Shopify denied an order field even though the token was issued. Check the granted permissions below and ForgeLinc’s order-data access in the Dev Dashboard.",403,"access_denied",scopes);
 return new ShopifyOrderError("Shopify rejected the order query. This is an app/API error, not a confirmed missing permission. Share the diagnostic code below so we can investigate.",502,"query_error",scopes);
}
type Credentials={clientSecret:string};
export type ShopifySummary={name:string;domain:string;productAccess:boolean;checkedAt:string;products:{id:string;title:string;status:string}[]};
export type ConnectionRecord={sealed_secret:string;summary:string;updated_at:string};
const encoder=new TextEncoder();
const context=(owner:string)=>encoder.encode(JSON.stringify(["forgelinc-shopify-v1",owner,SHOPIFY_DOMAIN,SHOPIFY_CLIENT_ID]));
function keyValue(){return (env as unknown as Record<string,string|undefined>).CONNECTION_ENCRYPTION_KEY;}
export function secureStorageReady(){return /^[0-9a-f]{64}$/i.test(keyValue()??"");}
async function key(){
 const value=keyValue();if(!value||!secureStorageReady())throw new ConnectionError("Secure connection storage is unavailable. Please try again later.",503);
 return crypto.subtle.importKey("raw",Uint8Array.from(value.match(/../g)!,v=>parseInt(v,16)),"AES-GCM",false,["encrypt","decrypt"]);
}
function encode(bytes:Uint8Array){return btoa(String.fromCharCode(...bytes));}
function decode(text:string){return Uint8Array.from(atob(text),c=>c.charCodeAt(0));}
export async function seal(owner:string,credentials:Credentials){
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:context(owner)},await key(),encoder.encode(JSON.stringify(credentials)));
 return JSON.stringify({v:1,iv:encode(iv),data:encode(new Uint8Array(encrypted))});
}
export async function unseal(owner:string,sealed:string):Promise<Credentials>{
 try{const body=JSON.parse(sealed);if(body.v!==1)throw new Error("Version");
 const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:decode(body.iv),additionalData:context(owner)},await key(),decode(body.data));
 const credentials=JSON.parse(new TextDecoder().decode(clear));if(typeof credentials.clientSecret!=="string")throw new Error("Invalid credentials");return credentials;
 }catch{throw new ConnectionError("The saved connection could not be unlocked. Enter the app secret again to reconnect.",503);}
}
async function call(url:string,init:RequestInit){
 let response:Response;
 // Workers supports manual redirects. Never follow a redirect with app credentials.
 try{response=await fetch(url,{...init,redirect:"manual",signal:AbortSignal.timeout(15000),cache:"no-store"});}
 catch{throw new ConnectionError("Shopify could not be reached. Please try again.",502);}
 if(response.status>=300&&response.status<400){
  await response.body?.cancel();
  throw new ConnectionError("Shopify redirected the connection request. The connection was not saved. Please check the app's store configuration.",502);
 }
 return response;
}
export async function verifyShopify(clientSecret:string):Promise<ShopifySummary>{
 // The destination and client ID are fixed to this installed app. Never forward
 // a user-supplied URL, redirect, or raw provider error containing credentials.
 const tokenResponse=await call(`https://${SHOPIFY_DOMAIN}/admin/oauth/access_token`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"client_credentials",client_id:SHOPIFY_CLIENT_ID,client_secret:clientSecret})});
 if(!tokenResponse.ok){
  if(tokenResponse.status===429)throw new ConnectionError("Shopify is rate limiting requests. Wait a moment and retry.",429);
  throw new ConnectionError("Shopify could not authorize ForgeLinc. Check the Client secret, confirm the app is installed on LincWerks, and that the app and store belong to the same Shopify organization.",400);
 }
 const token=await tokenResponse.json() as {access_token?:string;scope?:string};
 if(!token.access_token)throw new ConnectionError("Shopify returned an incomplete authorization. Please retry.",502);
 let scopes=(token.scope??"").split(",").map(s=>s.trim());
 if(!scopes.includes("write_products")&&!scopes.includes("read_products"))throw new ConnectionError("ForgeLinc needs product access. Release the product scope in Shopify and approve it for your store.",403);
 const response=await call(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,{method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Access-Token":token.access_token},body:JSON.stringify({query:"query ForgeLincConnection { shop { name myshopifyDomain } products(first: 5) { nodes { id title status } } }"})});
 if(!response.ok)throw new ConnectionError("Shopify authorized the app but product access could not be verified. Check its product permissions and retry.",502);
 const result=await response.json() as {errors?:unknown[];data?:{shop:{name:string;myshopifyDomain:string};products:{nodes:ShopifySummary["products"]}}};
 if(result.errors?.length||!result.data?.shop||!result.data?.products)throw new ConnectionError("Shopify product access could not be verified. Check the installed app's product permissions.",403);
 if(result.data.shop.myshopifyDomain.toLowerCase()!==SHOPIFY_DOMAIN)throw new ConnectionError("Shopify returned a different store. The connection was not saved.",400);
 return {name:result.data.shop.name,domain:SHOPIFY_DOMAIN,productAccess:true,checkedAt:new Date().toISOString(),products:result.data.products.nodes.map(p=>({id:p.id,title:p.title,status:p.status}))};
}
export async function readConnection(owner:string){
 const rows=await database().prepare("SELECT sealed_secret, summary, updated_at FROM shop_connections WHERE owner=? AND provider=?").bind(owner,"shopify").all<ConnectionRecord>();
 return rows.results[0]??null;
}
/** Use the installed app connection only against this store's Admin API. */
export async function savedShopifyQuery<T>(owner:string,query:string,variables:Record<string,unknown>,resource:"product"|"orders"="product"):Promise<T>{
 const record=await readConnection(owner);if(!record)throw new ConnectionError("Connect Shopify before linking a product.",409);
 const {clientSecret}=await unseal(owner,record.sealed_secret);
 const auth=await call(`https://${SHOPIFY_DOMAIN}/admin/oauth/access_token`,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"client_credentials",client_id:SHOPIFY_CLIENT_ID,client_secret:clientSecret})});
 if(!auth.ok){
  if(resource==="orders")throw new ShopifyOrderError(auth.status===429?"Shopify is temporarily limiting sign-in requests. Wait a few seconds and refresh.":"Shopify could not authorize the saved app connection. Recheck Shopify in Connections.",auth.status===429?429:502,auth.status===429?"throttled":"authorization");
  throw new ConnectionError("Reconnect Shopify to refresh product access.",403);
 }
 const token=await auth.json() as {access_token?:string;scope?:string};if(!token.access_token)throw new ConnectionError("Shopify authorization was incomplete.",502);
 let scopes=(token.scope??"").split(",").map(s=>s.trim()).filter(s=>/^[a-z_]{1,80}$/.test(s)).slice(0,100);
 if(resource==="orders"){
  // Shopify's installed grants are authoritative; token response metadata alone
  // must not decide whether the independently authorized order query can run.
  const check=await call(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,{method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Access-Token":token.access_token},body:JSON.stringify({query:"query ForgeLincInstalledPermissions { currentAppInstallation { accessScopes { handle } app { apiKey requestedAccessScopes { handle } } } }"})});
  if(!check.ok)throw new ShopifyOrderError("Shopify could not verify the installed permissions. Refresh to retry the check.",check.status===429?429:502,check.status===429?"throttled":"upstream",scopes);
  const body=await check.json() as {errors?:GraphQLError[];data?:{currentAppInstallation?:{accessScopes?:{handle:string}[];app?:{apiKey:string;requestedAccessScopes?:{handle:string}[]}}}};
  if(body.errors?.length)throw orderQueryFailure(body.errors,scopes);
  const installed=body.data?.currentAppInstallation;
  if(!Array.isArray(installed?.accessScopes)||installed.app?.apiKey!==SHOPIFY_CLIENT_ID)throw new ShopifyOrderError("Shopify did not confirm the expected ForgeLinc installation. Check the app connection in Connections.",502,"authorization",scopes);
  const clean=(items:{handle:string}[])=>items.map(s=>s.handle).filter(s=>typeof s==="string"&&/^[a-z_]{1,80}$/.test(s)).slice(0,100);
  const tokenScopes=scopes;scopes=clean(installed.accessScopes);
  if(!scopes.some(s=>["read_orders","write_orders"].includes(s))){
   const requestedScopes=clean(installed.app.requestedAccessScopes??[]),requested=requestedScopes.some(s=>["read_orders","write_orders"].includes(s));
   throw new ShopifyOrderError(requested?"Shopify confirms that ForgeLinc requests read_orders, but this store’s installation has not granted it. The released version is configured correctly. Use Install app from ForgeLinc’s Dev Dashboard to update the store installation.":"Shopify’s installed-app record does not request read_orders. Compare the Client ID below with the ForgeLinc app whose version you released.",403,"installation_scope_missing",scopes,{requestedScopes,tokenScopes,clientId:installed.app.apiKey});
  }
 }

 const response=await call(`https://${SHOPIFY_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,{method:"POST",headers:{"Content-Type":"application/json","X-Shopify-Access-Token":token.access_token},body:JSON.stringify({query,variables})});
 if(!response.ok&&resource==="orders")throw new ShopifyOrderError(response.status===429?"Shopify is temporarily limiting requests. Wait a few seconds and refresh.":"Shopify could not complete the order request. Recheck the connection and try again.",response.status===429?429:502,response.status===429?"throttled":"upstream",scopes);
 if(!response.ok)throw new ConnectionError(`Shopify could not read ${resource==="orders"?"orders":"this product"}. Try again.`,502);
 const result=await response.json() as {data?:T;errors?:GraphQLError[]};
 if(result.errors?.length||!result.data){
  if(resource==="orders")throw orderQueryFailure(result.errors??[],scopes);
  throw new ConnectionError("Shopify could not read this product. Check ForgeLinc's product access.",403);
 }
 return result.data;
}
export async function saveConnection(owner:string,sealed:string,summary:ShopifySummary){
 await database().prepare("INSERT INTO shop_connections(owner,provider,sealed_secret,summary,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner,provider) DO UPDATE SET sealed_secret=excluded.sealed_secret,summary=excluded.summary,updated_at=excluded.updated_at").bind(owner,"shopify",sealed,JSON.stringify(summary),summary.checkedAt).run();
}
