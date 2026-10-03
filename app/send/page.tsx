import PrintifyDraftSender from "../printify-draft-sender";
import {getChatGPTUser} from "../chatgpt-auth";
import {isStudioAdmin} from "@/lib/studio-access";
import {redirect} from "next/navigation";
export const dynamic="force-dynamic";
export default async function SendPage(){if(!isStudioAdmin(await getChatGPTUser()))redirect("/");return <main className="transfer-page"><a className="back-link" href="/">← Back to ForgeLinc</a><PrintifyDraftSender/></main>;}
