const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const {DatabaseSync}=require('node:sqlite');const sql=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const db={prepare(query){const statement=sql.prepare(query);let args=[];return {bind(...v){args=v;return this;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};},async batch(items){return Promise.all(items.map(i=>i.run()));}};
let user=null;const overrides={'@/app/chatgpt-auth':{getChatGPTUser:async()=>user},'@/lib/storage':{database:()=>db},'cloudflare:workers':{env:{}}},cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;new Function('require','module','exports',code)(id=>{if(overrides[id])return overrides[id];if(id.startsWith('.')||id.startsWith('@/')){const dest=id.startsWith('@/')?path.resolve(id.slice(2)):path.resolve(path.dirname(file),id);if(dest===path.resolve('lib/storage'))return overrides['@/lib/storage'];return dest.endsWith('.json')?require(dest):load(dest+'.ts');}return require(id);},m,m.exports);return m.exports;}
(async()=>{
const access=load('lib/studio-access.ts'),catalog=load('lib/catalog.ts'),studio=load('app/api/studio/route.ts'),http=load('lib/transfer-http.ts');
const post=(route,body={action:'save-store',shopDomain:'eewwjf-tt.myshopify.com'})=>route.POST(new Request('https://shop.test/api',{method:'POST',headers:{origin:'https://shop.test','content-type':'application/json'},body:JSON.stringify(body)}));
for(const identity of [null,{userId:'player',email:'player@test'},{userId:'player',email:'trailstomp@gmail.com',isAdmin:true,role:'owner'}]){
user=identity;const expected=user?403:401;assert.equal(access.isStudioAdmin(user),false);
for(const file of ['app/api/studio/route.ts','app/api/connections/shopify/route.ts','app/api/connections/printify/route.ts']){const api=load(file);assert.equal((await api.GET()).status,expected,file+' GET');assert.equal((await post(api)).status,expected,file+' POST');}
await assert.rejects(http.transferOwner(),e=>e.status===expected);
for(const action of ['save','generate','save-team','save-logo-options','delete-theme','save-selection'])assert.equal((await post(studio,{action})).status,expected,action);
}
user={userId:access.STUDIO_OWNER_ID,email:'owner@test'};assert(access.isStudioAdmin(user));assert.equal(await http.transferOwner(),user.userId);
assert.equal((await post(studio)).status,200);assert.equal((await studio.GET()).status,200);
await assert.rejects(http.transferOwner(new Request('https://shop.test/api',{headers:{origin:'https://evil.test'}})),e=>e.status===403);
const personalized={...catalog.defaultConfig,playerName:'Chandler',playerNumber:'007'};
const selection=await (await post(studio,{action:'save-selection',teamId:'dayton-eagles',config:personalized})).json();
const template=await (await post(studio,{action:'save',teamId:'dayton-eagles',config:personalized})).json();assert.equal(template.drafts[0].config.playerName,'');assert.equal(template.drafts[0].config.playerNumber,'');sql.prepare('DELETE FROM drafts WHERE id=?').run(catalog.draftKey('dayton-eagles'));
assert.equal(selection.drafts[0].config.playerNumber,'007');assert.equal(selection.drafts[0].config.playerName,'Chandler');
assert.equal((await studio.GET()).status,200);
const art='00000000-0000-4000-8000-000000000001',privateArt='00000000-0000-4000-8000-000000000002';const cfg={...catalog.teamDefaultConfig('dayton-eagles'),artwork:{front:{assetId:art,visible:true,x:.5,y:.4,scale:1,caption:false}}};
sql.prepare('INSERT INTO drafts VALUES(?,?,?,?,?)').run(user.userId,catalog.draftKey('dayton-eagles'),'dayton-eagles',JSON.stringify(cfg),'now');
sql.prepare('INSERT INTO drafts VALUES(?,?,?,?,?)').run(user.userId,'selection:private','dayton-eagles',JSON.stringify({...cfg,stripeAssetId:privateArt}),'now');
const shop=load('lib/shop-catalog.ts');user={userId:'player',email:'player@test'};
const data=await shop.shopCatalog();assert.equal(data.drafts.length,1);assert.equal(data.shopDomain,'');assert.equal(data.legacyTemplate,null);assert(!JSON.stringify(data).includes(privateArt));assert(await shop.isShopArtwork(art));assert.equal(await shop.isShopArtwork(privateArt),false);
assert.equal(await http.artworkViewer(),user.userId);assert.equal((await load('app/api/shop/route.ts').GET()).status,200);
user=null;assert.equal((await load('app/api/shop/route.ts').GET()).status,401);
console.log('Owner can edit; players/anonymous requests cannot access admin APIs or Printify; forged roles denied; shop returns team templates only; private selection artwork excluded; shopper identity remains separate.');
})().catch(e=>{console.error(e);process.exit(1);});
