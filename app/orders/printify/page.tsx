import {redirect} from "next/navigation";
import {getChatGPTUser} from "../../chatgpt-auth";
import {isStudioAdmin} from "@/lib/studio-access";
import OrderPrintifySender from "../../order-printify-sender";
export const dynamic="force-dynamic";
export default async function OrderPrintifyPage(){if(!isStudioAdmin(await getChatGPTUser()))redirect("/");return <main className="transfer-page"><a className="back-link" href="/orders">← Back to order review</a><OrderPrintifySender/></main>;}
