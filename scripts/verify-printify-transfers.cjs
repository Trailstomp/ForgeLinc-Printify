const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite');
function load(file,mocks){const filename=path.resolve(file),mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));const native=mod.require.bind(mod);mod.require=name=>name in mocks?mocks[name]:native(name);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,filename);return mod.exports;}
(async()=>{
 const sqlite=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+f,'utf8'));
 const db={prepare(sql){const s=sqlite.prepare(sql);let args=[];return {bind(...v){args=v;return this;},async all(){return {results:s.all(...args)};},async run(){return s.run(...args);}};}};
 const catalog=load('lib/catalog.ts',{});class ConnectionError extends Error{constructor(message,status=400){super(message);this.status=status;}}
 let shopId=123,owner='owner-a',mode='ok',creation=0,uploads=0,createdProducts=[],lastProduct=null;
 const conn={readPrintifyConnection:async()=>({sealed_secret:'opaque'}),unsealPrintify:async()=>({token:'synthetic-token',shopId})};
 const t=load('lib/printify-transfers.ts',{'./jersey-sizes':load('lib/jersey-sizes.ts',{}),'./team-storage':{ownerTeam:async(_owner,id)=>catalog.getTeam(id)},'./shopify-orders':{purchasedArtwork:async()=>{throw new Error('Ordinary drafts must not read orders');}},'./artwork-storage':{validateArtworkOwnership:async()=>{}},'./storage':{database:()=>db},'./catalog':catalog,'./shopify-connection':{ConnectionError},'./printify-connection':conn});
 const areas=[{position:'front',width:500,height:600},{position:'back',width:500,height:600},{position:'left_sleeve',width:400,height:200},{position:'right_sleeve',width:400,height:200},{position:'collar',width:400,height:40}];
 const png=a=>{const b=new Uint8Array(33);b.set([137,80,78,71,13,10,26,10]);b.set([73,72,68,82],12);new DataView(b.buffer).setUint32(16,a.width);new DataView(b.buffer).setUint32(20,a.height);return b;};
 global.fetch=async(url,init)=>{
  assert.equal(new URL(url).origin,'https://api.printify.com');assert.equal(init.redirect,'manual');assert.equal(init.cache,'no-store');assert.equal(init.headers.Authorization,'Bearer synthetic-token');assert(!/orders|publish|connection\.json/.test(url));
  if(mode==='redirect')return new Response(null,{status:307,headers:{Location:'https://untrusted.example/'}});
  if(url.endsWith('catalog/blueprints.json'))return Response.json([{id:10,title:"Men's Sports Jersey (AOP)"}]);
  if(url.endsWith('/print_providers.json'))return Response.json([{id:20,title:'Miami Sublimation'}]);
  if(url.endsWith('/variants.json'))return Response.json({variants:[{id:30,title:'White / L',options:{size:'L'},placeholders:mode==='changed'?areas.map((p,i)=>i===0?{...p,width:501}:p):areas}]});
  if(url.endsWith('uploads/images.json')){uploads++;const b=JSON.parse(init.body),bytes=Uint8Array.from(Buffer.from(b.contents,'base64')),v=new DataView(bytes.buffer);return Response.json({id:'image-'+uploads,width:v.getUint32(16),height:v.getUint32(20)});}
  if(url.endsWith('/products.json')&&init.method==='POST'){
   creation++;lastProduct=JSON.parse(init.body);assert.equal(lastProduct.blueprint_id,10);assert.equal(lastProduct.print_provider_id,20);assert.equal(lastProduct.variants.length,1);assert.equal(lastProduct.print_areas[0].placeholders.length,5);assert(lastProduct.print_areas[0].placeholders.every(p=>p.images.length===1&&p.images[0].scale===1&&p.images[0].x===.5&&p.images[0].y===.5));
   if(mode==='rejected')return Response.json({error:'synthetic-token'},{status:400});
   const p={...lastProduct,id:'product-'+creation,images:[{src:'https://images.printify.com/mockup.png',position:'front'},{src:'javascript:bad',position:'back'}]};createdProducts.push(p);
   if(mode==='timeout')throw new Error('Network failed synthetic-token');return Response.json(p);
  }
  if(url.includes('/products.json?'))return Response.json({data:createdProducts,next_page_url:null});
  if(/\/products\/product-\d+\.json$/.test(url))return Response.json(createdProducts.at(-1));
  throw new Error('Unexpected endpoint '+url);
 };
 assert.throws(()=>t.mapAreas(areas.slice(0,4)));assert.throws(()=>t.mapAreas([...areas,areas[0]]));assert.throws(()=>t.mapAreas(areas.map(p=>({...p,decoration_method:'dtg'}))));
 const config={...catalog.defaultConfig,accent:'#cc1428',frontScale:.43};
 sqlite.prepare('INSERT INTO drafts(owner,id,team_id,config,updated_at) VALUES(?,?,?,?,?)').run(owner,catalog.draftKey('dayton-eagles'),'dayton-eagles',JSON.stringify(config),'2026-09-12');
 let job=await t.prepareTransfer(owner,'dayton-eagles',30,4999);assert.deepEqual(job.snapshot.config,JSON.parse(JSON.stringify(config)));assert.equal((await t.prepareTransfer(owner,'dayton-eagles',30,4999)).id,job.id);
 const selectedId='selection:'+crypto.randomUUID(),personalized={...catalog.themeDesign(config,'dark'),frontLogoLabel:'Custom eagle',artwork:{front:{assetId:crypto.randomUUID(),visible:true,x:.5,y:.35,scale:1.2,caption:false}}};
 sqlite.prepare('INSERT INTO drafts(owner,id,team_id,config,updated_at) VALUES(?,?,?,?,?)').run(owner,selectedId,'dayton-eagles',JSON.stringify(personalized),'2026-09-12');
 const personalJob=await t.prepareTransfer(owner,'dayton-eagles',30,4999,selectedId);assert.deepEqual(personalJob.snapshot.config,JSON.parse(JSON.stringify(personalized)));assert.notEqual(personalJob.id,job.id);
 await assert.rejects(()=>t.prepareTransfer('owner-b','dayton-eagles',30,4999,selectedId));
 await assert.rejects(()=>t.prepareTransfer(owner,'queen-city',30,4999,selectedId));
 assert.equal(await t.readTransfer('owner-b',job.id),null);await assert.rejects(()=>t.createProduct('owner-b',job.id));await assert.rejects(()=>t.createProduct(owner,job.id));assert.equal(creation,0);
 const bad=png({...areas[0],width:501});await assert.rejects(()=>t.uploadPanel(owner,job.id,'front',bad));assert.equal(uploads,0);
 for(const a of job.snapshot.variant.areas)job=await t.uploadPanel(owner,job.id,a.panel,png(a));assert.equal(uploads,5);await t.uploadPanel(owner,job.id,'front',png(areas[0]));assert.equal(uploads,5);
 mode='changed';await assert.rejects(()=>t.createProduct(owner,job.id));assert.equal(creation,0);mode='ok';
 const both=await Promise.allSettled([t.createProduct(owner,job.id),t.createProduct(owner,job.id)]);assert(both.some(r=>r.status==='fulfilled'));assert.equal(creation,1);job=await t.readTransfer(owner,job.id);assert.equal(job.status,'created');assert.equal(job.product.images.length,1);await t.createProduct(owner,job.id);assert.equal(creation,1);
 const first=job;
 job=await t.prepareTransfer(owner,'dayton-eagles',30,5000);for(const a of job.snapshot.variant.areas)job=await t.uploadPanel(owner,job.id,a.panel,png(a));
 mode='timeout';await assert.rejects(()=>t.createProduct(owner,job.id));assert.equal((await t.readTransfer(owner,job.id)).status,'uncertain');await assert.rejects(()=>t.createProduct(owner,job.id));assert.equal(creation,2);mode='ok';job=await t.recheckProduct(owner,job.id);assert.equal(job.status,'created');assert.equal(creation,2);
 shopId=456;await assert.rejects(()=>t.createProduct(owner,first.id));shopId=123;
 const http=load('lib/transfer-http.ts',{'./studio-access':{requireStudioAdmin:async()=>{if(!owner)throw new ConnectionError('Please sign in.',401);return {userId:owner};}},'@/app/chatgpt-auth':{getChatGPTUser:async()=>owner?{userId:owner}:null},'./shopify-connection':{ConnectionError}});
 const route=load('app/api/printify/drafts/route.ts',{'@/lib/printify-transfers':t,'@/lib/transfer-http':http,'@/lib/catalog':catalog,'@/lib/team-storage':{ownerTeam:async(_owner,id)=>catalog.getTeam(id)}});
 let r=await route.POST(new Request('https://studio.test/api/printify/drafts',{method:'POST',headers:{origin:'https://evil.test','content-type':'application/json'},body:JSON.stringify({action:'create',id:job.id})}));assert.equal(r.status,403);
 owner=null;r=await route.GET(new Request('https://studio.test/api/printify/drafts'));assert.equal(r.status,401);owner='owner-a';
 mode='redirect';await assert.rejects(()=>t.jerseyCatalog(awaitableCredential()),e=>!e.message.includes('synthetic-token'));mode='ok';
 const tournament={...structuredClone(personalized),jerseyTheme:'custom:'+crypto.randomUUID(),themeName:'Fall Tournament'};
 const tournamentId=catalog.draftKey('dayton-eagles',tournament.jerseyTheme);
 sqlite.prepare('INSERT INTO drafts(owner,id,team_id,config,updated_at) VALUES(?,?,?,?,?)').run(owner,tournamentId,'dayton-eagles',JSON.stringify(tournament),'2026-09-12');
 let tournamentJob=await t.prepareTransfer(owner,'dayton-eagles',30,4999,tournamentId);assert.deepEqual(tournamentJob.snapshot.config,JSON.parse(JSON.stringify(tournament)));
 for(const area of tournamentJob.snapshot.variant.areas)tournamentJob=await t.uploadPanel(owner,tournamentJob.id,area.panel,png(area));
 await t.createProduct(owner,tournamentJob.id);assert(lastProduct.title.includes('Fall Tournament'));assert(lastProduct.title.includes('Custom eagle'));
 console.log('Passed: live catalog mapping, saved snapshot, all-five-panel requirement, dimensions, upload resume, atomic duplicate protection, ambiguous-response recovery, owner/store isolation, auth/CSRF and no publish/order calls.');sqlite.close();
 function awaitableCredential(){return {token:'synthetic-token',shopId:123};}
})().catch(e=>{console.error(e);process.exitCode=1;});
