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
 set src(value){this.originalSource=value;if(typeof value==='string'&&value.startsWith('blob:'))fetch(value).then(r=>r.arrayBuffer()).then(b=>{super.src=Buffer.from(b);}).catch(e=>this.onerror(e));else super.src=typeof value==='string'&&value.startsWith('/assets/')?path.resolve('public'+value):value;}
 get src(){return this.originalSource;}
};
const {renderPanel}=load('lib/panel-renderer.ts'),{teams,teamDefaultConfig,themeDesign,configSchema,sameDesign}=load('lib/catalog.ts');
(async()=>{
 const base=teamDefaultConfig('dayton-eagles'),named={...base,playerName:'GREYLAX',playerNumber:'035'};
 const {drawPlayerPersonalization}=load('lib/player-personalization.ts');
 for(const shirtColor of ['#ffffff','#101820'])for(const id of ['back','left-sleeve']){
  const canvas=native.createCanvas(1000,1000),c=canvas.getContext('2d'),cfg={...named,shirtColor,primary:'#087a43',accent:'#f2ab19'};
  drawPlayerPersonalization(c,id,1000,1000,cfg);
  const pixels=c.getImageData(0,0,1000,1000).data,colors=new Set();for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]===255)colors.add([pixels[i],pixels[i+1],pixels[i+2]].join(','));
  assert(colors.has('8,122,67'),'Name and number use theme primary color');assert(colors.has('242,171,25'),'Name and number use theme accent outline');
 }

 const {backRosterFrame,loadWaistRoster,waistBadge}=load('lib/waist-roster.ts');
 const {artworkLayer,upgradeSleeveArtwork}=load('lib/catalog.ts');
 const noName=backRosterFrame(base,4655,5426),withName=backRosterFrame(named,4655,5426);
 assert(Math.abs(noName.top-5426*.12)<.01);assert(Math.abs(withName.top-5426*.235)<.01);
 const current=artworkLayer(named,'back'),moved=backRosterFrame({...named,artwork:{...named.artwork,back:{...current,y:current.y+.08}}},4655,5426);
 assert(Math.abs(moved.top-withName.top-5426*.08)<.01,'Vertical controls move the artwork without the old clamping dead zone');
 const oversized=backRosterFrame({...named,artwork:{back:{...current,scale:3}}},4655,5426);assert(oversized.top+oversized.height<=5426*.92+.01);
 const migrated=upgradeSleeveArtwork({...named,backBadgePosition:'bottom',artwork:{back:{...current,y:.25}}});assert.equal(migrated.backBadgePosition,'waist');assert.deepEqual(upgradeSleeveArtwork(migrated),migrated);
 assert(waistBadge.y>.60,'Badge begins below the featured chest logos');
 assert.equal(configSchema.parse(JSON.parse(JSON.stringify(named))).playerNumber,'035');
 assert(!sameDesign(base,named));assert(!sameDesign(named,{...named,playerName:'CHANDLER'}));
 assert(!configSchema.safeParse({...named,playerNumber:'-1'}).success);assert(!configSchema.safeParse({...named,playerName:'A'.repeat(25)}).success);
 const out=native.createCanvas(1400,1000),ctx=out.getContext('2d');ctx.fillStyle='#29445b';ctx.fillRect(0,0,1400,1000);
 for(const [index,cfg] of [named,themeDesign(named,'dark')].entries()){
  for(const id of ['front','back','left-sleeve','right-sleeve']){
   const plain=native.createCanvas(1,1),personal=native.createCanvas(1,1);
   await renderPanel(plain,id,teams[0],{...cfg,playerName:'',playerNumber:''},true);
   await renderPanel(personal,id,teams[0],cfg,true);
   if(id==='back'||id==='left-sleeve')assert.notDeepEqual(plain.toBuffer('image/png'),personal.toBuffer('image/png'));else assert.deepEqual(plain.toBuffer('image/png'),personal.toBuffer('image/png'));
   if(id==='back')ctx.drawImage(personal,index*700+70,30,550,640);
   if(id==='left-sleeve')ctx.drawImage(personal,index*700+70,700,550,272);
  }
 }
 // Full-resolution export contains personalized text, not only preview canvases.
 const exported=native.createCanvas(1,1);await renderPanel(exported,'left-sleeve',teams[0],named);assert.equal(exported.width,3914);
 // Every team's fixed header badge ends above the cropped player region.
 const {supportingPlayers}=load('lib/buddy-roster-layout.ts');for(const t of teams.filter(t=>t.back.startsWith('/assets/rosters/')))assert(Math.min(...supportingPlayers(t.id).map(p=>p.y))>.165);
 // Verify new composition puts the complete player crop above the badge.
 const {drawRosterWithFooter}=load('lib/player-personalization.ts'),calls=[];
 const footer=drawRosterWithFooter({drawImage:(...args)=>calls.push(args)}, {width:2400,height:2800},2327.5,3100,3500,4000,4655,5426);footer();assert(calls[1][6]>calls[0][6]+calls[0][8]);
 const teamSheet=native.createCanvas(2200,1800),tc=teamSheet.getContext('2d');tc.fillStyle='#29445b';tc.fillRect(0,0,2200,1800);
 for(const [index,t] of teams.entries()){
  const cv=native.createCanvas(1,1);await renderPanel(cv,'back',t,{...teamDefaultConfig(t.id),playerName:'',stripeStyle:'none'},true);
  tc.drawImage(cv,index%4*550+35,Math.floor(index/4)*600+30,480,550);tc.fillStyle='#fff';tc.font='18px sans-serif';tc.fillText(t.name,index%4*550+35,Math.floor(index/4)*600+22);
 }
 fs.writeFileSync('/tmp/forgelinc-waist-teams.png',teamSheet.toBuffer('image/png'));
 fs.writeFileSync('/tmp/forgelinc-player-details.png' ,out.toBuffer('image/png'));
 console.log('Name/number on intended panels only; light/dark rendering; leading zeros and validation; unique selections; export dimensions; adaptive name clearance, free vertical movement, migration and all team waist-badge compositions.');
})().catch(e=>{console.error(e);process.exit(1)});
