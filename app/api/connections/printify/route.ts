import {isStudioAdmin} from "@/lib/studio-access";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {ConnectionError,secureStorageReady} from "@/lib/shopify-connection";
import {listPrintifyShops,verifyPrintify,sealPrintify,unsealPrintify,readPrintifyConnection,savePrintifyConnection} from "@/lib/printify-connection";
export const dynamic="force-dynamic";
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function failed(error:unknown){
 if(error instanceof ConnectionError)return json({error:error.message},error.status);
 // Never log tokens, request bodies, encrypted credentials, or upstream responses.
 console.error("Printify connection operation failed");
 return json({error:"The Printify connection could not be saved or loaded. Please try again."},503);
}
export async function GET(){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in to manage Printify."},401);
 if(!isStudioAdmin(user))return json({error:"Merch Studio is reserved for the ForgeLinc administrator."},403);
 try{const record=await readPrintifyConnection(user.userId);return json({configured:!!record,secureStorageReady:secureStorageReady(),lastVerified:record?JSON.parse(record.summary):null});}catch(e){return failed(e);}
}
export async function POST(req:Request){
 const user=await getChatGPTUser();if(!user)return json({error:"Sign in to connect Printify."},401);
 if(!isStudioAdmin(user))return json({error:"Merch Studio is reserved for the ForgeLinc administrator."},403);
 if(req.headers.get("origin")!==new URL(req.url).origin)return json({error:"Invalid request origin."},403);
 if(!req.headers.get("content-type")?.startsWith("application/json"))return json({error:"Invalid request format."},415);
 try{
  const reader=req.body?.getReader();if(!reader)return json({error:"Missing request."},400);
  let length=0;const chunks:Uint8Array[]=[];
  for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>8192){await reader.cancel();return json({error:"Request too large."},413);}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let body:Record<string,unknown>;
  try{body=JSON.parse(new TextDecoder().decode(bytes));if(!body||typeof body!=="object"||Array.isArray(body))throw new Error();}catch{return json({error:"Invalid request."},400);}
  if(!secureStorageReady())throw new ConnectionError("Secure connection storage is unavailable. Please try again later.",503);
  let token:string,shopId:number,sealed:string;
  if(body.action==="discover"||body.action==="connect"){
   if(typeof body.token!=="string"||body.token.trim().length<16||body.token.trim().length>4096||/\s/.test(body.token.trim()))return json({error:"Paste the personal access token from Printify Connections, without a Bearer prefix."},400);
   token=body.token.trim();
   if(body.action==="discover")return json({shops:await listPrintifyShops(token)});
   if(typeof body.shopId!=="number"||!Number.isSafeInteger(body.shopId)||body.shopId<=0)return json({error:"Choose your LincWerks store."},400);
   shopId=body.shopId;sealed=await sealPrintify(user.userId,{token,shopId});
  }else if(body.action==="verify"){
   const record=await readPrintifyConnection(user.userId);if(!record)return json({error:"Connect Printify first."},409);
   sealed=record.sealed_secret;({token,shopId}=await unsealPrintify(user.userId,sealed));
  }else return json({error:"Unknown connection action."},400);
  const summary=await verifyPrintify(token,shopId);
  await savePrintifyConnection(user.userId,sealed,summary);
  return json({configured:true,lastVerified:summary});
 }catch(e){return failed(e);}
}
