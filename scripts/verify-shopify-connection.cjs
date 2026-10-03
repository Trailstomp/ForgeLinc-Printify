const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite'),{randomBytes}=require('node:crypto');
function load(file,mocks){const filename=path.resolve(file),mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));const native=mod.require.bind(mod);mod.require=name=>name in mocks?mocks[name]:native(name);mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;}
(async()=>{
 const sqlite=new DatabaseSync(':memory:');for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+file,'utf8'));
 const db={prepare(sql){const s=sqlite.prepare(sql);let args=[];return {bind(...v){args=v;return this;},async all(){return {results:s.all(...args)};},async run(){return s.run(...args);}};}};
 const env={CONNECTION_ENCRYPTION_KEY:randomBytes(32).toString('hex')};
 const connection=load('lib/shopify-connection.ts',{'cloudflare:workers':{env},'./storage':{database:()=>db}});
 let owner='owner-a',requests=0,mode='ok';
 const secret='synthetic-client-secret-not-a-real-credential',token='synthetic-token';
 global.fetch=async(url,init)=>{
  requests++;assert.equal(new URL(url).host,connection.SHOPIFY_DOMAIN);assert.equal(init.redirect,'manual');assert.equal(init.cache,'no-store');
  if(url.endsWith('/admin/oauth/access_token')){assert.equal(init.body.get('client_id'),connection.SHOPIFY_CLIENT_ID);assert.equal(init.body.get('client_secret'),secret);assert.equal(init.body.get('grant_type'),'client_credentials');
   if(mode==='rejected')return Response.json({error:secret},{status:401});
   return Response.json({access_token:token,scope:mode==='no-scope'?'read_orders':'write_products',expires_in:86400});
  }
  assert(url.endsWith('/admin/api/2026-07/graphql.json'));assert.equal(init.headers['X-Shopify-Access-Token'],token);assert(!JSON.parse(init.body).query.includes('mutation'));
  if(mode==='graphql-failed')return Response.json({errors:[{message:secret}]});
  return Response.json({data:{shop:{name:'LincWerks',myshopifyDomain:mode==='wrong-store'?'other.myshopify.com':connection.SHOPIFY_DOMAIN},products:{nodes:[{id:'gid://shopify/Product/1',title:'Test Jersey',status:'DRAFT'}]}}});
 };
 const route=load('app/api/connections/shopify/route.ts',{'@/app/chatgpt-auth':{getChatGPTUser:async()=>owner?{userId:owner}:null},'@/lib/shopify-connection':connection});
 const post=(body,origin='https://studio.test')=>route.POST(new Request('https://studio.test/api/connections/shopify',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await post({action:'connect',clientSecret:secret},'https://evil.test')).status,403);assert.equal(requests,0);
 owner=null;assert.equal((await route.GET()).status,401);assert.equal((await post({action:'connect',clientSecret:secret})).status,401);owner='owner-a';
 assert.equal((await post({action:'connect',clientSecret:'x'.repeat(9000)})).status,413);assert.equal(requests,0);
 assert.equal((await (await route.GET()).json()).configured,false);
 const response=await post({action:'connect',clientSecret:secret}),body=await response.text();assert.equal(response.status,200);assert(!body.includes(secret));assert(!body.includes(token));
 const row=sqlite.prepare('SELECT * FROM shop_connections WHERE owner=?').get(owner);assert(!JSON.stringify(row).includes(secret));assert(!JSON.stringify(row).includes(token));assert.equal((await connection.unseal(owner,row.sealed_secret)).clientSecret,secret);
 await assert.rejects(()=>connection.unseal('owner-b',row.sealed_secret));
 const broken=JSON.parse(row.sealed_secret);broken.data=(broken.data[0]==='A'?'B':'A')+broken.data.slice(1);await assert.rejects(()=>connection.unseal(owner,JSON.stringify(broken)));
 const loaded=await route.GET(),loadedText=await loaded.text();assert(!loadedText.includes('sealed_secret'));assert(!loadedText.includes(secret));assert(!loadedText.includes(token));assert.equal(JSON.parse(loadedText).lastVerified.products[0].title,'Test Jersey');
 owner='owner-b';assert.equal((await (await route.GET()).json()).configured,false);assert.equal((await post({action:'verify'})).status,409);owner='owner-a';
 const before=requests;assert.equal((await post({action:'verify'})).status,200);assert.equal(requests,before+2,'Recheck obtains a fresh token using saved credentials');
 for(mode of ['rejected','no-scope','graphql-failed','wrong-store']){const failed=await post({action:'connect',clientSecret:secret});assert(failed.status>=400);const text=await failed.text();assert(!text.includes(secret));assert(!text.includes(token));assert.equal(sqlite.prepare('SELECT sealed_secret FROM shop_connections WHERE owner=?').get(owner).sealed_secret,row.sealed_secret,'Failed replacement preserves saved credentials');}
 const savedKey=env.CONNECTION_ENCRYPTION_KEY;env.CONNECTION_ENCRYPTION_KEY='';assert.equal((await post({action:'connect',clientSecret:secret})).status,503);env.CONNECTION_ENCRYPTION_KEY=savedKey;
 console.log('Passed: real AES encryption, tamper rejection, owner isolation, authentication, CSRF, body limit, secret redaction, fresh token exchange, product verification, and failed replacement preservation.');sqlite.close();
})().catch(error=>{console.error(error);process.exit(1);});
