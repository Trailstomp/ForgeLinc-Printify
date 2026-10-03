/** Screen-pixel tolerance keeps snapping consistent on desktop and touch screens. */
export function snapToVerticalCenter(x:number,width:number,enabled:boolean,wasSnapped=false){
 const value=Math.max(0,Math.min(1,x));
 const snapped=enabled&&width>0&&Number.isFinite(width)&&Math.abs(value-.5)*width<=(wasSnapped?14:8);
 return {x:snapped?.5:value,snapped};
}
