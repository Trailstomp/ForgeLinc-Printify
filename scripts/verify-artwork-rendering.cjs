const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');
function loadTS(relative,mocks={}){
 const filename=path.resolve(__dirname,'..',relative);
 const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));
 const native=mod.require.bind(mod);mod.require=id=>id in mocks?mocks[id]:native(id);mod._compile(code,filename);return mod.exports;
}

(async()=>{
 const catalog=loadTS('lib/catalog.ts');let backLoads=0;
 global.Image=class{width=200;height=200;set src(v){this.source=v;queueMicrotask(()=>this.onload());}};
 const renderer=loadTS('lib/panel-renderer.ts',{'./catalog':catalog,'./zip':{},'./artwork-background':{loadBackArtwork:async src=>{backLoads++;return {width:200,height:300,source:src};}}});
 async function draw(id,cfg){const calls=[];const context=new Proxy({},{get:(_,key)=>(...args)=>calls.push([key,...args]),set:()=>true});const canvas={getContext:()=>context};await renderer.renderPanel(canvas,id,catalog.teams[0],cfg,false,false);return calls;}
 const base=catalog.defaultConfig,p=catalog.panels.find(p=>p.id==='right-sleeve');
 let calls=await draw('right-sleeve',base);assert(calls.some(c=>c[0]==='translate'&&c[1]===p.width*.5&&c[2]===p.height*.38));
 const layer={assetId:null,visible:true,x:.35,y:.25,scale:1.5,caption:false};calls=await draw('right-sleeve',{...base,artwork:{'right-sleeve':layer}});assert(calls.some(c=>c[0]==='translate'&&c[1]===p.width*.35&&c[2]===p.height*.25));
 const image=calls.find(c=>c[0]==='drawImage');assert.equal(image[4],p.height*.56*1.5);assert.equal(image[1].source,'/assets/membership-head-angled-v2.png');
 calls=await draw('right-sleeve',{...base,artwork:{'right-sleeve':{...layer,visible:false}}});assert(!calls.some(c=>c[0]==='drawImage'));
 const custom='cf762c51-26b2-4e1c-90bd-512f17c5fab4';calls=await draw('back',{...base,artwork:{back:{...layer,assetId:custom}}});assert.equal(calls.find(c=>c[0]==='drawImage')[1].source,'/api/artwork/'+custom);assert.equal(backLoads,0);
 const rosterCalls=await draw('back',base);assert.equal(backLoads,0);assert(rosterCalls.some(c=>c[0]==='drawImage'&&c[1].source.startsWith('/assets/rosters/')));
 const legacy={...base};delete legacy.artwork;calls=await draw('right-sleeve',legacy);assert(calls.some(c=>c[0]==='drawImage'));
 calls=await draw('left-sleeve',{...base,artwork:{'left-sleeve':layer}});assert(!calls.some(c=>c[0]==='fillText'));
 calls=await draw('left-sleeve',base);assert(!calls.some(c=>c[0]==='drawImage'),'Opposite sleeve has no badge');
 const behind=await draw('back',base),above=await draw('back',{...base,backBehindStripes:false});
 assert(behind.findIndex(c=>c[0]==='drawImage')<behind.findIndex(c=>c[0]==='bezierCurveTo'),'Stripes cover back artwork');
 assert(above.findIndex(c=>c[0]==='drawImage')>above.findIndex(c=>c[0]==='bezierCurveTo'),'Layer order remains editable');
 calls=await draw('collar',base);assert(!calls.some(c=>c[0]==='drawImage'));
 const customized=catalog.withPanelArtwork(base,'collar',custom,'Collar alternate');calls=await draw('collar',customized);assert.equal(calls.find(c=>c[0]==='drawImage')[1].source,'/api/artwork/'+custom);
 const restored=catalog.restoreOriginalArtwork(customized,'collar');calls=await draw('collar',restored);assert(!calls.some(c=>c[0]==='drawImage'));
 for(const panel of catalog.artworkPanels){const selected=catalog.withPanelArtwork(base,panel,custom,'Alternate');const drawing=await draw(panel,selected);assert(drawing.some(c=>c[0]==='drawImage'&&c[1].source==='/api/artwork/'+custom));}
 console.log('Passed: legacy placement, moved/scaled sleeve, hide artwork, replacement source and alpha preservation, optional sleeve caption.');
})().catch(e=>{console.error(e);process.exit(1);});
