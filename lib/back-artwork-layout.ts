import type {TemplateConfig} from "./catalog";
export type BackArtworkFrame={left:number;top:number;width:number;height:number};
export const backNameSpace={plainTop:.12,namedTop:.235,bottom:.92};
/** Apply name clearance at render time, without rewriting saved placement.
 * Keep aspect ratio and horizontal center when the remaining space needs a fit.
 */
export function reserveBackNameSpace(frame:BackArtworkFrame,cfg:TemplateConfig,h:number):BackArtworkFrame{
 if(!cfg.playerName?.trim())return frame;
 const {plainTop,namedTop,bottom}=backNameSpace;
 const top=Math.min(Math.max(frame.top+h*(namedTop-plainTop),h*namedTop),h*bottom-Math.min(frame.height,h*.1));
 const scale=Math.min(1,(h*bottom-top)/frame.height),width=frame.width*scale;
 return {left:frame.left+(frame.width-width)/2,top,width,height:frame.height*scale};
}
/** The placement box also drives the editor marker for alternate back images. */
export function backImageFrame(cfg:TemplateConfig,w:number,h:number,x:number,y:number,width:number,height:number){
 return reserveBackNameSpace({left:w*x-width/2,top:h*y-height/2,width,height},cfg,h);
}
