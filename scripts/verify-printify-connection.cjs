const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite'),{randomBytes}=require('node:crypto');
function load(file,mocks){const filename=path.resolve(file),mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));const native=mod.require.bind(mod);mod.require=name=>name in mocks?mocks[name]:native(name);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;}
(async()=>{
 const sqlite=new DatabaseSync(':memory:');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+file,'utf8'));
 const db={prepare(sql){const statement=sqlite.prepare(sql);let args=[];return {bind(...v){args=v;return this;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};}};
 const env={CONNECTION_ENCRYPTION_KEY:randomBytes(32).toString('hex')};
 const shopify=load('lib/shopify-connection.ts',{'cloudflare:workers':{env},'./storage':{database:()=>db}});
 const connection=load('lib/printify-connection.ts',{'cloudflare:workers':{env},'./storage':{database:()=>db},'./shopify-connection':shopify});
 let owner='owner-a',mode='ok',requests=[];const token='synthetic-printify-token-not-real';
 global.fetch=async(url,init)=>{
  requests.push(url);const parsed=new URL(url);assert.equal(parsed.origin,'https://api.printify.com');assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.cache,'no-store');assert.equal(init.headers.Authorization,'Bearer '+token);assert.equal(init.headers['User-Agent'],'ForgeLinc/1.0');assert(!url.includes(token));
  if(mode==='unauthorized')return Response.json({error:token},{status:401});
  if(mode==='redirect')return new Response(null,{status:307,headers:{Location:'https://untrusted.example/'+token}});
  if(parsed.pathname==='/v1/shops.json')return Response.json([{id:123,title:'LincWerks',sales_channel:'shopify'},{id:456,title:'Other store',sales_channel:'etsy'}]);
  assert.equal(parsed.pathname,'/v1/shops/123/products.json');
  if(mode==='scope')return Response.json({error:token},{status:403});
  return Response.json({data:[{id:'jersey-id',title:'Sports Jersey',blueprint_id:42,print_provider_id:8}]});
 };
 const route=load('app/api/connections/printify/route.ts',{'@/app/chatgpt-auth':{getChatGPTUser:async()=>owner?{userId:owner}:null},'@/lib/shopify-connection':shopify,'@/lib/printify-connection':connection});
 const post=(body,origin='https://studio.test')=>route.POST(new Request('https://studio.test/api/connections/printify',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}));
 const rows=()=>sqlite.prepare('SELECT * FROM shop_connections WHERE owner=? AND provider=?').get('owner-a','printify');
 assert.equal((await post({action:'discover',token},'https://untrusted.example')).status,403);
 owner=null;assert.equal((await route.GET()).status,401);assert.equal((await post({action:'discover',token})).status,401);owner='owner-a';
 assert.equal((await post({action:'discover',token:'x'.repeat(9000)})).status,413);assert.equal(requests.length,0);
 const discovery=await post({action:'discover',token});assert.equal(discovery.status,200);assert.equal((await discovery.json()).shops.length,2);assert.equal(rows(),undefined,'Discovery must not save a token');
 for(const shopId of [999,456,-1])assert((await post({action:'connect',token,shopId})).status>=400);assert.equal(rows(),undefined);
 const preserved=await shopify.seal(owner,{clientSecret:'synthetic-shopify-secret'});await shopify.saveConnection(owner,preserved,{name:'LincWerks',domain:shopify.SHOPIFY_DOMAIN,productAccess:true,checkedAt:new Date().toISOString(),products:[]});
 const response=await post({action:'connect',token,shopId:123});assert.equal(response.status,200);const text=await response.text();assert(!text.includes(token));assert.equal(JSON.parse(text).lastVerified.products[0].title,'Sports Jersey');
 const row=rows();assert(!JSON.stringify(row).includes(token));assert.equal((await connection.unsealPrintify(owner,row.sealed_secret)).token,token);
 await assert.rejects(()=>connection.unsealPrintify('owner-b',row.sealed_secret));await assert.rejects(()=>connection.unsealPrintify(owner,preserved));
 const broken=JSON.parse(row.sealed_secret);broken.data=(broken.data[0]==='A'?'B':'A')+broken.data.slice(1);await assert.rejects(()=>connection.unsealPrintify(owner,JSON.stringify(broken)));
 const status=await (await route.GET()).text();assert(!status.includes(token));assert(!status.includes('sealed_secret'));
 owner='owner-b';assert.equal((await (await route.GET()).json()).configured,false);assert.equal((await post({action:'verify'})).status,409);owner='owner-a';
 requests=[];assert.equal((await post({action:'verify'})).status,200);assert.equal(requests.length,2);
 for(mode of ['unauthorized','scope','redirect']){requests=[];const failure=await post({action:'connect',token,shopId:123});assert(failure.status>=400);assert(!(await failure.text()).includes(token));assert.equal(rows().sealed_secret,row.sealed_secret,'Failed replacement preserves connection');if(mode==='redirect')assert.equal(requests.length,1);}
 assert.equal((await shopify.readConnection(owner)).sealed_secret,preserved,'Printify must not change Shopify connection');
 env.CONNECTION_ENCRYPTION_KEY='';assert.equal((await post({action:'discover',token})).status,503);
 console.log('Passed: discovery, store ownership/channel checks, encrypted token persistence, provider and owner isolation, recheck, auth/CSRF/body bounds, redirect rejection, redaction, and failed replacement preservation.');sqlite.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
