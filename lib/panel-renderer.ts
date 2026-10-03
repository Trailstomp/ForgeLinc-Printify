import {backImageFrame} from "./back-artwork-layout";
import {isMetallicStyle,drawMetallicStripes} from "./stripe-metallic";
import {drawStripeLightning} from "./stripe-lightning";
import {isWaistRoster,loadWaistRoster,drawWaistRoster} from "./waist-roster";
import {drawPlayerPersonalization,drawRosterWithFooter} from "./player-personalization";
import {stripeLayout,drawStripeBands,wedgeEdge,clipStripeShape,bandCoverage} from "./stripe-layout";
import {isPatternStyle,drawStripePattern} from "./stripe-patterns";
import {panels,themeLabel,artworkLayer,type Team,type PanelId,type TemplateConfig} from "./catalog";
import {zipFiles,download} from "./zip";
import {loadBackArtwork} from "./artwork-background";
const cache=new Map<string,Promise<HTMLImageElement>>();
function img(src:string){if(!cache.has(src))cache.set(src,new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>{cache.delete(src);reject(new Error("Artwork could not be loaded"));};i.src=src;}));return cache.get(src)!;}
function place(ctx:CanvasRenderingContext2D,i:CanvasImageSource & {width:number;height:number},x:number,y:number,w:number,h:number,flip=false){const scale=Math.min(w/i.width,h/i.height),dw=i.width*scale,dh=i.height*scale;ctx.save();ctx.translate(x+w/2,y+h/2);if(flip)ctx.scale(-1,1);ctx.drawImage(i,-dw/2,-dh/2,dw,dh);ctx.restore();}
async function bodyStripes(c:CanvasRenderingContext2D,w:number,h:number,cfg:TemplateConfig){
 if(cfg.stripeStyle==="none"||cfg.stripeStyle==="custom")return;
 if(isMetallicStyle(cfg.stripeStyle)){await drawMetallicStripes(c,w,h,cfg);return;}
 if(cfg.stripeStyle==="lightning"){await drawStripeLightning(c,w,h,cfg);return;}
 if(isPatternStyle(cfg.stripeStyle)){drawStripePattern(c,w,h,cfg);return;}
 // Nested sweeps create the three-color, tapering flank bands of the approved sample.
 if(stripeLayout(cfg)==="bands"){drawStripeBands(c,w,h,cfg);return;}
 const bands:[number,number,string][]=[
  [.29,.48,cfg.primary],[.35,.445,cfg.shirtColor],
  [.38,.425,cfg.accent],[.435,.397,cfg.shirtColor],
  [.465,.38,cfg.trimColor],[.515,.35,cfg.shirtColor],[.545,.333,cfg.primary]
 ];
 for(const flip of [false,true]){c.save();if(flip){c.translate(w,0);c.scale(-1,1);}
  for(const [start,tip,color] of bands){c.fillStyle=color;c.beginPath();wedgeEdge(c,w,h,start,tip,cfg.stripeStyle);c.fill();}
  c.restore();
 }
}
export async function renderPanel(canvas:HTMLCanvasElement,id:PanelId,team:Team,cfg:TemplateConfig,preview:boolean|"texture"=false,guides=false,dimensions?:{width:number;height:number}){
 const p=dimensions??panels.find(p=>p.id===id)!;const ratio=preview==="texture"?Math.min(1,3072/p.width,3072/p.height):preview?Math.min(900/p.width,600/p.height):1;
 canvas.width=Math.round(p.width*ratio);canvas.height=Math.round(p.height*ratio);
 const c=canvas.getContext("2d")!;c.scale(ratio,ratio);const w=p.width,h=p.height;c.fillStyle=cfg.shirtColor;c.fillRect(0,0,w,h);
 const backBehind=cfg.backBehindStripes&&stripeLayout(cfg)!=="bands";
 let rosterFooter:(()=>void)|undefined;
 if(id==="front"||id==="back"){
 if(id!=="back"||!backBehind)await bodyStripes(c,w,h,cfg);
 }else if(id==="collar"){c.fillStyle=cfg.primary;c.fillRect(0,0,w,h);c.fillStyle=cfg.accent;c.fillRect(0,h*.27,w,h*.13);c.fillStyle=cfg.trimColor;c.fillRect(0,h*.43,w,h*.065);}
 else if(isMetallicStyle(cfg.stripeStyle)){await drawMetallicStripes(c,w,h,cfg,true,id==="left-sleeve");}
 else if(cfg.stripeStyle==="lightning"){await drawStripeLightning(c,w,h,cfg,true,id==="left-sleeve");}
 else if(isPatternStyle(cfg.stripeStyle)){drawStripePattern(c,w,h,cfg,true);}
 else if(stripeLayout(cfg)==="bands"&&cfg.stripeStyle!=="none"&&cfg.stripeStyle!=="custom"){drawStripeBands(c,w,h,cfg,true);}
 else if(cfg.stripeStyle!=="none"&&cfg.stripeStyle!=="custom"){
 c.save();if(id==="left-sleeve"){c.translate(w,0);c.scale(-1,1);}
 const bands:[number,string][]=[[.55,cfg.primary],[.59,cfg.shirtColor],[.62,cfg.accent],[.665,cfg.shirtColor],[.695,cfg.trimColor],[.735,cfg.shirtColor],[.76,cfg.primary]];
 for(const [start,color] of bands){c.fillStyle=color;c.beginPath();c.moveTo(0,h*start);
  if(!cfg.stripeStyle)c.bezierCurveTo(w*.30,h*(start+.26),w*.67,h*(start+.15),w,h*(start-.25));
  else if(cfg.stripeStyle==="straight")c.lineTo(w,h*start);
  else if(cfg.stripeStyle==="angular"){c.lineTo(w*.5,h*(start+.18));c.lineTo(w,h*start);}
  else if(cfg.stripeStyle==="curved"){c.moveTo(0,h*(start+.15));c.bezierCurveTo(w*.2,h*(start+.10),w*.8,h*(start+.20),w,h*(start+.15));}
  else c.bezierCurveTo(w*.25,h*(start+.26),w*.75,h*(start+.26),w,h*start);
  c.lineTo(w,h);c.lineTo(0,h);c.closePath();c.fill();}c.restore();
 }
 async function customStripes(){if(cfg.stripeStyle!=="custom"||!cfg.stripeAssetId||id==="collar")return;const art=await img("/api/artwork/"+cfg.stripeAssetId),sh=h*(id.includes("sleeve")?Math.min(.85,cfg.stripeHeight*1.35):cfg.stripeHeight);c.save();if(cfg.stripeLayout)clipStripeShape(c,w,h,cfg,id.includes("sleeve"));if(id==="left-sleeve"){c.translate(w,0);c.scale(-1,1);}const coverage=stripeLayout(cfg)==="bands"&&cfg.bandHeight!==undefined?h*bandCoverage(cfg,id.includes("sleeve")):cfg.stripeLayout==="wedges"?h*(id.includes("sleeve")?.45:.71):sh;c.drawImage(art,0,h-coverage,w,coverage);c.restore();}
 if(id!=="back"||!backBehind)await customStripes();

 {
  const layer=artworkLayer(cfg,id,{width:w,height:h});
  if(layer.visible&&(id!=="collar"||layer.assetId)){
   const custom=layer.assetId?"/api/artwork/"+layer.assetId:null;
   const membership=id==="right-sleeve"&&!custom&&cfg.sleeveStyle==="membership-head-v1";
   const source=custom??(id==="front"?team.logo:id==="back"?team.back:id==="right-sleeve"?(membership?"/assets/membership-head-angled-v2.png":"/assets/qr.png"):"/assets/mlbl.png");
   const roster=id==="back"&&!custom&&source.startsWith("/assets/rosters/");
   const waist=roster&&cfg.backBadgePosition==="waist"&&isWaistRoster(source);
   const image=waist?await loadWaistRoster(source,img):id==="back"&&!custom&&!roster?await loadBackArtwork(source):await img(source);
   const bw=(id==="collar"?w*.8:id==="front"?w*cfg.frontScale:id==="back"?w*cfg.backScale*(roster?1.65:1):w*(membership?.28:.22))*layer.scale;
   const bh=(id==="collar"?h*.8:id==="front"?h*.43:id==="back"?w*cfg.backScale*(roster?1.65*image.height/image.width:1.5):membership?h*.56:id==="left-sleeve"?h*.43:h*.44)*layer.scale;
   c.save();
   if(preview==="texture"&&(id==="front"||id==="back")){
    // The preview torso is 1.32 wide by 1.93 high at the artwork area.
    // Compensate its narrower shape so square source art stays square on
    // the model. Production print panels and editor placement stay unchanged.
    const cx=w*layer.x,cy=h*layer.y;
    c.translate(cx,cy);c.scale((w/h)/(1.32/1.93),1);c.translate(-cx,-cy);
   }
   if(waist)drawWaistRoster(c,image,cfg,w,h);
   else if(roster&&cfg.backBadgePosition==="bottom")rosterFooter=drawRosterWithFooter(c,image,w*layer.x,h*layer.y,bw,bh,w,h);
   else if(id==="back"){const f=backImageFrame(cfg,w,h,layer.x,layer.y,bw,bh);place(c,image,f.left,f.top,f.width,f.height);}
   else place(c,image,w*layer.x-bw/2,h*layer.y-bh/2,bw,bh,id==="front"&&!custom&&team.mirror);
   c.restore();
   if(id==="left-sleeve"&&layer.caption){
    const rgb=cfg.shirtColor.slice(1).match(/../g)!.map(v=>parseInt(v,16));
    c.fillStyle=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114<145?"#ffffff":"#11283d";
    c.font="italic "+h*.048*layer.scale+"px Georgia";c.textAlign="center";
    c.fillText("Proud member of...",w*layer.x,h*layer.y-h*.225*layer.scale);
   }
  }
 }

 // Paint the opaque flank sweeps over the back print so players tuck behind them.
 if(id==="back"&&backBehind){await bodyStripes(c,w,h,cfg);await customStripes();}
 // The badge remains legible over the lower pattern, below every player's jersey.
 if(rosterFooter){c.save();if(preview==="texture"){const x=w*artworkLayer(cfg,"back").x;c.translate(x,0);c.scale((w/h)/(1.32/1.93),1);c.translate(-x,0);}rosterFooter();c.restore();}
 drawPlayerPersonalization(c,id,w,h,cfg,preview==="texture");
 if(guides){const guide=await img("/assets/guide-"+id+".png");c.save();c.globalAlpha=.28;c.drawImage(guide,0,0,w,h);c.restore();}
}
export async function exportPanels(team:Team,cfg:TemplateConfig,onProgress:(s:string)=>void){
 const files:{name:string;bytes:Uint8Array}[]=[];
 for(const p of panels){onProgress("Preparing "+p.name.toLowerCase()+"…");const cv=document.createElement("canvas");await renderPanel(cv,p.id,team,cfg);const blob=await new Promise<Blob>((r,j)=>cv.toBlob(b=>b?r(b):j(new Error("Export failed")),"image/png"));files.push({name:p.id+".png",bytes:new Uint8Array(await blob.arrayBuffer())});cv.width=1;cv.height=1;}
 const notes="ForgeLinc — "+team.name+" — "+themeLabel(cfg)+" — "+cfg.frontLogoLabel+" — Brotherhood Jersey\n\nDraft print panels built from the supplied Miami Sublimation template dimensions.\n"+panels.map(p=>p.name+": "+p.width+" x "+p.height+" px").join("\n")+"\n\nGuides are excluded from print PNGs. Artwork sources remain unchanged; pixel enlargement does not recover fine detail.\nCheck placement, bleed, sizes, QR scan and image quality in the current Printify editor, then order a sample before selling.\nThe collar defaults to stripes; any custom collar artwork needs careful checking in the provider preview.\nNo product has been published and no order has been submitted.\n";
 files.push({name:"READ_ME.txt",bytes:new TextEncoder().encode(notes)});
 files.push({name:"template.json",bytes:new TextEncoder().encode(JSON.stringify({template:"brotherhood-v1",teamId:team.id,team,config:cfg,panels},null,2))});
 download(zipFiles(files),team.id+"-"+themeLabel(cfg).toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-"+(cfg.frontLogoLabel??"team-crest").toLowerCase().replace(/[^a-z0-9]+/g,"-")+"-jersey-panels.zip");
}
