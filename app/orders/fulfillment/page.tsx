import {redirect} from "next/navigation";
import {getChatGPTUser} from "../../chatgpt-auth";
import {isStudioAdmin} from "@/lib/studio-access";
import FulfillmentReview from "../../fulfillment-review";
export const dynamic="force-dynamic";
export default async function FulfillmentPage(){if(!isStudioAdmin(await getChatGPTUser()))redirect("/");return <main className="transfer-page"><a className="back-link" href="/orders">← Back to orders</a><FulfillmentReview/></main>;}
