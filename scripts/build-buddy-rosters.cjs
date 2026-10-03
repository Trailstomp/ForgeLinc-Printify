// Keep the existing single-player identities; only the featured pair has a new pose.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const native=require(process.env.JERSEY_CANVAS_MODULE||'@napi-rs/canvas'),modules=new Map();
function load(file){file=path.resolve(file);if(modules.has(file))return modules.get(file).exports;const m={exports:{}};modules.set(file,m);const src=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',src)(name=>name.startsWith('.')?(name.endsWith('.json')?require(path.resolve(path.dirname(file),name)):load(path.resolve(path.dirname(file),name+'.ts'))):require(name),m,m.exports);return m.exports;}
function trim(source,fraction=1,fade=false){
 const cv=native.createCanvas(source.width,source.height),c=cv.getContext('2d');c.drawImage(source,0,0);
 const d=c.getImageData(0,0,cv.width,cv.height).data;let left=cv.width,top=cv.height,right=0,bottom=0;
 for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(d[(y*cv.width+x)*4+3]>20){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 const height=Math.ceil((bottom-top+1)*fraction),out=native.createCanvas(right-left+1,height),ctx=out.getContext('2d');ctx.drawImage(cv,-left,-top);
 if(fade){ctx.globalCompositeOperation='destination-in';const g=ctx.createLinearGradient(0,height*.84,0,height);g.addColorStop(0,'#000');g.addColorStop(1,'#0000');ctx.fillStyle=g;ctx.fillRect(0,0,out.width,out.height);}
 return out;
}
(async()=>{
 const {teams}=load('lib/catalog.ts'),{removeOuterWhite}=load('lib/artwork-background.ts');
 const {drawBuddyRoster,rosterWidth,rosterHeight,supportingPlayers,pairPlacement,badgePlacement,ROSTER_VERSION}=load('lib/buddy-roster-layout.ts');
 const images={};
 for(const t of teams){images[t.id]=trim(await native.loadImage('public/assets/players/'+t.id+'-cutout-v1.png'),.68,true);}
 images.badge=trim(await native.loadImage('public/assets/players/mlbl-badge-cutout-v1.png'));
 const selected=process.argv[2]?teams.filter(t=>t.id===process.argv[2]):teams;
 for(const t of selected){
  const source=await native.loadImage('public/assets/pairs/'+t.id+'-v2.png'),cv=native.createCanvas(source.width,source.height),c=cv.getContext('2d');c.drawImage(source,0,0);
  const d=c.getImageData(0,0,cv.width,cv.height);d.data.set(removeOuterWhite(d.data,cv.width,cv.height));c.putImageData(d,0,0);
  images['pair:'+t.id]=trim(cv,1,true);
  const out=native.createCanvas(rosterWidth,rosterHeight);drawBuddyRoster(out.getContext('2d'),t.id,images);
  fs.writeFileSync('public/assets/rosters/'+t.id+'-v4.png',out.toBuffer('image/png'));
 }
 if(!process.argv[2])fs.writeFileSync('public/assets/rosters/manifest-v4.json',JSON.stringify({version:ROSTER_VERSION,pairPlacement,badgePlacement,layouts:Object.fromEntries(teams.map(t=>[t.id,{featuredPair:['chandler',t.id],supporting:supportingPlayers(t.id)}]))},null,2));
 console.log('Composed '+selected.length+' backs with featured buddy pairs and unobstructed lower jerseys.');
})().catch(e=>{console.error(e);process.exit(1);});
