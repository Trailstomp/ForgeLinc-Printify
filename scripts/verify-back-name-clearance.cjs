// Execute the production panel + garment renderers with a native Canvas adapter.
// Set JERSEY_CANVAS_MODULE to the installed @napi-rs/canvas module for this check.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const native=require(process.env.JERSEY_CANVAS_MODULE||'@napi-rs/canvas');
const modules=new Map();
function load(file){file=path.resolve(file);if(modules.has(file))return modules.get(file).exports;const m={exports:{}};modules.set(file,m);const src=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',src)((name)=>name.startsWith('.')?(name.endsWith('.json')?require(path.resolve(path.dirname(file),name)):load(path.resolve(path.dirname(file),name+'.ts'))):require(name),m,m.exports);return m.exports;}
global.Path2D=native.Path2D;
global.document={createElement(tag){assert.equal(tag,'canvas');return native.createCanvas(1,1);}};
global.Image=class extends native.Image{
 set src(value){this.originalSource=value;if(typeof value==='string'&&value.startsWith('blob:'))fetch(value).then(r=>r.arrayBuffer()).then(b=>{super.src=Buffer.from(b);}).catch(e=>this.onerror(e));else super.src=typeof value==='string'&&(value.startsWith('/assets/')||value.startsWith('/api/artwork/'))?path.resolve('public'+(value.startsWith('/api/artwork/')?'/assets/rosters/dayton-eagles-v4.png':value)):value;}
 get src(){return this.originalSource;}
};
const {renderPanel}=load('lib/panel-renderer.ts'),{teams,teamDefaultConfig,themeDesign,configSchema,sameDesign}=load('lib/catalog.ts');
(async()=>{
 const {reserveBackNameSpace}=load('lib/back-artwork-layout.ts'),{backRosterFrame}=load('lib/waist-roster.ts'),{artworkLayer}=load('lib/catalog.ts');
 const base=teamDefaultConfig('dayton-eagles'),named={...base,playerName:'GreyLax'};
 const up={...base,artwork:{back:{...artworkLayer(base,'back'),y:.24,scale:1.3}}};
 for(const dims of [{width:4655,height:5426},{width:4072,height:4754}]){
  for(const cfg of [base,up,{...up,artwork:{back:{...up.artwork.back,y:.85,scale:3}}}]){
   const snapshot=JSON.stringify(cfg),f=backRosterFrame({...cfg,playerName:'GreyLax'},dims.width,dims.height);
   assert(f.top>=dims.height*.235-1e-8,'Name area remains clear with saved upward placement');
   assert(f.top+f.height<=dims.height*.92+1e-8,'Group stays within lower print margin');
   assert(Math.abs(f.width/f.height-2400/(2800*.835))<1e-8,'Players keep aspect ratio');
   assert.equal(JSON.stringify(cfg),snapshot,'Stored placement is not mutated');
   assert.deepEqual(backRosterFrame({...cfg,playerName:' '},dims.width,dims.height),backRosterFrame(cfg,dims.width,dims.height),'Clearing name restores placement');
  }
 }
 const frame={left:100,top:400,width:1800,height:2200};
 assert.equal(reserveBackNameSpace(frame,base,5426),frame);
 assert(reserveBackNameSpace(frame,named,5426).top>=5426*.235);
 const out=native.createCanvas(1600,1050),ctx=out.getContext('2d');ctx.fillStyle='#243b50';ctx.fillRect(0,0,1600,1050);
 const upload={...base,artwork:{back:{...artworkLayer(base,'back'),assetId:'00000000-0000-4000-8000-000000000001',y:.32,scale:1.8}}};
 let index=0;
 for(const [label,cfg] of [['Saved high placement',up],['Alternate back image',upload]])for(const name of ['', 'GreyLax']){
  const cv=native.createCanvas(1,1);await renderPanel(cv,'back',teams[0],{...cfg,playerName:name,stripeStyle:'none'},'texture');
  ctx.drawImage(cv,index*400+15,80,370,431);ctx.fillStyle='#fff';ctx.font='16px sans-serif';ctx.fillText(label,index*400+15,25);ctx.fillText(name||'No name',index*400+15,50);index++;
 }
 // Execute full-size print output for both corrected branches as well.
 for(const cfg of [up,upload]){
  const cv=native.createCanvas(1,1);await renderPanel(cv,'back',teams[0],{...cfg,playerName:'GreyLax',stripeStyle:'none'},false);
  assert.equal(cv.height,5426);assert.equal(cv.width,4655);
  const col=cfg===up?0:800;ctx.drawImage(cv,col+20,570,380,443);
  ctx.fillStyle='#fff';ctx.fillText('Print panel — '+(cfg===up?'saved placement':'alternate image'),col+20,550);
 }
 fs.writeFileSync('/tmp/forgelinc-back-name-check.png',out.toBuffer('image/png'));
 console.log('Back name checks passed: saved upward placement, alternate images, full-size exports, provider dimensions, fit bounds, aspect ratio, and cleared-name restoration.');
})().catch(e=>{console.error(e);process.exit(1)});
