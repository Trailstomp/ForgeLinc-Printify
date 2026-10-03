import teams from "./teams.json";
export const rosterWidth=2400,rosterHeight=2800;
export const ROSTER_VERSION="close-huddle-v4";
export const pairPlacement={x:.525,y:.36,height:.39};
export const badgePlacement={x:.51,y:.005,width:.245};
export function supportingPlayers(teamId:string){
 const index=teams.findIndex(t=>t.id===teamId);if(index<0)throw new Error("Unknown team");
 const others=teams.filter(t=>t.id!==teamId).map(t=>t.id),offset=index%others.length;
 const ordered=[...others.slice(offset),...others.slice(0,offset)];
 // Close shoulder-to-shoulder huddle. Uneven head heights break the rows;
 // supporting figures overlap the outer arms and shorts, leaving chest marks clear.
 const slots=[
  [.295,.205,.265],[.48,.175,.265],[.675,.225,.26],
  [.215,.37,.275],[.825,.40,.265],[.265,.565,.25],
  [.79,.60,.25],[.35,.705,.245],[.51,.775,.22],[.665,.72,.235]
 ];
 return slots.map(([x,y,height],i)=>({id:ordered[i],x:x+(((index+i*3)%5)-2)*.003,y:y+(((index*2+i)%5)-2)*.004,height}));
}
export function drawBuddyRoster(ctx:CanvasRenderingContext2D,teamId:string,images:Record<string,CanvasImageSource & {width:number;height:number}>){
 const draw=(im:CanvasImageSource & {width:number;height:number},x:number,y:number,height:number)=>{
  const h=height*rosterHeight,w=h*im.width/im.height;ctx.drawImage(im,x*rosterWidth-w/2,y*rosterHeight,w,h);
 };
 const outer=supportingPlayers(teamId);
 for(const p of outer.slice(0,7))draw(images[p.id],p.x,p.y,p.height);
 // The fixed arm-in-arm pose remains the focal point, larger than any supporter.
 draw(images["pair:"+teamId],pairPlacement.x,pairPlacement.y,pairPlacement.height);
 for(const p of outer.slice(7))draw(images[p.id],p.x,p.y,p.height);
 // League identity sits above the gathering, clear of every player's jersey.
 const badge=images.badge,w=rosterWidth*badgePlacement.width,h=w*badge.height/badge.width;
 ctx.drawImage(badge,rosterWidth*badgePlacement.x-w/2,rosterHeight*badgePlacement.y,w,h);
}
