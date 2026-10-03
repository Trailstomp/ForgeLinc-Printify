import {checkoutStatus,configureCheckout,previewCheckout} from "@/lib/shopify-checkout";
import {transferOwner,readBounded,transferJson} from "@/lib/transfer-http";
import {ConnectionError} from "@/lib/shopify-connection";
import {ZodError} from "zod";
export const dynamic="force-dynamic";
function failed(e:unknown){if(e instanceof ConnectionError)return transferJson({error:e.message},e.status);if(e instanceof ZodError)return transferJson({error:"Check the product, sizes and design settings."},400);return transferJson({error:"Shopify checkout setup is unavailable. Your design is still saved; try again."},503);}
export async function GET(){try{return transferJson(await checkoutStatus(await transferOwner()));}catch(e){return failed(e);}}
export async function POST(req:Request){try{const owner=await transferOwner(req);if(!req.headers.get("content-type")?.startsWith("application/json"))return transferJson({error:"Use JSON."},415);let body;try{body=JSON.parse(new TextDecoder().decode(await readBounded(req,150000)));}catch(e){if(e instanceof ConnectionError)throw e;return transferJson({error:"Invalid request."},400);}if(body?.action==="configure")return transferJson(await configureCheckout(owner,body.settings));if(body?.action==="preview")return transferJson(await previewCheckout(owner,body.checkout));return transferJson({error:"Unknown action."},400);}catch(e){return failed(e);}}
