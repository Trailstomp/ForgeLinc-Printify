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
 const sqlite=new DatabaseSync(':memory:');
 for(const file of fs.readdirSync(path.resolve(__dirname,'../drizzle')).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync(path.resolve(__dirname,'../drizzle',file),'utf8'));
 const db={prepare(sql){const statement=sqlite.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};},async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 let owner='owner-a';const catalog=loadTS('lib/catalog.ts');
 class ConnectionError extends Error{constructor(message,status=400){super(message);this.status=status;}}
 const objects=new Map();const storage=loadTS('lib/artwork-storage.ts',{'cloudflare:workers':{env:{ARTWORK:{put:async(k,v)=>objects.set(k,v),get:async k=>objects.get(k)??null,delete:async k=>objects.delete(k)}}},'./storage':{database:()=>db},'./shopify-connection':{ConnectionError}});
 const bytes=new Uint8Array(33);bytes.set([137,80,78,71,13,10,26,10],0);bytes.set(Buffer.from('IHDR'),12);new DataView(bytes.buffer).setUint32(16,100);new DataView(bytes.buffer).setUint32(20,200);
 const asset=await storage.saveArtwork(owner,bytes,'crest.png');assert.deepEqual(await storage.getArtwork(owner,asset.id),bytes);assert.equal(await storage.getArtwork('owner-b',asset.id),null);
 assert.throws(()=>storage.pngDimensions(new Uint8Array(33)),/PNG/);
 const api=loadTS('app/api/studio/route.ts',{'@/app/chatgpt-auth':{getChatGPTUser:async()=>owner?{userId:owner}:null},'@/lib/storage':{database:()=>db},'@/lib/catalog':catalog,'@/lib/artwork-storage':storage,'@/lib/shopify-connection':{ConnectionError}});
 const post=body=>api.POST(new Request('https://studio.test/api/studio',{method:'POST',headers:{origin:'https://studio.test','content-type':'application/json'},body:JSON.stringify(body)}));
 const dayton={...catalog.teamDefaultConfig('dayton-eagles'),primary:'#334455',accent:'#eecc22',shirtColor:'#252525',trimColor:'#82ccdd',frontY:.39,includeQR:false,artwork:{'right-sleeve':{assetId:asset.id,visible:true,x:.42,y:.29,scale:1.4,caption:false},'left-sleeve':{assetId:null,visible:false,x:.5,y:.4,scale:1,caption:false}}};
 const queen={...catalog.teamDefaultConfig('queen-city'),primary:'#2244aa',accent:'#ef6500',shirtColor:'#fff0d0',trimColor:'#dddddd',backScale:.39};
 const legacy={...catalog.defaultConfig,primary:'#aabbcc',shopDomain:'eewwjf-tt.myshopify.com'};
 sqlite.prepare('INSERT INTO templates VALUES (?,?,?,?)').run(owner,'brotherhood-v1',JSON.stringify(legacy),'before');
 assert.equal((await post({action:'save',teamId:'dayton-eagles',config:dayton})).status,200);
 assert.equal((await post({action:'save',teamId:'queen-city',config:queen})).status,200);
 let loaded=await (await api.GET()).json();
 assert.deepEqual(loaded.drafts.find(d=>d.teamId==='dayton-eagles').config,dayton);
 assert.deepEqual(loaded.drafts.find(d=>d.teamId==='queen-city').config,queen);
 assert.deepEqual(loaded.legacyTemplate,legacy);
 assert.equal(loaded.shopDomain,legacy.shopDomain);
 assert.notEqual(catalog.teamDefaultConfig('trash-pandas').primary,dayton.primary);
 for(const team of catalog.teams){
  const prior={...catalog.teamDefaultConfig(team.id),shirtColor:'#343536',artwork:{front:{assetId:null,visible:true,x:.4,y:.3,scale:1.2,caption:false}}};delete prior.sleeveStyle;
  const upgraded=catalog.upgradeSleeveArtwork(catalog.configSchema.parse(prior));
  assert.equal(upgraded.shirtColor,prior.shirtColor);assert.deepEqual(upgraded.artwork.front,prior.artwork.front);
  assert.equal(upgraded.artwork['left-sleeve'].visible,false);assert.equal(upgraded.artwork['right-sleeve'].visible,true);
  const edited={...upgraded,backBehindStripes:false,artwork:{...upgraded.artwork,'right-sleeve':{...upgraded.artwork['right-sleeve'],visible:false}}};
  assert.deepEqual(catalog.upgradeSleeveArtwork(catalog.configSchema.parse(edited)),edited,'Later deletion and layer order survive reloading');
 }
 const oldSettings={...dayton};delete oldSettings.shirtColor;delete oldSettings.trimColor;
 assert.equal(catalog.configSchema.parse(oldSettings).shirtColor,'#ffffff');
 assert.equal(catalog.configSchema.parse(oldSettings).trimColor,'#c4c8cc');
 assert.equal((await post({action:'generate',designs:[{teamId:'dayton-eagles',config:dayton},{teamId:'queen-city',config:queen}]})).status,200);
 loaded=await (await api.GET()).json();assert.equal(loaded.drafts.length,2);
 assert.equal(loaded.drafts.find(d=>d.teamId==='dayton-eagles').config.accent,dayton.accent);
 assert.equal(loaded.drafts.find(d=>d.teamId==='queen-city').config.accent,queen.accent);
 assert.equal((await post({action:'save-store',shopDomain:'eewwjf-tt.myshopify.com'})).status,200);
 loaded=await (await api.GET()).json();assert.deepEqual(loaded.drafts.find(d=>d.teamId==='dayton-eagles').config,dayton);
 assert.equal((await post({action:'save',config:dayton})).status,400);
 assert.equal((await post({action:'generate',teamIds:['dayton-eagles','queen-city'],config:dayton})).status,400);
 assert.equal((await post({action:'generate',designs:[{teamId:'unknown',config:dayton}]})).status,400);
 owner='owner-b';assert.equal((await post({action:'save',teamId:'dayton-eagles',config:dayton})).status,403);assert.deepEqual((await (await api.GET()).json()).drafts,[]);
 await post({action:'save',teamId:'dayton-eagles',config:queen});
 owner='owner-a';assert.deepEqual((await (await api.GET()).json()).drafts.find(d=>d.teamId==='dayton-eagles').config,dayton);
 // Independent colorways and immutable shopper selections use separate draft identities.
 const dark=catalog.themeDesign(dayton,'dark');dark.artwork.front={assetId:asset.id,visible:true,x:.5,y:.37,scale:1.2,caption:false};
 assert.equal((await post({action:'save',teamId:'dayton-eagles',config:dark})).status,200);
 loaded=await (await api.GET()).json();
 assert.deepEqual(loaded.drafts.find(d=>d.id===catalog.draftKey('dayton-eagles')).config,dayton);
 assert.deepEqual(loaded.drafts.find(d=>d.id===catalog.draftKey('dayton-eagles','dark')).config,dark);
 const options={allowUploads:true,logos:[{id:crypto.randomUUID(),assetId:asset.id,name:'Alternate eagle'}]};
 assert.equal((await post({action:'save-logo-options',teamId:'dayton-eagles',options})).status,200);
 assert.deepEqual((await (await api.GET()).json()).logoOptions['dayton-eagles'],options);
 const custom=catalog.withFrontLogo(dark,asset.id,'My uploaded eagle');
 assert.equal(custom.artwork.front.x,.5);assert.equal(custom.artwork.front.y,.37);assert.equal(custom.artwork.front.scale,1.2);
 const selection=await (await post({action:'save-selection',teamId:'dayton-eagles',config:custom})).json();
 assert(selection.drafts[0].id.startsWith('selection:'));assert.equal(catalog.isTeamTemplate(selection.drafts[0]),false);
 const editedDark={...dark,accent:'#abcdef'};await post({action:'save',teamId:'dayton-eagles',config:editedDark});
 loaded=await (await api.GET()).json();assert.deepEqual(loaded.drafts.find(d=>d.id===selection.drafts[0].id).config,custom);
 assert.deepEqual(loaded.drafts.find(d=>d.id===catalog.draftKey('dayton-eagles')).config,dayton);
 const combinations=catalog.teams.flatMap(t=>['light','dark'].map(theme=>({teamId:t.id,config:catalog.themeDesign(catalog.teamDefaultConfig(t.id),theme)})));
 assert.equal((await post({action:'generate',designs:combinations})).status,200);
 loaded=await (await api.GET()).json();assert.equal(loaded.drafts.filter(catalog.isTeamTemplate).length,22);assert(loaded.drafts.some(d=>d.id===selection.drafts[0].id));
 owner='owner-b';assert.equal((await post({action:'save-logo-options',teamId:'dayton-eagles',options})).status,403);
 assert.equal((await post({action:'save-selection',teamId:'dayton-eagles',config:custom})).status,403);
 assert.deepEqual((await (await api.GET()).json()).logoOptions,{});owner='owner-a';
 // A separate alternate library for every panel preserves the existing front list.
 let everyPanel=options;const choices={};
 for(const panel of catalog.artworkPanels){const policy={allowUploads:false,offerOriginal:true,logos:[{id:crypto.randomUUID(),assetId:asset.id,name:panel+' alternate'}]};everyPanel=catalog.setPanelLogoOptions(everyPanel,panel,policy);choices[panel]=policy.logos[0];}
 assert.equal((await post({action:'save-logo-options',teamId:'dayton-eagles',options:everyPanel})).status,200);
 assert.deepEqual((await (await api.GET()).json()).logoOptions['dayton-eagles'],everyPanel);
 const allApplied=catalog.applyArtworkChoices(dayton,choices,everyPanel);assert.equal(catalog.sameDesign(allApplied,dayton),false);
 for(const panel of catalog.artworkPanels){assert.equal(allApplied.artwork[panel].assetId,asset.id);const reset=catalog.restoreOriginalArtwork(allApplied,panel);assert.equal(reset.artwork[panel].assetId,null);assert.equal(reset.artwork[panel].x,allApplied.artwork[panel].x);assert.equal(reset.artwork[panel].y,allApplied.artwork[panel].y);for(const other of catalog.artworkPanels.filter(p=>p!==panel))assert.deepEqual(reset.artwork[other],allApplied.artwork[other]);}
 assert.equal(catalog.restoreOriginalArtwork(allApplied,'collar').artwork.collar.visible,false);
 assert.equal(catalog.restoreOriginalArtwork(allApplied,'front').frontLogoLabel,'Team crest');
 const noUpload=catalog.applyArtworkChoices(dayton,{back:{id:'upload',assetId:asset.id,name:'Not allowed'}},everyPanel);assert.deepEqual(noUpload,dayton);
 const noOriginal=catalog.setPanelLogoOptions(everyPanel,'front',{...catalog.panelLogoOptions(everyPanel,'front'),offerOriginal:false});assert.deepEqual(catalog.applyArtworkChoices(allApplied,{front:{id:'original',name:'Original'}},noOriginal),allApplied);
 const persisted=await (await post({action:'save-selection',teamId:'dayton-eagles',config:allApplied})).json();assert.deepEqual(persisted.drafts[0].config,allApplied);
 owner='owner-b';assert.equal((await post({action:'save-logo-options',teamId:'dayton-eagles',options:everyPanel})).status,403);owner='owner-a';
 // Named team themes retain stable identities independently of their display names.
 const customThemes=[];
 for(let i=0;i<30;i++){const cfg={...structuredClone(allApplied),jerseyTheme:'custom:'+crypto.randomUUID(),themeName:'Tournament '+i,accent:'#123456'};customThemes.push(cfg);assert.equal((await post({action:'save',teamId:'dayton-eagles',config:cfg})).status,200);}
 loaded=await (await api.GET()).json();
 assert.equal(loaded.drafts.filter(d=>d.teamId==='dayton-eagles'&&catalog.isCustomTheme(d.config.jerseyTheme)&&catalog.isTeamTemplate(d)).length,30);
 const first=customThemes[0],firstId=catalog.draftKey('dayton-eagles',first.jerseyTheme);
 assert.deepEqual(loaded.drafts.find(d=>d.id===firstId).config,first);
 const customSnapshot=await (await post({action:'save-selection',teamId:'dayton-eagles',config:first})).json();
 const renamed={...first,themeName:'Finals Edition',shirtColor:'#ddeeff'};await post({action:'save',teamId:'dayton-eagles',config:renamed});
 loaded=await (await api.GET()).json();assert.deepEqual(loaded.drafts.find(d=>d.id===firstId).config,renamed);assert.deepEqual(loaded.drafts.find(d=>d.id===customSnapshot.drafts[0].id).config,first);
 assert.equal(catalog.themeLabel(renamed),'Finals Edition');
 assert.equal((await post({action:'save',teamId:'dayton-eagles',config:{...first,themeName:''}})).status,400);
 assert.equal((await post({action:'save',teamId:'dayton-eagles',config:{...first,jerseyTheme:'arbitrary'}})).status,400);
 assert.equal((await post({action:'delete-theme',teamId:'dayton-eagles',theme:'light'})).status,400);
 assert.equal((await post({action:'delete-theme',teamId:'dayton-eagles',theme:'dark'})).status,400);
 owner='owner-b';assert.equal((await post({action:'delete-theme',teamId:'dayton-eagles',theme:first.jerseyTheme})).status,200);owner='owner-a';
 assert((await (await api.GET()).json()).drafts.some(d=>d.id===firstId));
 assert.equal((await post({action:'delete-theme',teamId:'dayton-eagles',theme:first.jerseyTheme})).status,200);
 loaded=await (await api.GET()).json();assert(!loaded.drafts.some(d=>d.id===firstId));assert(loaded.drafts.some(d=>d.id===customSnapshot.drafts[0].id));assert(loaded.drafts.some(d=>d.id===catalog.draftKey('dayton-eagles','dark')));
 owner=null;assert.equal((await api.GET()).status,401);
 assert.equal(catalog.sameDesign(dayton,structuredClone(dayton)),true);assert.equal(catalog.sameDesign(dayton,{...dayton,artwork:{}}),false);
 console.log('Passed: 22 independent colorways, logo library reload, owned-logo enforcement, immutable custom selections, preserved logo placement, uploaded artwork storage, ownership validation, panel settings reload, independent team save/reload, individual bulk colors, legacy recovery, separate store settings, stale payload rejection, and owner isolation.');
 sqlite.close();
})().catch(e=>{console.error(e);process.exit(1);});
