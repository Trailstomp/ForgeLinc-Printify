import {redirect} from "next/navigation";
import {getChatGPTUser} from "../chatgpt-auth";
import {isStudioAdmin} from "@/lib/studio-access";
import OrderReview from "../order-review";
export const dynamic="force-dynamic";
export default async function OrdersPage(){if(!isStudioAdmin(await getChatGPTUser()))redirect("/");return <main className="order-review-page"><a className="back-link" href="/">← Back to ForgeLinc</a><OrderReview/></main>;}
