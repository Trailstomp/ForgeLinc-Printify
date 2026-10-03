import {uploadPanel} from "@/lib/printify-transfers";
import {transferOwner,transferJson,transferError,readBounded} from "@/lib/transfer-http";
import {panels} from "@/lib/catalog";
export const dynamic="force-dynamic";
export async function POST(req:Request){try{
 const owner=await transferOwner(req),p=new URL(req.url).searchParams,id=p.get("id")??"",panel=p.get("panel")??"";
 if(!/^[a-f0-9]{64}$/.test(id)||!panels.some(a=>a.id===panel))return transferJson({error:"Invalid transfer or panel."},400);
 if(req.headers.get("content-type")!=="image/png")return transferJson({error:"A PNG panel is required."},415);
 return transferJson({transfer:await uploadPanel(owner,id,panel,await readBounded(req,20*1024*1024))});
 }catch(e){return transferError(e);}}
