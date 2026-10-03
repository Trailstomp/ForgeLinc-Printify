import * as THREE from "three";
import type {PanelId} from "./catalog";
export type JerseyTextures=Record<PanelId,THREE.Texture>;
function surface(nu:number,nv:number,point:(u:number,v:number)=>[number,number,number],uv=(u:number,v:number)=>[u,1-v]){
 const positions:number[]=[],coords:number[]=[],indices:number[]=[];
 for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){positions.push(...point(i/nu,j/nv));coords.push(...uv(i/nu,j/nv));}
 for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;indices.push(a,c,b,b,c,d);}
 const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));g.setAttribute("uv",new THREE.Float32BufferAttribute(coords,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
const neck=.27,depth=.235,top=.99,hem=-.94,armEnd=.32;
const widthAt=(v:number)=>.68-.055*Math.sin(Math.PI*v)+.005*v;
const shoulder=(x:number)=>top-.105*(x/.68)**2;
const neckline=(x:number,front:boolean)=>shoulder(x)-(front?.175:.045)*Math.sqrt(Math.max(0,1-(x/neck)**2));
const bodyV=(v:number)=>v<=.5?armEnd*(1-Math.cos(Math.PI*v*2))/2:armEnd+(1-armEnd)*(v*2-1);
export function armholePoint(sign:number,theta:number):[number,number,number]{const t=(1-Math.cos(theta))/2,v=armEnd*t;return [sign*widthAt(v),shoulder(.68)*(1-v)+hem*v,Math.sign(Math.sin(theta))*depth*Math.sin(Math.PI*t)**2];}
/** A lightweight hollow garment mesh with curved body, open sleeves and neck.
 * UVs use the five existing print panels. This is an editable placement preview,
 * not a provider's size-specific sewing pattern or cloth simulation.
 */
export function makeJerseyModel(textures:JerseyTextures){
 const group=new THREE.Group(),materials:Record<PanelId,THREE.MeshStandardMaterial>={} as Record<PanelId,THREE.MeshStandardMaterial>;
 for(const id of Object.keys(textures) as PanelId[])materials[id]=new THREE.MeshStandardMaterial({map:textures[id],roughness:.92,metalness:0,side:THREE.DoubleSide});
 function add(name:string,g:THREE.BufferGeometry,id:PanelId){const mesh=new THREE.Mesh(g,materials[id]);mesh.name=name;group.add(mesh);return mesh;}
 for(const front of [true,false]){
  add(front?"front-body":"back-body",surface(48,48,(u,rawV)=>{
   const v=bodyV(rawV);
   const a=(u-.5)*Math.PI,initialX=.68*Math.sin(a),upper=neckline(initialX,front);
   const width=widthAt(v);
   const x=(front?1:-1)*width*Math.sin(a),y=upper*(1-v)+hem*v;
   const fold=1+.008*Math.sin(9*a+v*5)*Math.sin(Math.PI*v);
   const armZ=v<=armEnd?depth*Math.sin(Math.PI*v/armEnd)**2:0;
   const z=(front?1:-1)*((depth+.022*Math.sin(Math.PI*v))*Math.cos(a)*fold+armZ*Math.abs(Math.sin(a))**4);
   return [x,y,z];
  },(u,v)=>{
   // Project artwork by physical height so the curved neckline does not
   // pull the logo and player faces into a wave across the chest/back.
   const x=.68*Math.sin((u-.5)*Math.PI),y=neckline(x,front)*(1-bodyV(v))+hem*bodyV(v);
   return [(Math.sin((u-.5)*Math.PI)+1)/2,(y-hem)/(top-hem)];
  }),front?"front":"back");
 }
 // Shoulder surfaces bridge front and back while leaving the neckline open.
 for(const sign of [-1,1])add("shoulder-"+sign,surface(18,12,(u,v)=>{
  const x=sign*(neck+(.68-neck)*u),z=depth*Math.sqrt(Math.max(0,1-(x/.68)**2))*(1-2*v);
  return [x,shoulder(x),z];
 },(u,v)=>[sign<0?u*.3:.7+u*.3,.98-v*.03]),"front");
 for(const front of [true,false])add("neck-bridge-"+front,surface(24,8,(u,v)=>{
  const x=(u-.5)*2*neck,inner=depth*Math.sqrt(Math.max(0,1-(x/neck)**2)),outer=depth*Math.sqrt(Math.max(0,1-(x/.68)**2));
  return [x,neckline(x,front),(front?1:-1)*(inner+(outer-inner)*v)];
 },(u,v)=>[.3+.4*u,.98-v*.03]),front?"front":"back");
 // Each sleeve starts on the body's exact armhole curve. The matching
 // 48-segment boundary closes the shoulder and underarm without floating tubes.
 for(const sign of [-1,1]){const sleeve=add("sleeve-"+sign,surface(48,24,(u,v)=>{
  const theta=(u-.5)*2*Math.PI,root=armholePoint(sign,theta);
  // An open, gently tapered sleeve. Keep the cuff plane roughly parallel
  // to the armhole instead of twisting its top down across the artwork.
  const cuff:[number,number,number]=[sign*(1.13+.125*Math.cos(theta)),.40+.245*Math.cos(theta),.215*Math.sin(theta)];
  return [root[0]*(1-v)+cuff[0]*v,root[1]*(1-v)+cuff[1]*v,root[2]*(1-v)**4+cuff[2]*(1-(1-v)**4)];
 },(u,v)=>{
  // The flat panel starts at a curved sleeve cap, not at one rectangular
  // ring around the arm. The cap center goes over the outer shoulder;
  // the panel edges meet at the underarm, lower down the cutting template.
  const theta=(u-.5)*2*Math.PI,t=(1-Math.cos(theta))/2;
  // Follow the actual sleeve cross-section, rather than assigning equal
  // texture width to the pinched cap vertices. This keeps centered sleeve
  // lettering readable as the cap opens into the cylindrical cuff.
  const round=1-(1-v)**4;
  const z=(1-round)*Math.sign(Math.sin(theta))*depth*Math.sin(Math.PI*t)**2+round*.215*Math.sin(theta);
  const around=.5+Math.atan2(z/((1-round)*depth+round*.215),Math.cos(theta))/(2*Math.PI);
  // Project down the sleeve axis, perpendicular to its cuff. A cap-based
  // V coordinate bent each letter around the shoulder like a folded page.
  const root=armholePoint(1,theta),rootTop=armholePoint(1,0);
  const start=rootTop[0]*.245-rootTop[1]*.125,end=1.13*.245-.40*.125;
  const x=root[0]*(1-v)+(1.13+.125*Math.cos(theta))*v;
  const y=root[1]*(1-v)+(.40+.245*Math.cos(theta))*v;
  const down=THREE.MathUtils.clamp((x*.245-y*.125-start)/(end-start),0,1);
  return [sign<0?around:1-around,1-down];
 }),sign<0?"right-sleeve":"left-sleeve");
  // Mirroring the right-hand geometry reverses the winding.
  if(sign>0){const indices=sleeve.geometry.index!;for(let i=0;i<indices.count;i+=3){const b=indices.getX(i+1);indices.setX(i+1,indices.getX(i+2));indices.setX(i+2,b);}sleeve.geometry.computeVertexNormals();}
 }
 // Smooth coincident seam normals without changing the separate panel UVs.
 const seams=new Map<string,{sum:THREE.Vector3;vertices:{normal:THREE.BufferAttribute;index:number}[]}>();
 for(const mesh of group.children as THREE.Mesh[]){if(!mesh.name.endsWith("-body")&&!mesh.name.startsWith("sleeve-"))continue;const p=mesh.geometry.getAttribute("position"),n=mesh.geometry.getAttribute("normal") as THREE.BufferAttribute;
  for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*100000)).join(",");let entry=seams.get(key);if(!entry){entry={sum:new THREE.Vector3(),vertices:[]};seams.set(key,entry);}entry.sum.add(new THREE.Vector3().fromBufferAttribute(n,i));entry.vertices.push({normal:n,index:i});}
 }
 for(const {sum,vertices} of seams.values()){if(vertices.length<2||sum.lengthSq()<1e-8)continue;sum.normalize();for(const {normal,index} of vertices)normal.setXYZ(index,sum.x,sum.y,sum.z);}
 add("collar",surface(64,4,(u,v)=>{
  const theta=u*2*Math.PI,s=Math.sin(theta),r=neck+.03*v;
  return [r*Math.cos(theta),shoulder(neck*Math.cos(theta))-(s>=0?.175:.045)*Math.abs(s)+.014, (depth+.025*v)*s];
 },(u,v)=>[u,1-v]),"collar");
 return {group,materials,dispose(){for(const child of group.children)(child as THREE.Mesh).geometry.dispose();for(const mat of Object.values(materials))mat.dispose();}};
}
