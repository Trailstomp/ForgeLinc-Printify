import {env} from "cloudflare:workers";
import {STUDIO_OWNER_ID} from "@/lib/studio-access";
import {customCheckoutStatus,setupCustomCatalog} from "@/lib/checkout-catalog";
import {processPaidCheckouts,fulfillmentStatus,fulfillmentLastRun} from "@/lib/automatic-fulfillment";
import {readBounded,transferJson,transferError} from "@/lib/transfer-http";
export const dynamic="force-dynamic";
/** Shared service writer for this OWNER-PRIVATE Site. Sites dispatch authenticates
 * service callers. It never accepts a caller-supplied owner or a provider secret.
 * Disable this flag before changing the Site audience. Interactive routes retain
 * their existing visitor/admin authorization and CSRF checks. */
export async function POST(req:Request){try{
 if((env as unknown as Record<string,string>).FORGELINC_PRIVATE_AUTOMATION!=="enabled")return transferJson({error:"Private checkout automation is disabled."},403);
 if(req.headers.has("origin")&&req.headers.get("origin")!==new URL(req.url).origin)return transferJson({error:"Invalid origin."},403);
 if(!req.headers.get("content-type")?.startsWith("application/json"))return transferJson({error:"Use JSON."},415);
 const body=JSON.parse(new TextDecoder().decode(await readBounded(req,2048)));
 if(body.action==="status")return transferJson({...await customCheckoutStatus(STUDIO_OWNER_ID),jobs:await fulfillmentStatus(STUDIO_OWNER_ID),lastRun:await fulfillmentLastRun(STUDIO_OWNER_ID)});
 if(body.action==="setup")return transferJson(await setupCustomCatalog(STUDIO_OWNER_ID));
 if(body.action==="process")return transferJson(await processPaidCheckouts(STUDIO_OWNER_ID));
 return transferJson({error:"Unknown action."},400);
 }catch(e){return transferError(e);}}
