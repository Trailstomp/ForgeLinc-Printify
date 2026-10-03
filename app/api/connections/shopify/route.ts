import {isStudioAdmin} from "@/lib/studio-access";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {ConnectionError,SHOPIFY_CLIENT_ID,SHOPIFY_DOMAIN,secureStorageReady,readConnection,saveConnection,seal,unseal,verifyShopify} from "@/lib/shopify-connection";
export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function failed(error:unknown){
 // Do not log request bodies, secrets, tokens or upstream error responses.
 if(error instanceof ConnectionError)return json({error:error.message},error.status);
 console.error("Shopify connection operation failed");
 return json({error:"The connection could not be saved or loaded. Please try again."},503);
}
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in to manage your store connection."},401);
 if(!isStudioAdmin(user))return json({error:"Merch Studio is reserved for the ForgeLinc administrator."},403);
 try{const record=await readConnection(user.userId);
 return json({configured:!!record,secureStorageReady:secureStorageReady(),clientId:SHOPIFY_CLIENT_ID,domain:SHOPIFY_DOMAIN,lastVerified:record?JSON.parse(record.summary):null});
 }catch(e){return failed(e);}
}
export async function POST(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in to connect your store."},401);
 if(!isStudioAdmin(user))return json({error:"Merch Studio is reserved for the ForgeLinc administrator."},403);
 if(req.headers.get("origin")!==new URL(req.url).origin)return json({error:"Invalid request origin."},403);
 if(!req.headers.get("content-type")?.startsWith("application/json"))return json({error:"Invalid request format."},415);
 // Bound the actual streamed payload before parsing; do not trust Content-Length.
 const reader=req.body?.getReader();if(!reader)return json({error:"Missing request."},400);
 let length=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();return json({error:"Request too large."},413);}chunks.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 let body:Record<string,unknown>;
 try{body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=="object"||Array.isArray(body))throw new Error();}catch{return json({error:"Invalid request."},400);}
 try{
  if(!secureStorageReady())throw new ConnectionError("Secure connection storage is unavailable. Please try again later.",503);
  let secret:string,sealed:string;
  if(body.action==="connect"){
   if(typeof body.clientSecret!=="string"||body.clientSecret.trim().length<16||body.clientSecret.trim().length>4096)return json({error:"Enter the Client secret from ForgeLinc's Shopify App settings."},400);
   secret=body.clientSecret.trim();sealed=await seal(user.userId,{clientSecret:secret});
  }else if(body.action==="verify"){
   const record=await readConnection(user.userId);if(!record)return json({error:"Connect Shopify first."},409);
   sealed=record.sealed_secret;secret=(await unseal(user.userId,sealed)).clientSecret;
  }else return json({error:"Unknown connection action."},400);
  const summary=await verifyShopify(secret);
  // Invalid credentials never overwrite an existing working connection.
  await saveConnection(user.userId,sealed,summary);
  return json({configured:true,lastVerified:summary});
 }catch(e){return failed(e);}
}
