const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite');
const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE templates(owner TEXT,id TEXT,config TEXT,updated_at TEXT,PRIMARY KEY(owner,id));CREATE TABLE drafts(owner TEXT,id TEXT,team_id TEXT,config TEXT,updated_at TEXT,PRIMARY KEY(owner,id));CREATE TABLE artwork_files(owner TEXT,id TEXT);');
const db={
 prepare(text){return {bind(...args){return {
  async all(){return {results:sql.prepare(text).all(...args)}},
  async run(){return sql.prepare(text).run(...args)}
 }}}},
 async batch(statements){for(const statement of statements)await statement.run()}
};
let user='owner-a';class ConnectionError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>{if(id.endsWith('chatgpt-auth'))return {getChatGPTUser:async()=>user?{userId:user}:null};if(id==='cloudflare:workers')return {env:{DB:db}};if(id.endsWith('shopify-connection'))return {ConnectionError};if(id.endsWith('printify-connection'))return {};if(id.startsWith('@/'))return load(id.slice(2)+'.ts');if(id.startsWith('.'))return id.endsWith('.json')?require(path.resolve(path.dirname(file),id)):load(path.resolve(path.dirname(file),id+'.ts'));return require(id)},m,m.exports);return m.exports;}
(async()=>{
 const route=load('app/api/studio/route.ts'),c=load('lib/catalog.ts');
 async function post(body,origin='https://forge.test'){const response=await route.POST(new Request('https://forge.test/api/studio',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:response.status,body:await response.json()};}
 const art=crypto.randomUUID();sql.prepare('INSERT INTO artwork_files VALUES(?,?)').run(user,art);
 const definition={id:'custom-team-'+crypto.randomUUID(),name:'Tournament Select',kind:'team',primary:'#123456',accent:'#abcdef',logoAssetId:art,backAssetId:null};
 assert.equal((await post({action:'save-team',team:definition})).status,200);
 const workspace=await (await route.GET()).json();assert.equal(workspace.teams.length,13);assert(workspace.teams.some(t=>t.id==='mlbl'));assert.equal(workspace.teams.find(t=>t.id===definition.id).logo,'/api/artwork/'+art);
 const config={...c.defaultConfig,stripeStyle:'angular',primary:'#123456',accent:'#abcdef'};
 assert.equal((await post({action:'save',teamId:definition.id,config})).status,200);
 assert.equal((await post({action:'save',teamId:'mlbl',config:{...config,stripeStyle:'none'}})).status,200);
 const custom={...config,jerseyTheme:'custom:'+crypto.randomUUID(),themeName:'Tournament',stripeStyle:'custom',stripeAssetId:art};
 assert.equal((await post({action:'save',teamId:definition.id,config:custom})).status,200);
 const reloaded=await (await route.GET()).json();assert.equal(reloaded.customTeams[0].name,definition.name);assert.equal(reloaded.drafts.find(d=>d.config.themeName==='Tournament').config.stripeAssetId,art);
 assert.equal((await post({action:'save-logo-options',teamId:definition.id,options:{allowUploads:true,logos:[{id:crypto.randomUUID(),name:'Alternate',assetId:art}]}})).status,200);
 assert.equal((await post({action:'save-team',team:{...definition,id:'custom-team-'+crypto.randomUUID()}})).status,409);
 assert.equal((await post({action:'save',teamId:definition.id,config:{...custom,stripeAssetId:crypto.randomUUID()}})).status,403);
 assert.equal((await post({action:'save-team',team:definition},'https://other.test')).status,403);
 user='owner-b';assert.equal((await (await route.GET()).json()).customTeams.length,0);
 assert.equal((await post({action:'save',teamId:definition.id,config})).status,400);
 assert.equal((await post({action:'save-team',team:{...definition,name:'Other'}})).status,403);
 user=null;assert.equal((await route.GET()).status,401);
 const transfers=load('lib/printify-transfers.ts');const areas=c.panels.map(p=>({...p,panel:p.id,position:p.id})),snapshot={teamId:definition.id,team:c.customTeamView(definition),config,shopId:1,catalog:{blueprint:{id:1},provider:{id:2}},variant:{id:3,areas},price:4900};const uploads=Object.fromEntries(c.panels.map(p=>[p.id,{id:'upload-'+p.id}]));assert(transfers.buildProduct('fixture',snapshot,uploads).title.startsWith('Tournament Select'));
 console.log('Custom team create/reload, MLBL design, independent themes, stripe assets, alternate logos, owner isolation, origin/auth guards and Printify snapshot title passed.');
})().catch(e=>{console.error(e);process.exit(1)});
