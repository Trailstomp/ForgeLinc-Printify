import {reviewOrders} from "@/lib/shopify-orders";
import {ConnectionError,ShopifyOrderError} from "@/lib/shopify-connection";
import {transferOwner,transferJson} from "@/lib/transfer-http";
export const dynamic="force-dynamic";
export async function GET(req:Request){
 try{return transferJson(await reviewOrders(await transferOwner(),new URL(req.url).searchParams.get("after")??undefined));}
 catch(e){if(e instanceof ShopifyOrderError){console.warn("Shopify order review blocked",{reason:e.reason,grantedScopes:e.grantedScopes,installation:e.installation});return transferJson({error:e.message,needsOrderAccess:e.reason==="missing_scope",diagnosticCode:e.reason,grantedScopes:e.grantedScopes,installation:e.installation},e.status);}if(e instanceof ConnectionError)return transferJson({error:e.message,needsOrderAccess:false},e.status);console.error("Shopify order review unavailable");return transferJson({error:"Orders could not be loaded. Try refreshing. Nothing was sent to production."},503);}
}
