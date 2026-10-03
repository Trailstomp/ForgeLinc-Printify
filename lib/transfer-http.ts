import {requireStudioAdmin} from "./studio-access";
import {getChatGPTUser} from "@/app/chatgpt-auth";
import {ConnectionError} from "./shopify-connection";
export const transferJson=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
export function transferError(e:unknown){if(e instanceof ConnectionError)return transferJson({error:e.message},e.status);console.error("Printify transfer operation failed");return transferJson({error:"This transfer step could not finish. Check its status before retrying."},503);}
export async function transferOwner(req?:Request){const user=await requireStudioAdmin();if(req&&req.headers.get("origin")!==new URL(req.url).origin)throw new ConnectionError("Invalid request origin.",403);return user.userId;}
export async function readBounded(req:Request,limit:number){
 const reader=req.body?.getReader();if(!reader)throw new ConnectionError("Missing request body.");let length=0;const chunks:Uint8Array[]=[];
 for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw new ConnectionError("This panel is too large to transfer. The maximum is 20 MB.",413);}chunks.push(value);}
 const data=new Uint8Array(length);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}return data;
}

export async function artworkViewer(req?:Request){const user=await getChatGPTUser();if(!user)throw new ConnectionError("Please sign in to customize your jersey.",401);if(req&&req.headers.get("origin")!==new URL(req.url).origin)throw new ConnectionError("Invalid request origin.",403);return user.userId;}
