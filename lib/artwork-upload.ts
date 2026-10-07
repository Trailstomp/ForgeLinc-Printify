import {apiFetch,readApiJson} from "@/lib/api-client";
export async function uploadArtwork(file:File):Promise<{id:string;name:string}> {
 if(!["image/png","image/jpeg"].includes(file.type)||file.size>20*1024*1024)throw new Error("Choose a PNG or JPG smaller than 20 MB.");
 const bitmap=await createImageBitmap(file);
 try {
  if(bitmap.width>12000||bitmap.height>12000||bitmap.width*bitmap.height>40000000)throw new Error("Choose an image under 40 megapixels and 12,000 pixels per side.");
  const canvas=document.createElement("canvas");canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext("2d")!.drawImage(bitmap,0,0);
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Image could not be prepared.")),"image/png"));canvas.width=1;canvas.height=1;
  if(blob.size>20*1024*1024)throw new Error("This image is too large after conversion. Choose a smaller image.");
  const response=await apiFetch("/api/artwork?name="+encodeURIComponent(file.name),{method:"POST",headers:{"Content-Type":"image/png"},body:blob});
  const result=await readApiJson(response) as {artwork?:{id:string;name:string};error?:string};
  if(!response.ok||!result.artwork)throw new Error(result.error||"Upload failed. Please try again.");
  return result.artwork;
 }finally{bitmap.close();}
}
