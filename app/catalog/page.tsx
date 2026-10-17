import { redirect } from "next/navigation";
import { getChatGPTUser } from "../chatgpt-auth";
import { isStudioAdmin } from "@/lib/studio-access";
import CatalogManager from "./catalog-manager";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  if (!isStudioAdmin(await getChatGPTUser())) redirect("/");
  return <CatalogManager />;
}
