import {shopCatalog} from "@/lib/shop-catalog";
import {artworkViewer,transferJson,transferError} from "@/lib/transfer-http";
export const dynamic="force-dynamic";
export async function GET(){try{await artworkViewer();return transferJson(await shopCatalog());}catch(e){return transferError(e);}}
