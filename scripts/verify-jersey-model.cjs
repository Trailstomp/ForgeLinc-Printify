// Inspect the production mesh and panel UVs without starting a browser or WebGL server.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),ts=require('typescript'),THREE=require('three'),native=require(process.env.JERSEY_CANVAS_MODULE||'@napi-rs/canvas');
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>id.startsWith('.')?(id.endsWith('.json')?require(path.resolve(path.dirname(file),id)):load(path.resolve(path.dirname(file),id+'.ts'))):require(id),m,m.exports);return m.exports;}
global.document={createElement:()=>native.createCanvas(1,1)};
global.Image=class extends native.Image{set src(v){if(typeof v==='string'&&v.startsWith('blob:'))fetch(v).then(r=>r.arrayBuffer()).then(b=>{super.src=Buffer.from(b);});else super.src=typeof v==='string'&&v.startsWith('/assets/')?path.resolve('public'+v):v;}};
(async()=>{
const {makeJerseyModel}=load('lib/jersey-model.ts'),{renderPanel}=load('lib/panel-renderer.ts'),{panels,teams,teamDefaultConfig}=load('lib/catalog.ts');
const textures={},cfg={...teamDefaultConfig('dayton-eagles'),playerNumber:'35'};for(const p of panels){const c=native.createCanvas(1,1);await renderPanel(c,p.id,teams[0],cfg,"texture",false);assert.equal(Math.max(c.width,c.height),3072);assert(Math.abs((c.width/c.height)/(p.width/p.height)-1)<.003,"Texture keeps panel aspect ratio");textures[p.id]=new THREE.CanvasTexture(c);}
const model=makeJerseyModel(textures);let triangles=0;const names=new Set();
for(const mesh of model.group.children){names.add(mesh.name);const g=mesh.geometry,pos=g.getAttribute('position'),uv=g.getAttribute('uv');assert(pos.count===uv.count);for(const n of pos.array)assert(Number.isFinite(n));for(const n of uv.array)assert(Number.isFinite(n)&&n>=0&&n<=1);assert(g.index.array.every(i=>i<pos.count));g.computeBoundingBox();triangles+=g.index.count/3;}
assert(names.has('front-body')&&names.has('back-body')&&names.has('sleeve--1')&&names.has('sleeve-1')&&names.has('collar'));assert(triangles<18000);
// Every sleeve root vertex must meet an actual front/back armhole vertex.
const bodies=model.group.children.filter(m=>m.name.endsWith('-body'));
for(const sleeve of model.group.children.filter(m=>m.name.startsWith('sleeve-'))){const roots=sleeve.geometry.attributes.position;for(let i=0;i<=48;i++){const point=new THREE.Vector3().fromBufferAttribute(roots,i);let nearest=Infinity;for(const body of bodies){const p=body.geometry.attributes.position;for(let j=0;j<p.count;j++)nearest=Math.min(nearest,point.distanceTo(new THREE.Vector3().fromBufferAttribute(p,j)));}assert(nearest<1e-5,'Disconnected sleeve root: '+nearest);}}
for(const mesh of model.group.children.filter(m=>m.name.startsWith('sleeve-'))){const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,sign=mesh.name==='sleeve-1'?1:-1;
 const outer=24*49+24,inner=24*49;
 assert(p.getY(outer)-p.getY(inner)>.45,'Cuff stays open instead of folding flat');
 assert(n.getX(12*49+24)*sign>0&&n.getY(12*49+24)>0,'Outer sleeve normals point outwards');
 for(let row=0;row<=24;row++){const a=row*49,b=a+48;assert(new THREE.Vector3().fromBufferAttribute(n,a).distanceTo(new THREE.Vector3().fromBufferAttribute(n,b))<1e-5,'Sleeve underarm seam shades smoothly');}
}
const out=native.createCanvas(2560,720),oc=out.getContext('2d');
function drawView(angle,xoff,detail=false){const width=640,height=720,camera=new THREE.PerspectiveCamera(34,width/height,.1,50);camera.position.set(Math.sin(angle)*(detail?2.73/Math.hypot(1,1.6):4.7)+(detail?Math.sign(angle)*.9:0),detail?.48+2.73/Math.hypot(1,1.6)*1.6:.35,Math.cos(angle)*(detail?2.73/Math.hypot(1,1.6):4.7));camera.lookAt(detail?Math.sign(angle)*.9:0,detail?.48:-.04,0);camera.updateMatrixWorld();
const faces=[];for(const mesh of model.group.children){const g=mesh.geometry,pos=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<g.index.count;i+=3){const ids=[g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2)],world=ids.map(j=>new THREE.Vector3().fromBufferAttribute(pos,j));const points=world.map(p=>p.clone().project(camera)).map(p=>[(p.x+1)*width/2,(1-p.y)*height/2,p.z]);const screenArea=(points[1][0]-points[0][0])*(points[2][1]-points[0][1])-(points[2][0]-points[0][0])*(points[1][1]-points[0][1]);if(Math.abs(screenArea)<.002)continue;
const normal=world[1].clone().sub(world[0]).cross(world[2].clone().sub(world[0])).normalize();if(normal.dot(camera.position.clone().sub(world[0]))<0)normal.negate();const shade=.75+.25*Math.max(0,normal.dot(new THREE.Vector3(-.4,.7,1).normalize()));const im=mesh.material.map.image;faces.push({points,src:ids.map(j=>[uv.getX(j)*im.width,(1-uv.getY(j))*im.height]),im,shade,z:points.reduce((s,p)=>s+p[2],0)/3});}}
const c=native.createCanvas(width,height),ctx=c.getContext('2d'),pixels=ctx.createImageData(width,height),zbuffer=new Float32Array(width*height).fill(Infinity),images=new Map();
for(let i=0;i<width*height;i++)pixels.data.set([203,216,226,255],i*4);
for(const f of faces){if(!images.has(f.im))images.set(f.im,f.im.getContext('2d').getImageData(0,0,f.im.width,f.im.height).data);const tex=images.get(f.im),[p,q,r]=f.points,den=(q[1]-r[1])*(p[0]-r[0])+(r[0]-q[0])*(p[1]-r[1]);if(Math.abs(den)<1e-8)continue;
for(let y=Math.max(0,Math.floor(Math.min(p[1],q[1],r[1])));y<=Math.min(height-1,Math.ceil(Math.max(p[1],q[1],r[1])));y++)for(let x=Math.max(0,Math.floor(Math.min(p[0],q[0],r[0])));x<=Math.min(width-1,Math.ceil(Math.max(p[0],q[0],r[0])));x++){
const a=((q[1]-r[1])*(x+.5-r[0])+(r[0]-q[0])*(y+.5-r[1]))/den,b=((r[1]-p[1])*(x+.5-r[0])+(p[0]-r[0])*(y+.5-r[1]))/den,d=1-a-b;if(a<0||b<0||d<0)continue;const z=a*p[2]+b*q[2]+d*r[2],index=y*width+x;if(z>=zbuffer[index])continue;zbuffer[index]=z;
const tx=Math.min(f.im.width-1,Math.max(0,Math.floor(a*f.src[0][0]+b*f.src[1][0]+d*f.src[2][0]))),ty=Math.min(f.im.height-1,Math.max(0,Math.floor(a*f.src[0][1]+b*f.src[1][1]+d*f.src[2][1]))),si=(ty*f.im.width+tx)*4;for(let k=0;k<3;k++)pixels.data[index*4+k]=tex[si+k]*f.shade;}
}ctx.putImageData(pixels,0,0);
oc.drawImage(c,xoff,0);}
drawView(0,0);drawView(-Math.PI/2,640,true);drawView(Math.PI,1280);drawView(Math.PI/2,1920,true);fs.writeFileSync('/tmp/forgelinc-3d-mesh-check.png',out.toBuffer('image/png'));
model.dispose();for(const t of Object.values(textures))t.dispose();console.log('Validated five texture mappings, finite mesh/UV data, indexed topology, attached sleeve boundaries, front/right-side/back projection; '+triangles+' triangles.');
})().catch(e=>{console.error(e);process.exit(1);});
