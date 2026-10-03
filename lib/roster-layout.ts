import teams from "./teams.json";
export const ROSTER_VERSION="locked-players-v1";
export const BOX_TEAMS=["dayton-bombers","bulldawgs","queen-city"] as const;
export const rosterWidth=2400,rosterHeight=2800;
export type PlayerPlacement={id:string;x:number;y:number;height:number};
// Reuse each original character asset verbatim. Only positions change by team.
export function rosterLayout(teamId:string):PlayerPlacement[]{
 const index=teams.findIndex(t=>t.id===teamId);if(index<0)throw new Error("Unknown team");
 const others=teams.filter(t=>t.id!==teamId).map(t=>t.id);
 const offset=index%others.length,ordered=[...others.slice(offset),...others.slice(0,offset)];
 const slots=[
  [.22,.07,.34],[.43,.01,.36],[.65,.085,.35],[.82,.035,.34],
  [.18,.32,.34],[.82,.37,.32],
  [.18,.63,.31],[.39,.67,.30],[.63,.63,.33],[.83,.60,.32]
 ];
 const outer=slots.map(([x,y,height],i)=>({id:ordered[i],x,y,height}));
 // Draw the rear row, outside wings, featured central pair, then lower figures.
 return [...outer.slice(0,6),{id:"chandler",x:.40,y:.285,height:.43},{id:teamId,x:.64,y:.265,height:.43},...outer.slice(6)];
}
export function drawRoster(ctx:CanvasRenderingContext2D,teamId:string,images:Record<string,CanvasImageSource & {width:number;height:number}>){
 for(const p of rosterLayout(teamId)){
  const im=images[p.id];if(!im)throw new Error("Missing locked player: "+p.id);
  const h=p.height*rosterHeight,w=h*im.width/im.height;
  ctx.drawImage(im,p.x*rosterWidth-w/2,p.y*rosterHeight,w,h);
 }
 const badge=images.badge;if(!badge)throw new Error("Missing league badge");
 const w=rosterWidth*.42,h=w*badge.height/badge.width;
 ctx.drawImage(badge,(rosterWidth-w)/2,rosterHeight*.75,w,h);
}
