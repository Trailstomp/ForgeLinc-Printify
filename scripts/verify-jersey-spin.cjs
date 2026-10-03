const assert=require('node:assert/strict'),fs=require('fs'),ts=require('typescript'),THREE=require('three');
let now=0,next=1,frames=0,autoUpdates=0,orbit,intersection;
const jobs=new Map(),listeners=new Map();
const later=(fn,delay=0)=>{const id=next++;jobs.set(id,{fn,at:now+delay});return id;};
function advance(ms){const end=now+ms;for(;;){const due=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;jobs.delete(due[0]);due[1].fn(now);}now=end;}
const canvas={setAttribute(){},addEventListener(){},removeEventListener(){},remove(){}};
class Renderer{constructor(){this.domElement=canvas;}setPixelRatio(){}setClearColor(){}setSize(){}render(){frames++;}dispose(){}forceContextLoss(){}}
class Orbit extends THREE.EventDispatcher{constructor(camera){super();this.camera=camera;this.target=new THREE.Vector3();orbit=this;}update(delta){if(this.autoRotate&&delta){autoUpdates++;this.dispatchEvent({type:'change'});}}dispose(){}}
const document={hidden:false,addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
class Observer{constructor(cb){this.cb=cb;}observe(){}disconnect(){}}
class Intersection extends Observer{constructor(cb){super(cb);intersection=this;}}
const source=ts.transpileModule(fs.readFileSync('lib/jersey-3d-view.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,m={exports:{}};
new Function('require','module','exports','window','document','ResizeObserver','IntersectionObserver','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout','performance',source)(id=>id==='three'?{...THREE,WebGLRenderer:Renderer}:id.includes('OrbitControls')?{OrbitControls:Orbit}:{makeJerseyModel(){throw Error('No artwork needed for motion lifecycle test');}},m,m.exports,{devicePixelRatio:1},document,Observer,Intersection,fn=>later(fn,16),id=>jobs.delete(id),later,id=>jobs.delete(id),{now:()=>now});
const view=m.exports.createJerseyView({appendChild(){},getBoundingClientRect:()=>({width:800,height:430})},()=>{});
advance(500);assert.equal(autoUpdates,0,'Editor remains stationary');view.setAutoRotate(true);advance(500);assert(autoUpdates>5,'Homepage spins');
orbit.dispatchEvent({type:'start'});const before=autoUpdates;advance(1000);assert.equal(autoUpdates,before,'Dragging pauses automatic rotation');orbit.dispatchEvent({type:'end'});advance(2900);assert.equal(autoUpdates,before,'Time to inspect after dragging');advance(300);assert(autoUpdates>before,'Spinning resumes');
intersection.cb([{isIntersecting:false}]);const offscreen=autoUpdates;advance(1000);assert.equal(autoUpdates,offscreen);intersection.cb([{isIntersecting:true}]);advance(200);assert(autoUpdates>offscreen);
document.hidden=true;listeners.get('visibilitychange')();const hidden=autoUpdates;advance(1000);assert.equal(autoUpdates,hidden);document.hidden=false;listeners.get('visibilitychange')();advance(200);assert(autoUpdates>hidden);
view.view('left');assert(orbit.target.x>.8,'Left view focuses on sleeve');assert(orbit.camera.position.y>2,'Sleeve camera looks onto the outside artwork');view.view('right');assert(orbit.target.x<-.8,'Right view focuses on sleeve');view.view('front');assert.equal(orbit.target.x,0,'Front view returns to whole jersey');
view.setAutoRotate(false);const paused=autoUpdates;advance(500);assert.equal(autoUpdates,paused,'Pause button stops animation');view.setAutoRotate(true);advance(100);view.dispose();const disposed=autoUpdates;advance(2000);assert.equal(autoUpdates,disposed);assert.equal(jobs.size,0);assert.equal(listeners.size,0);
console.log('Auto spin, manual drag pause/resume, explicit pause, off-screen/hidden suspension, stationary editor and cleanup passed.');
