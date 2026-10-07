const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const moduleUnderTest={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/api-client.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(moduleUnderTest,moduleUnderTest.exports);
const {apiFetch,readApiJson,ApiResponseError}=moduleUnderTest.exports;
(async()=>{
 const realFetch=global.fetch;let calls=0;
 try{
  for(const response of [new Response('<!DOCTYPE html>Gateway failure',{status:502,headers:{'content-type':'text/html'}}),new Response('<!DOCTYPE html>Unexpected page'),new Response('truncated'),Response.json(null)]){
   await assert.rejects(readApiJson(response),e=>e instanceof ApiResponseError&&!e.message.includes('Unexpected token')&&!e.message.includes('<!DOCTYPE'));
  }
  for(const response of [Response.json({error:'Expired'},{status:401}),new Response('',{status:302}),{status:0,type:'opaqueredirect'},new Response('<!DOCTYPE html><a href="/signin-with-chatgpt">Continue with ChatGPT</a>')]){
   await assert.rejects(readApiJson(response),e=>e instanceof ApiResponseError&&e.signInRequired);
  }
  await assert.rejects(readApiJson(Response.json({error:'Printify’s artwork differs from your saved design.'},{status:409})),/artwork differs/);
  assert.deepEqual(await readApiJson(Response.json({error:'Needs order access',diagnosticCode:'access_denied'},{status:403}),true),{error:'Needs order access',diagnosticCode:'access_denied'});
  assert.deepEqual(await readApiJson(Response.json({transfer:{id:'saved-transfer'}})),{transfer:{id:'saved-transfer'}});
  global.fetch=async(path,init)=>{calls++;assert.equal(path,'/api/checkout');assert.equal(init.method,'POST');assert.equal(init.body,'{"action":"checkout"}');assert.equal(init.headers.get('accept'),'application/json');assert.equal(init.headers.get('content-type'),'application/json');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'same-origin');assert.equal(init.cache,'no-store');return new Response('<!DOCTYPE html>Unavailable',{status:502});};
  await assert.rejects(readApiJson(await apiFetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"action":"checkout"}'})),ApiResponseError);
  assert.equal(calls,1,'Never replay a product, order or checkout write after an uncertain response');
  console.log('API response regression checks passed: HTML, expired sessions, redirects, invalid JSON, real server errors, preserved JSON, explicit credentials and no replay of writes.');
 }finally{global.fetch=realFetch;}
})().catch(e=>{console.error(e);process.exitCode=1;});
