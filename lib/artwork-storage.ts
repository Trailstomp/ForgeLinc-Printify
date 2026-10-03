import {env} from "cloudflare:workers";
import type {R2Bucket} from "@cloudflare/workers-types";
import {database} from "./storage";
import {ConnectionError} from "./shopify-connection";
import type {TemplateConfig} from "./catalog";
function bucket(){const b=(env as unknown as {ARTWORK?:R2Bucket}).ARTWORK;if(!b)throw new ConnectionError("Artwork storage is temporarily unavailable.",503);return b;}
const key=(owner:string,id:string)=>"artwork/"+encodeURIComponent(owner)+"/"+id+".png";
export function pngDimensions(bytes:Uint8Array){
 if(bytes.length<33||[137,80,78,71,13,10,26,10].some((v,i)=>bytes[i]!==v)||String.fromCharCode(...bytes.slice(12,16))!=="IHDR")throw new ConnectionError("Choose a PNG or JPG image.");
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),width=v.getUint32(16),height=v.getUint32(20);
 if(!width||!height||width>12000||height>12000||width*height>40000000)throw new ConnectionError("Choose an image under 40 megapixels and 12,000 pixels per side.");
 return {width,height};
}
export async function saveArtwork(owner:string,bytes:Uint8Array,name:string){
 const {width,height}=pngDimensions(bytes),id=crypto.randomUUID(),b=bucket();
 const cleanName=name.replace(/[\x00-\x1f/\\]/g,"_").slice(0,120)||"Uploaded artwork";
 await b.put(key(owner,id),bytes,{httpMetadata:{contentType:"image/png"}});
 try{await database().prepare("INSERT INTO artwork_files(owner,id,name,width,height,created_at) VALUES(?,?,?,?,?,?)").bind(owner,id,cleanName,width,height,new Date().toISOString()).run();}
 catch(e){await b.delete(key(owner,id));throw e;}
 return {id,name:cleanName,width,height,url:"/api/artwork/"+id};
}
export async function getArtwork(owner:string,id:string){
 const record=(await database().prepare("SELECT id FROM artwork_files WHERE owner=? AND id=?").bind(owner,id).all<{id:string}>()).results[0];
 if(!record)return null;return bucket().get(key(owner,id));
}
export async function validateArtworkOwnership(owner:string,configs:TemplateConfig[],extraIds:string[]=[]){
 const ids=[...new Set([...extraIds,...configs.flatMap(c=>[c.stripeAssetId,...Object.values(c.artwork??{}).map(a=>a?.assetId)].filter((id):id is string=>!!id))])];
 if(!ids.length)return;
 let found=0;
 for(let offset=0;offset<ids.length;offset+=90){const chunk=ids.slice(offset,offset+90);const rows=await database().prepare("SELECT id FROM artwork_files WHERE owner=? AND id IN ("+chunk.map(()=>"?").join(",")+")").bind(owner,...chunk).all<{id:string}>();found+=rows.results.length;}
 if(found!==ids.length)throw new ConnectionError("Some artwork is unavailable in your account. Upload it again before saving.",403);
}
