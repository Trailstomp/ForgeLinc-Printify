import {artworkLayer,type TemplateConfig} from "./catalog";
import {reserveBackNameSpace,backNameSpace} from "./back-artwork-layout";
import {supportingPlayers} from "./buddy-roster-layout";
import teams from "./teams.json";
type Source=CanvasImageSource & {width:number;height:number};
const rosters=new Map<string,Promise<HTMLCanvasElement>>(),players=new Map<string,HTMLCanvasElement>();
export const waistBadge={x:.525,y:.615,width:.265};
export const rosterSplit=.165;
export function isWaistRoster(src:string){const id=/^\/assets\/rosters\/([a-z0-9-]+)-v4\.png$/.exec(src)?.[1];return !!id&&teams.some(t=>t.id===id);}
function trimmedPlayer(id:string,source:Source){
 const cached=players.get(id);if(cached)return cached;
 const cv=document.createElement("canvas");cv.width=source.width;cv.height=source.height;const c=cv.getContext("2d")!;c.drawImage(source,0,0);
 const d=c.getImageData(0,0,cv.width,cv.height).data;let left=cv.width,top=cv.height,right=0,bottom=0;
 for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(d[(y*cv.width+x)*4+3]>20){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 const out=document.createElement("canvas");out.width=right-left+1;out.height=Math.ceil((bottom-top+1)*.68);const ctx=out.getContext("2d")!;ctx.drawImage(cv,-left,-top);
 ctx.globalCompositeOperation="destination-in";const fade=ctx.createLinearGradient(0,out.height*.84,0,out.height);fade.addColorStop(0,"#000");fade.addColorStop(1,"#0000");ctx.fillStyle=fade;ctx.fillRect(0,0,out.width,out.height);
 players.set(id,out);return out;
}
/** Reuse the locked identities and featured pair; change only badge layering. */
export function loadWaistRoster(src:string,load:(src:string)=>Promise<HTMLImageElement>){
 if(!rosters.has(src))rosters.set(src,(async()=>{
  const id=src.split("/").pop()!.replace("-v4.png",""),foreground=supportingPlayers(id).slice(7);
  const [original,...images]=await Promise.all([load(src),...foreground.map(p=>load("/assets/players/"+p.id+"-cutout-v1.png"))]);
  const cv=document.createElement("canvas");cv.width=original.width;cv.height=original.height;const c=cv.getContext("2d")!,w=cv.width,h=cv.height;
  c.drawImage(original,0,0);c.clearRect(0,0,w,h*rosterSplit);
  const bw=w*waistBadge.width,bh=bw*(h*.16)/(w*.245),x=w*waistBadge.x-bw/2,y=h*waistBadge.y;
  c.drawImage(original,w*.3875,h*.005,w*.245,h*.16,x,y,bw,bh);
  // Only repaint the badge intersection: foreground helmets/arms overlap its
  // outer edge while their original chest logos and the MLBL lettering remain.
  c.save();c.beginPath();c.rect(x,y,bw,bh);c.clip();
  foreground.forEach((p,i)=>{const im=trimmedPlayer(p.id,images[i]),ph=h*p.height,pw=ph*im.width/im.height;c.drawImage(im,w*p.x-pw/2,h*p.y,pw,ph);});c.restore();
  return cv;
 })().catch(e=>{rosters.delete(src);throw e;}));
 // Full-resolution composites are large; retain only the three recent teams.
 while(rosters.size>3)rosters.delete(rosters.keys().next().value!);
 return rosters.get(src)!;
}
/** Automatic name clearance plus a true one-to-one manual vertical offset. */
export function backRosterFrame(cfg:TemplateConfig,w:number,h:number){
 const layer=artworkLayer(cfg,"back",{width:w,height:h}),topMargin=backNameSpace.plainTop;
 const naturalHeight=w*cfg.backScale*1.65*layer.scale*(2800*(1-rosterSplit)/2400);
 const height=Math.min(naturalHeight,h*(.92-topMargin)),width=height*2400/(2800*(1-rosterSplit));
 const neutralY=cfg.backY+cfg.backScale*w/h*.75;
 const top=h*(topMargin+layer.y-neutralY),left=w*layer.x-width/2;
 const frame=reserveBackNameSpace({left,top,width,height},cfg,h);
 return {...frame,centerY:frame.top+frame.height/2};
}
export function drawWaistRoster(c:CanvasRenderingContext2D,image:Source,cfg:TemplateConfig,w:number,h:number){
 const f=backRosterFrame(cfg,w,h);c.drawImage(image,0,image.height*rosterSplit,image.width,image.height*(1-rosterSplit),f.left,f.top,f.width,f.height);
}
