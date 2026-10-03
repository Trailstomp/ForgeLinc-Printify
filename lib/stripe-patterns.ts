import {stripeLayout,clipStripeShape,bandCoverage} from "./stripe-layout";
import type {TemplateConfig} from "./catalog";
export const isPatternStyle=(style:TemplateConfig["stripeStyle"])=>style==="pixels"||style==="digital-camo";
// Fixed coordinate noise keeps patterns identical when previewing, saving,
// switching teams and exporting full-resolution print panels.
function noise(x:number,y:number,salt=0){let n=Math.imul(x+31,374761393)^Math.imul(y+57,668265263)^Math.imul(salt+1,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;}
export function drawStripePattern(c:CanvasRenderingContext2D,w:number,h:number,cfg:TemplateConfig,sleeve=false){
 const wedges=stripeLayout(cfg)==="wedges",top=h*(wedges?(sleeve?.55:.29):1-bandCoverage(cfg,sleeve)),height=h-top;
 c.save();clipStripeShape(c,w,h,cfg,sleeve);
 c.fillStyle=cfg.shirtColor;c.fillRect(0,top,w,height);
 {
  const cols=48,rows=sleeve?14:wedges?40:16,cw=w/cols,ch=height/rows;
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
   const r=noise(x,y),progress=y/(rows-1);let color:string;
   if(cfg.stripeStyle==="pixels"){
    // Small squares dissolve upward into the shirt, gathering toward the hem.
    if(r>Math.min(1,.65+progress*.5))continue;
    const pick=noise(x,y,4);color=pick<.56?cfg.primary:pick<.79?cfg.accent:cfg.trimColor;
   }else{
    // Coarse contiguous islands with square stair-step edges, rather than
    // independent confetti pixels. Fine noise breaks up the larger blocks.
    if(y<2&&noise(Math.floor(x/3),0,2)>.38+y*.35)continue;
    const field=noise(Math.floor(x/4),Math.floor(y/3),7)*.68+noise(Math.floor((x+2)/3),Math.floor((y+1)/2),3)*.24+r*.08;
    color=field<.29?cfg.shirtColor:field<.52?cfg.primary:field<.69?cfg.trimColor:cfg.accent;
   }
   c.fillStyle=color;c.fillRect(x*cw,top+y*ch,cw+.2,ch+.2);
  }
 }
 c.restore();
}
