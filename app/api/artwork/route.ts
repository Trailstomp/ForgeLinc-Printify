import {STUDIO_OWNER_ID} from "@/lib/studio-access";
import {shopperSettings} from "@/lib/shopper-settings";
import {saveArtwork} from "@/lib/artwork-storage";
import {artworkViewer,transferJson,transferError,readBounded} from "@/lib/transfer-http";
export const dynamic="force-dynamic";
export async function POST(req:Request){try{
 const owner=await artworkViewer(req);
 if(owner!==STUDIO_OWNER_ID&&!(await shopperSettings()).allowCustomImages)return transferJson({error:"Customer image uploads are turned off. Choose one of the team’s saved artwork options."},403);
 if(req.headers.get("content-type")!=="image/png")return transferJson({error:"Choose a PNG or JPG image."},415);
 const name=new URL(req.url).searchParams.get("name")??"Uploaded artwork";
 return transferJson({artwork:await saveArtwork(owner,await readBounded(req,20*1024*1024),name)});
 }catch(e){return transferError(e);}}
