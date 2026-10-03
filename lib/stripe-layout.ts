import type {TemplateConfig} from "./catalog";
export function stripeLayout(cfg:TemplateConfig):"wedges"|"bands"{return cfg.stripeLayout??(["straight","lightning","pixels","digital-camo","custom"].includes(cfg.stripeStyle)?"bands":"wedges");}
/** Sleeve bands use the same height adjustment, scaled to their shorter panel. */
export function bandCoverage(cfg:TemplateConfig,sleeve=false){const height=cfg.bandHeight??.27;return sleeve?Math.min(.75,height*.45/.27):height;}
export function wedgeEdge(c:CanvasRenderingContext2D,w:number,h:number,start:number,tip:number,style:string){
 c.moveTo(0,h*start);
 if(style==="angular"){c.lineTo(w*tip*.38,h*.77);c.lineTo(w*tip,h);}
 else if(style==="straight")c.lineTo(w*tip,h);
 else if(style==="curved"){c.moveTo(0,h*(start+.12));c.bezierCurveTo(w*tip*.08,h*(start+.15),w*tip*.30,h*.86,w*tip*.70,h);}
 else c.bezierCurveTo(w*.04,h*.68,w*tip*.63,h*.86,w*tip,h);
 c.lineTo(0,h);c.closePath();
}
function bandEdge(c:CanvasRenderingContext2D,w:number,h:number,y:number,style:string,sleeve:boolean,scale:number){
 c.moveTo(0,h*y);const a=(sleeve?.05:.025)*scale;
 if(style==="angular"){c.lineTo(w*.5,h*(y+a*2));c.lineTo(w,h*y);}
 else if(style==="curved")c.bezierCurveTo(w*.2,h*(y+a*.25),w*.8,h*(y+a*1.2),w,h*y);
 else if(style==="sweep")c.bezierCurveTo(w*.25,h*(y+a*2),w*.75,h*(y+a*2),w,h*y);
 else c.lineTo(w,h*y);
 c.lineTo(w,h);c.lineTo(0,h);c.closePath();
}
export function drawStripeBands(c:CanvasRenderingContext2D,w:number,h:number,cfg:TemplateConfig,sleeve=false){
 const colors=[cfg.primary,cfg.shirtColor,cfg.accent,cfg.shirtColor,cfg.trimColor,cfg.shirtColor,cfg.primary];
 const starts=sleeve?[.55,.59,.62,.665,.695,.735,.76]:[.73,.78,.80,.835,.855,.875,.895];
 const scale=bandCoverage(cfg,sleeve)/(sleeve?.45:.27);
 starts.forEach((y,i)=>{c.fillStyle=colors[i];c.beginPath();bandEdge(c,w,h,1-(1-y)*scale,cfg.stripeStyle,sleeve,scale);c.fill();});
}
/** A shared clipping silhouette for pixel/camo fills and uploaded images. */
export function clipStripeShape(c:CanvasRenderingContext2D,w:number,h:number,cfg:TemplateConfig,sleeve=false){
 c.beginPath();
 if(stripeLayout(cfg)==="bands")c.rect(0,h*(1-bandCoverage(cfg,sleeve)),w,h);
 else if(sleeve){c.moveTo(0,h*.55);c.bezierCurveTo(w*.25,h*.81,w*.75,h*.81,w,h*.55);c.lineTo(w,h);c.lineTo(0,h);c.closePath();}
 else {wedgeEdge(c,w,h,.29,.48,"sweep");c.save();c.translate(w,0);c.scale(-1,1);wedgeEdge(c,w,h,.29,.48,"sweep");c.restore();}
 c.clip();
}
