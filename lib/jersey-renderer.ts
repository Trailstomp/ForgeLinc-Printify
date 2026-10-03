import {renderPanel} from "./panel-renderer";
import type {Team,TemplateConfig,PanelId} from "./catalog";

type Point=[number,number];
// Project the visible half of a sleeve onto the assembled garment. Both views
// use the original panel texture, including its colors, badges and QR artwork.
function sleeve(c:CanvasRenderingContext2D,texture:HTMLCanvasElement,corners:Point[]){
 const ys=corners.map(p=>p[1]),top=Math.min(...ys),bottom=Math.max(...ys),height=bottom-top;
 c.save();c.beginPath();c.moveTo(...corners[0]);for(const p of corners.slice(1))c.lineTo(...p);c.closePath();c.clip();
 // Horizontal texture rows follow the sleeve silhouette. The old quad used
 // the shoulder-to-underarm seam as the horizontal axis, turning lettering.
 for(let row=0;row<Math.ceil(height);row++){
  const y=top+row+.5,hits:number[]=[];
  for(let i=0;i<corners.length;i++){const a=corners[i],b=corners[(i+1)%corners.length];if(y>=Math.min(a[1],b[1])&&y<Math.max(a[1],b[1]))hits.push(a[0]+(b[0]-a[0])*(y-a[1])/(b[1]-a[1]));}
  if(hits.length<2)continue;const left=Math.min(...hits),right=Math.max(...hits);
  c.drawImage(texture,texture.width*.25,row/height*texture.height,texture.width*.5,texture.height/height,left,top+row,right-left,1.1);
 }
 c.restore();
}

/** Assembled design preview. Print files and garment views share one renderer. */
export async function renderJersey(canvas:HTMLCanvasElement,side:"front"|"back",team:Team,config:TemplateConfig){
 const ids:PanelId[]=[side,"right-sleeve","left-sleeve","collar"];
 const textures=await Promise.all(ids.map(async id=>{const panel=document.createElement("canvas");await renderPanel(panel,id,team,config,true);return panel;}));
 canvas.width=1000;canvas.height=1000;
 const c=canvas.getContext("2d")!;c.scale(1000/1254,1000/1254);c.imageSmoothingQuality="high";
 const left:Point[]=[[270,170],[327,478],[280,554],[96,475]];
 const right=left.map(([x,y])=>[1254-x,y] as Point);
 // Anatomical right appears on the viewer's left in the front view.
 sleeve(c,textures[side==="front"?1:2],left);
 sleeve(c,textures[side==="front"?2:1],right);
 const body=new Path2D();
 body.moveTo(270,170);body.lineTo(475,72);
 if(side==="front")body.bezierCurveTo(465,220,789,220,779,72);
 else body.bezierCurveTo(540,104,714,104,779,72);
 body.lineTo(984,170);body.bezierCurveTo(960,310,926,410,927,480);
 body.bezierCurveTo(921,730,939,1010,954,1134);body.quadraticCurveTo(627,1200,300,1134);
 body.bezierCurveTo(315,1010,333,730,327,480);body.bezierCurveTo(328,410,294,310,270,170);body.closePath();
 c.save();c.clip(body);c.drawImage(textures[0],270,60,714,1110);
 const shade=c.createLinearGradient(270,0,984,0);shade.addColorStop(0,"#00000020");shade.addColorStop(.18,"#ffffff08");shade.addColorStop(.5,"#ffffff00");shade.addColorStop(.82,"#ffffff08");shade.addColorStop(1,"#00000020");c.fillStyle=shade;c.fillRect(270,60,714,1110);c.restore();
 c.strokeStyle="#10223535";c.lineWidth=2;c.stroke(body);
 // Map the collar panel around the neck using its same stripe proportions.
 const collar=new Path2D();collar.moveTo(475,72);
 if(side==="front"){collar.bezierCurveTo(465,220,789,220,779,72);collar.lineTo(754,65);collar.bezierCurveTo(759,178,495,178,500,65);}
 else{collar.bezierCurveTo(540,104,714,104,779,72);collar.lineTo(754,65);collar.bezierCurveTo(690,83,564,83,500,65);}
 collar.closePath();c.save();c.clip(collar);c.fillStyle=config.primary;c.fill(collar);
 // A curved strip mesh keeps the stripe order consistent around the neckline.
 const depth=side==="front"?148:32,innerDepth=side==="front"?113:18;
 for(let x=0;x<200;x++){
  const u=x/200,U=(x+1)/200;
  const outer=(t:number):Point=>[475+304*t,72+3*t*(1-t)*depth];
  const inner=(t:number):Point=>[500+254*t,65+3*t*(1-t)*innerDepth];
  const [ox,oy]=outer(u),[ix,iy]=inner(u),[nx,ny]=outer(U);
  c.save();c.transform((nx-ox)/(textures[3].width/200),(ny-oy)/(textures[3].width/200),(ix-ox)/textures[3].height,(iy-oy)/textures[3].height,ox,oy);
  c.drawImage(textures[3],u*textures[3].width,0,textures[3].width/200+1,textures[3].height,0,0,textures[3].width/200+1,textures[3].height);c.restore();
 }
 c.restore();c.strokeStyle="#10223540";c.stroke(collar);
 // Subtle seams describe construction without obscuring the actual design.
 c.strokeStyle="#10223525";c.lineWidth=2;
 for(const points of [left,right]){c.beginPath();c.moveTo(...points[0]);c.lineTo(...points[3]);c.lineTo(...points[2]);c.lineTo(...points[1]);c.stroke();}
 c.beginPath();c.moveTo(305,1120);c.quadraticCurveTo(627,1182,949,1120);c.stroke();
}
