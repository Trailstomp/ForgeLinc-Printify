import {STUDIO_OWNER_ID} from "@/lib/studio-access";
import {credentials,jerseyCatalog} from "@/lib/printify-transfers";
import {artworkViewer,transferJson,transferError} from "@/lib/transfer-http";
export const dynamic="force-dynamic";
export async function GET(){try{await artworkViewer();const catalog=await jerseyCatalog(await credentials(STUDIO_OWNER_ID));return transferJson({variants:catalog.variants.map(v=>({size:v.size}))});}catch(e){return transferError(e);}}
