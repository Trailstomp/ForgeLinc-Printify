import {env} from "cloudflare:workers";
import {ConnectionError,savedShopifyQuery} from "./shopify-connection";
import {credentials,printifyApi} from "./printify-transfers";

/** Read-only preflight: do not accept payment when order/address access is blocked. */
export async function assertOrderAccess(owner:string){
 if((env as unknown as Record<string,string>).FORGELINC_PRIVATE_AUTOMATION!=="enabled")throw new ConnectionError("Automatic fulfillment is not enabled for this private shop yet.",409);
 await savedShopifyQuery(owner,"query ForgeLincCheckoutOrderAccess{orders(first:1,reverse:true){nodes{id email phone shippingAddress{firstName lastName address1 address2 city provinceCode countryCodeV2 zip phone}}}}",{},"orders");
 const c=await credentials(owner);await printifyApi(c,`shops/${c.shopId}/orders.json?limit=1&page=1`);
}
