import {STUDIO_OWNER_ID} from "@/lib/studio-access";
import {isShopArtwork} from "@/lib/shop-catalog";
import {getArtwork} from "@/lib/artwork-storage";
import {artworkViewer,transferJson,transferError} from "@/lib/transfer-http";
export const dynamic="force-dynamic";
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){try{
 const owner=await artworkViewer(),{id}=await params;
 if(!/^[a-f0-9-]{36}$/i.test(id))return transferJson({error:"Artwork not found."},404);
 let object=await getArtwork(owner,id);
 if(!object&&owner!==STUDIO_OWNER_ID&&await isShopArtwork(id))object=await getArtwork(STUDIO_OWNER_ID,id);if(!object)return transferJson({error:"Artwork not found."},404);
 return new Response(object.body as unknown as ReadableStream,{headers:{"Content-Type":"image/png","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch(e){return transferError(e);}}
