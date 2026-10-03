import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {makeJerseyModel,type JerseyTextures} from "./jersey-model";
import type {PanelId} from "./catalog";
export type JerseyAngle="front"|"back"|"left"|"right";
export function createJerseyView(host:HTMLElement,onContextLost:()=>void){
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"default"});
 renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio||1,1.5),2));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setClearColor(0x071725,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
 const canvas=renderer.domElement;canvas.tabIndex=0;canvas.setAttribute("role","img");canvas.setAttribute("aria-label","Rotatable jersey. Drag to turn; arrow keys rotate; plus and minus zoom.");host.appendChild(canvas);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.1,50);camera.position.set(.8,.32,4.7);
 scene.add(new THREE.HemisphereLight(0xffffff,0x516679,2.1));
 const key=new THREE.DirectionalLight(0xffffff,2.5);key.position.set(-3,5,4);scene.add(key);
 const fill=new THREE.DirectionalLight(0xdbeeff,1.8);fill.position.set(4,2,-3);scene.add(fill);
 const controls=new OrbitControls(camera,canvas);controls.target.set(0,-.04,0);controls.enablePan=false;controls.enableDamping=false;controls.minDistance=2.2;controls.maxDistance=7;controls.minPolarAngle=Math.PI*.18;controls.maxPolarAngle=Math.PI*.82;controls.rotateSpeed=.7;
 let frame=0,disposed=false,visible=true,model:ReturnType<typeof makeJerseyModel>|null=null;
 let textures:JerseyTextures|null=null,fitDistance=4.7;
 let spinning=false,interacting=false,spinTimer:ReturnType<typeof setTimeout>|undefined,lastSpin=0,resumeAt=0;
 function stopSpin(){if(spinTimer!==undefined)clearTimeout(spinTimer);spinTimer=undefined;lastSpin=0;controls.autoRotate=false;}
 function startSpin(){if(disposed||!spinning||!visible||document.hidden||interacting||spinTimer!==undefined)return;
  lastSpin=performance.now();spinTimer=setTimeout(function tick(){spinTimer=undefined;if(disposed||!spinning||!visible||document.hidden||interacting)return;const now=performance.now();
   if(now>=resumeAt){controls.autoRotate=true;controls.autoRotateSpeed=1;controls.update(Math.min((now-lastSpin)/1000,.1));controls.autoRotate=false;}
   lastSpin=now;spinTimer=setTimeout(tick,33);
  },33);
 }
 function pauseForInteraction(){resumeAt=performance.now()+3000;}
 function interactionStart(){interacting=true;stopSpin();}
 function interactionEnd(){interacting=false;pauseForInteraction();startSpin();}
 function visibility(){stopSpin();if(!document.hidden){render();startSpin();}}
 controls.addEventListener("start",interactionStart);controls.addEventListener("end",interactionEnd);document.addEventListener("visibilitychange",visibility);
 function render(){if(disposed||!visible||frame)return;frame=requestAnimationFrame(()=>{frame=0;if(!disposed&&visible)renderer.render(scene,camera);});}
 function resize(){if(disposed)return;const {width,height}=host.getBoundingClientRect();if(!width||!height)return;renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio||1,1.5),2,Math.sqrt(4000000/(width*height))));renderer.setSize(width,height,false);const previousFit=fitDistance;camera.aspect=width/height;fitDistance=Math.max(4.2,1.35/(Math.tan(THREE.MathUtils.degToRad(17))*camera.aspect));controls.maxDistance=Math.max(7,fitDistance*1.65);const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(fitDistance/previousFit);camera.position.copy(controls.target).add(offset);camera.updateProjectionMatrix();controls.update();render();}
 const ro=new ResizeObserver(resize);ro.observe(host);
 const io=new IntersectionObserver(entries=>{visible=entries[0]?.isIntersecting??true;if(visible){render();startSpin();}else stopSpin();});io.observe(host);
 controls.addEventListener("change",render);
 function turn(angle:number){const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(offset);s.theta+=angle;camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();render();}
 function zoom(factor:number){pauseForInteraction();const offset=camera.position.clone().sub(controls.target);offset.setLength(THREE.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance));camera.position.copy(controls.target).add(offset);controls.update();render();}
 function keys(e:KeyboardEvent){pauseForInteraction();if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();turn(e.key==="ArrowLeft"?-.18:.18);}else if(e.key==="+"||e.key==="="||e.key==="-"){e.preventDefault();zoom(e.key==="-"?1.12:.89);}else if(e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));s.phi=THREE.MathUtils.clamp(s.phi+(e.key==="ArrowUp"?-.12:.12),controls.minPolarAngle,controls.maxPolarAngle);camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();render();}}
 canvas.addEventListener("keydown",keys);
 function lost(e:Event){e.preventDefault();stopSpin();spinning=false;onContextLost();}canvas.addEventListener("webglcontextlost",lost);
 controls.update();resize();
 return {
  update(panels:Record<PanelId,HTMLCanvasElement>){if(disposed)return;const next={} as JerseyTextures;
   for(const id of Object.keys(panels) as PanelId[]){const texture=new THREE.CanvasTexture(panels[id]);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=renderer.capabilities.getMaxAnisotropy();next[id]=texture;}
   if(!model){model=makeJerseyModel(next);scene.add(model.group);}else for(const id of Object.keys(next) as PanelId[]){model.materials[id].map=next[id];model.materials[id].needsUpdate=true;}
   if(textures)for(const texture of Object.values(textures))texture.dispose();textures=next;render();
  },
  setAutoRotate(enabled:boolean){spinning=enabled;stopSpin();if(enabled)startSpin();},
  view(angle:JerseyAngle){pauseForInteraction();const a=angle==="front"?0:angle==="back"?Math.PI:angle==="left"?Math.PI/2:-Math.PI/2;const side=angle==="left"||angle==="right";
   controls.target.set(side?(angle==="left"?.9:-.9):0,side?.48:-.04,0);
   const distance=side?Math.max(2.2,fitDistance*.58):fitDistance;
   const horizontal=side?distance/Math.hypot(1,1.6):distance;
   camera.position.set(controls.target.x+Math.sin(a)*horizontal,side?controls.target.y+horizontal*1.6:.2,Math.cos(a)*horizontal);controls.update();render();},
  zoom,
  dispose(){if(disposed)return;disposed=true;stopSpin();controls.removeEventListener("start",interactionStart);controls.removeEventListener("end",interactionEnd);document.removeEventListener("visibilitychange",visibility);if(frame)cancelAnimationFrame(frame);ro.disconnect();io.disconnect();controls.removeEventListener("change",render);controls.dispose();canvas.removeEventListener("keydown",keys);canvas.removeEventListener("webglcontextlost",lost);model?.dispose();if(textures)for(const t of Object.values(textures))t.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove();}
 };
}
