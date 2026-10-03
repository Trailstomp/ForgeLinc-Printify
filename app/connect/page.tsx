import ShopifyCheckoutCard from "../shopify-checkout-card";
import ShopifyConnectionCard from "../shopify-connection-card";
import PrintifyConnectionCard from "../printify-connection-card";
import {getChatGPTUser} from "../chatgpt-auth";
import {isStudioAdmin} from "@/lib/studio-access";
import {redirect} from "next/navigation";
export const dynamic="force-dynamic";
export default async function ConnectPage(){if(!isStudioAdmin(await getChatGPTUser()))redirect("/");return <main className="connection-page"><a className="back-link" href="/">← Back to ForgeLinc</a><p className="eyebrow">FORGELINC / CONNECTIONS</p><h1>Connect your store.</h1><p className="connection-intro">Connect Shopify for your storefront and Printify for your team merchandise.</p><nav className="connection-links" aria-label="Connections"><a href="#shopify">Shopify</a><a href="#printify">Printify</a><a href="#checkout">Checkout</a><a href="/orders">Orders &amp; sizes</a></nav><div id="shopify"><ShopifyConnectionCard/></div><PrintifyConnectionCard/><ShopifyCheckoutCard/><p className="fine-print">After connecting, open Send to Printify draft to prepare and review your first jersey.</p></main>;}
