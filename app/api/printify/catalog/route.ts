import {credentials,jerseyCatalog} from "@/lib/printify-transfers";
import {transferOwner,transferJson,transferError} from "@/lib/transfer-http";
export const dynamic="force-dynamic";
export async function GET(){try{const owner=await transferOwner();return transferJson(await jerseyCatalog(await credentials(owner)));}catch(e){return transferError(e);}}
