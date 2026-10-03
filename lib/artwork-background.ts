/** Remove only pale, neutral pixels connected to the canvas edge.
 * Enclosed white uniforms, lettering and highlights remain opaque.
 * Returns a separate RGBA buffer, leaving the source artwork intact.
 */
export function removeOuterWhite(data:Uint8ClampedArray,width:number,height:number,seeds:readonly [number,number][]=[]){
 const count=width*height;
 if(data.length!==count*4)throw new Error("Invalid artwork dimensions");
 const result=new Uint8ClampedArray(data);
 const candidate=new Uint8Array(count),visited=new Uint8Array(count),queue=new Int32Array(count);
 for(let p=0;p<count;p++){const i=p*4,lo=Math.min(data[i],data[i+1],data[i+2]),hi=Math.max(data[i],data[i+1],data[i+2]);candidate[p]=data[i+3]===0||(lo>=218&&hi-lo<=32)?1:0;}
 // Closing narrow gaps in foreground outlines prevents the mask from leaking into white kits.
 const radius=5;
 function box(mask:Uint8Array,dilate:boolean){
  const horizontal=new Uint8Array(count),out=new Uint8Array(count);
  for(let y=0;y<height;y++){
   let sum=0;for(let x=0;x<=radius&&x<width;x++)sum+=mask[y*width+x];
   for(let x=0;x<width;x++){
    const length=Math.min(width-1,x+radius)-Math.max(0,x-radius)+1;
    horizontal[y*width+x]=dilate?(sum>0?1:0):(sum===length?1:0);
    if(x-radius>=0)sum-=mask[y*width+x-radius];if(x+radius+1<width)sum+=mask[y*width+x+radius+1];
   }
  }
  for(let x=0;x<width;x++){
   let sum=0;for(let y=0;y<=radius&&y<height;y++)sum+=horizontal[y*width+x];
   for(let y=0;y<height;y++){
    const length=Math.min(height-1,y+radius)-Math.max(0,y-radius)+1;
    out[y*width+x]=dilate?(sum>0?1:0):(sum===length?1:0);
    if(y-radius>=0)sum-=horizontal[(y-radius)*width+x];if(y+radius+1<height)sum+=horizontal[(y+radius+1)*width+x];
   }
  }
  return out;
 }
 const interior=box(candidate,false),background=new Uint8Array(count);
 let head=0,tail=0;
 const add=(p:number)=>{if(visited[p])return;visited[p]=1;if(interior[p]){queue[tail++]=p;background[p]=1;}};
 for(const [x,y] of seeds){if(x>=0&&x<width&&y>=0&&y<height)add(Math.floor(y)*width+Math.floor(x));}
 for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}
 for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
 while(head<tail){const p=queue[head++];if(p%width>0)add(p-1);if(p%width<width-1)add(p+1);if(p>=width)add(p-width);if(p<count-width)add(p+width);}
 const matte=box(background,true);
 for(let p=0;p<count;p++){
  if(!matte[p]||!candidate[p])continue;
  const i=p*4;
  const lo=Math.min(data[i],data[i+1],data[i+2]);
  const alpha=Math.max(0,Math.min(1,(247-lo)/29));
  const nextAlpha=Math.round(data[i+3]*alpha);
  if(nextAlpha===data[i+3])continue;
  result[i+3]=nextAlpha;
  if(alpha>0&&alpha<1){for(let channel=0;channel<3;channel++)result[i+channel]=Math.max(0,Math.min(255,(data[i+channel]-255*(1-alpha))/alpha));}
 }
 return result;
}

const cutouts=new Map<string,Promise<HTMLImageElement>>();
export function loadBackArtwork(src:string):Promise<HTMLImageElement>{
 if(!cutouts.has(src))cutouts.set(src,new Promise<HTMLImageElement>((resolve,reject)=>{
  const original=new Image();
  original.onerror=()=>reject(new Error("Back artwork could not be loaded"));
  original.onload=()=>{
   if(src.startsWith("/assets/rosters/")){resolve(original);return;}
   try{
    const canvas=document.createElement("canvas");canvas.width=original.naturalWidth;canvas.height=original.naturalHeight;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});if(!ctx)throw new Error("Canvas unavailable");
    ctx.drawImage(original,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    pixels.data.set(removeOuterWhite(pixels.data,canvas.width,canvas.height));ctx.putImageData(pixels,0,0);
    canvas.toBlob(blob=>{
     if(!blob){reject(new Error("Back artwork could not be prepared"));return;}
     const url=URL.createObjectURL(blob),cutout=new Image();
     cutout.onload=()=>resolve(cutout);
     cutout.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Back artwork could not be prepared"));};
     cutout.src=url;
    },"image/png");
   }catch(error){reject(error);}
  };
  original.src=src;
 }).catch(error=>{cutouts.delete(src);throw error;}));
 return cutouts.get(src)!;
}
