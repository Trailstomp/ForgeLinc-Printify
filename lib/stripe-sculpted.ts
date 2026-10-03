import type {TemplateConfig} from "./catalog";
import {bandCoverage,clipStripeShape,stripeLayout} from "./stripe-layout";
type Point=[number,number]; // across the trim, along the trim
const mix=(hex:string,amount:number)=>{const channels=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return '#'+channels.map(v=>Math.round(amount<0?v*(1+amount):v+(255-v)*amount).toString(16).padStart(2,'0')).join('');};
function edge(y:number){let lo=0,hi=1;for(let i=0;i<22;i++){const t=(lo+hi)/2,s=1-t,v=s*s*s*.29+3*s*s*t*.68+3*s*t*t*.86+t*t*t;if(v<y)lo=t;else hi=t;}const t=(lo+hi)/2,s=1-t;return 3*s*s*t*.04+3*s*t*t*.3024+t*t*t*.48;}
/** Continuous vector surfaces follow the print silhouette. No sliced or stretched textures. */
export function drawSculptedStripes(c:CanvasRenderingContext2D,w:number,h:number,cfg:TemplateConfig,sleeve=false,flip=false){
 const band=stripeLayout(cfg)==="bands",horizontal=band||sleeve;
 c.save();clipStripeShape(c,w,h,cfg,sleeve);
 c.fillStyle=cfg.primary;c.fillRect(0,0,w,h);
 const background=c.createLinearGradient(0,0,w,h);background.addColorStop(0,mix(cfg.primary,-.72));background.addColorStop(.48,cfg.primary);background.addColorStop(1,mix(cfg.primary,-.6));c.fillStyle=background;c.fillRect(0,0,w,h);
 for(const mirrored of horizontal?[flip]:[false,true]){
  c.save();if(mirrored){c.translate(w,0);c.scale(-1,1);}
  const project=([u,t]:Point):Point=>{
   if(!horizontal){const y=.29+.71*t;return [w*edge(y)*u,h*y];}
   const height=band?bandCoverage(cfg,sleeve):.45-.78*t*(1-t);
   const x=band?t:3*(1-t)*(1-t)*t*.25+3*(1-t)*t*t*.75+t*t*t;
   return [w*x,h*(1-height*u)];
  };
  // Subdivide edges in design coordinates so they follow the contour smoothly,
  // while the deliberate lightning corners remain sharply defined.
  function trace(points:Point[]){c.beginPath();const first=project(points[0]);c.moveTo(...first);for(let i=1;i<=points.length;i++){const a=points[i-1],b=points[i%points.length],n=Math.max(1,Math.ceil(Math.abs(a[1]-b[1])*90));for(let j=1;j<=n;j++)c.lineTo(...project([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]));}c.closePath();}
  function surface(points:Point[],color:string,metal=true){
   trace(points);if(metal){const g=horizontal?c.createLinearGradient(0,h*(1-(band?bandCoverage(cfg,sleeve):.45)),0,h):c.createLinearGradient(0,0,w*.48,0);g.addColorStop(0,mix(color,-.75));g.addColorStop(.22,color);g.addColorStop(.39,mix(color,.62));g.addColorStop(.46,mix(color,.86));g.addColorStop(.5,mix(color,-.25));g.addColorStop(.76,color);g.addColorStop(1,mix(color,-.65));c.fillStyle=g;}else c.fillStyle=color;c.fill();
  }
  function ribbon(center:(t:number)=>number,width:(t:number)=>number,color:string,start=0,end=1){const a:Point[]=[],b:Point[]=[];for(let i=0;i<=100;i++){const t=start+(end-start)*i/100;a.push([center(t)+width(t)/2,t]);b.push([center(t)-width(t)/2,t]);}surface([...a,...b.reverse()],color);}
  // A narrow, continuous piping edge ties all three designs to the jersey trim.
  surface([[.982,0],[.982,1],[.944,1],[.944,0]],cfg.trimColor,false);
  surface([[.934,0],[.934,1],[.900,1],[.900,0]],cfg.accent,false);
  if(cfg.stripeStyle==="twist"){
   const phase=(t:number)=>Math.PI*2*(t-.12);
   const first=(t:number)=>.56+.205*Math.cos(phase(t)),second=(t:number)=>.56-.205*Math.cos(phase(t));
   const width=(t:number)=>.22*Math.min(1,t/.16)*(1-.45*Math.max(0,(t-.88)/.12));
   ribbon(()=>.22,t=>.036*Math.min(1,t/.2),cfg.accent);
   ribbon(second,width,cfg.trimColor);
   ribbon(first,width,cfg.accent);
   // One alternating overpass makes a real fold rather than a repeated helix.
   ribbon(second,width,cfg.trimColor,.60,.98);
   ribbon(t=>first(t)+width(t)*.39,t=>width(t)*.10,mix(cfg.accent,.65));
   ribbon(t=>second(t)+width(t)*.39,t=>width(t)*.10,mix(cfg.trimColor,.7),.60,.98);
  }else if(cfg.stripeStyle==="blade-bolts"){
   // Long swept knife forms, with offset tips and short reverse cuts.
   const blade:Point[]=[[.80,.10],[.38,.64],[.58,.51],[.23,1],[.62,1],[.76,.62],[.59,.71],[.88,.34],[.67,.46]];
   surface(blade,cfg.trimColor);
   surface([[.45,.28],[.09,.79],[.30,.63],[.04,1],[.33,1],[.51,.61],[.34,.70],[.64,.38]],cfg.accent);
   surface([[.80,.10],[.38,.64],[.58,.51],[.23,1],[.33,1],[.64,.45],[.48,.56]],mix(cfg.trimColor,.72),false);
   surface([[.45,.28],[.09,.79],[.30,.63],[.04,1],[.12,1],[.37,.57],[.20,.70]],mix(cfg.accent,.5),false);
  }else{
   // A connected bolt-shaped stripe with irregular sharp steps and tapered forks.
   const bolt:Point[]=[[.76,0],[.34,.34],[.53,.25],[.21,.65],[.44,.53],[.08,1],[.40,1],[.69,.47],[.49,.57],[.85,.18],[.64,.29]];
   surface(bolt,cfg.accent);
   const inset=bolt.map(([u,t])=>[u*.74+.12,t] as Point);surface(inset,cfg.trimColor);
   surface([[.43,.40],[.16,.47],[.24,.52],[.015,.72],[.31,.55],[.23,.50],[.55,.43]],cfg.accent);
   surface([[.65,.63],[.77,.79],[.70,.77],[.86,.98],[.56,.76],[.64,.78],[.53,.65]],cfg.accent);
  }
  c.restore();
 }
 c.restore();
}
