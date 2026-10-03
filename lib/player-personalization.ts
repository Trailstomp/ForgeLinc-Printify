import type {PanelId,TemplateConfig} from "./catalog";
/** Text is painted into the same canvases used for previews and print PNGs. */
export function drawPlayerPersonalization(c:CanvasRenderingContext2D,id:PanelId,w:number,h:number,cfg:TemplateConfig,texture=false){
 const raw=id==="back"?cfg.playerName:id==="left-sleeve"?cfg.playerNumber:"";
 if(!raw?.trim())return;
 const text=raw.trim(),name=id==="back",x=w*.5,y=h*(name?.17:.38),maxWidth=w*(name?.70:.34);
 const rgb=cfg.shirtColor.slice(1).match(/../g)!.map(v=>parseInt(v,16)),dark=rgb[0]*.299+rgb[1]*.587+rgb[2]*.114<145;
 c.save();c.translate(x,y);if(texture&&name)c.scale((w/h)/(1.32/1.93),1);
 c.textAlign="center";c.textBaseline="middle";c.lineJoin="round";
 let size=h*(name?.072:.29);c.font=`900 ${size}px Arial, Helvetica, sans-serif`;
 const measured=c.measureText(text).width;if(measured>maxWidth){size*=maxWidth/measured;c.font=`900 ${size}px Arial, Helvetica, sans-serif`;}
 // Team primary lettering and accent border follow the selected theme.
 // A thin outer keyline separates both team colors from the garment beneath.
 c.strokeStyle=dark?"#ffffff":"#102235";c.lineWidth=Math.max(2,size*.14);c.strokeText(text,0,0);
 c.strokeStyle=cfg.accent;c.lineWidth=Math.max(1,size*.085);c.strokeText(text,0,0);
 c.fillStyle=cfg.primary;c.fillText(text,0,0);c.restore();
}
/** Reposition the existing composite's separate header badge at render time.
 * Fixed v4 artwork has a badge ending at .1643 and players beginning at .167.
 * Source assets and every player's identity/relative position stay intact.
 */
export function drawRosterWithFooter(c:CanvasRenderingContext2D,im:CanvasImageSource & {width:number;height:number},cx:number,cy:number,bw:number,bh:number,w:number,h:number){
 const split=.165,sourceHeight=im.height*(1-split),fit=Math.min(bw/im.width,bh/im.height),height=Math.min(sourceHeight*fit,h*.54),width=height*im.width/sourceHeight;
 const top=Math.max(h*.25,Math.min(cy-height/2,h*.80-height)),left=cx-width/2;
 c.drawImage(im,0,im.height*split,im.width,sourceHeight,left,top,width,height);
 const badgeWidth=Math.min(w*.205,width*.33),badgeHeight=badgeWidth*(im.height*.16)/(im.width*.245),badgeTop=top+height+h*.012;
 return ()=>c.drawImage(im,im.width*.3875,im.height*.005,im.width*.245,im.height*.16,cx-badgeWidth/2,badgeTop,badgeWidth,badgeHeight);
}
