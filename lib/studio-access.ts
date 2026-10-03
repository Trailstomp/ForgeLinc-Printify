import {getChatGPTUser,type ChatGPTUser} from "@/app/chatgpt-auth";
import {ConnectionError} from "./shopify-connection";
// Stable Site-scoped identity of the verified owner of this ForgeLinc workspace.
// Never infer an administrator from sign-in alone or a client-supplied role.
export const STUDIO_OWNER_ID="vkSAwMalwAxHfD2552k5PgdF2IOQrvf1V18u6gnhbQQOqMVj7Yz0SE";
export function isStudioAdmin(user:ChatGPTUser|null){return !!user&&user.userId===STUDIO_OWNER_ID;}
export async function requireStudioAdmin(){
 const user=await getChatGPTUser();
 if(!user)throw new ConnectionError("Please sign in.",401);
 if(!isStudioAdmin(user))throw new ConnectionError("Merch Studio is reserved for the ForgeLinc administrator.",403);
 return user;
}
