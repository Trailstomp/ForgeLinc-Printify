// Exercise the real Workers fetch implementation, including redirect handling.
// All outbound traffic is intercepted; these are synthetic credentials only.
const assert=require('node:assert/strict'),fs=require('node:fs'),{createRequire}=require('node:module'),ts=require('typescript');
const {Miniflare}=createRequire(require.resolve('wrangler/package.json'))('miniflare');
(async()=>{
 const source=fs.readFileSync('lib/shopify-connection.ts','utf8').replace(/^import .*;\n/gm,'').replace(/^export /gm,'');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
 let mode='ok',calls=[];
 const secret='synthetic-worker-secret',token='synthetic-worker-token';
 const mf=new Miniflare({modules:true,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  script:compiled+`\nexport default {async fetch(){try{return Response.json(await verifyShopify('${secret}'));}catch(e){return Response.json({error:e.message},{status:e.status||500});}}};`,
  outboundService:async request=>{
   const url=new URL(request.url);calls.push(url.pathname);
   assert.equal(url.host,'eewwjf-tt.myshopify.com');assert.equal(request.method,'POST');
   const isToken=url.pathname==='/admin/oauth/access_token';
   if(isToken){const body=new URLSearchParams(await request.text());assert.equal(body.get('client_secret'),secret);assert.equal(body.get('grant_type'),'client_credentials');}
   else {assert.equal(url.pathname,'/admin/api/2026-07/graphql.json');assert.equal(request.headers.get('X-Shopify-Access-Token'),token);}
   if((isToken&&mode==='token-redirect')||(!isToken&&mode==='product-redirect'))return new Response(null,{status:307,headers:{Location:'https://unexpected.example/credential-trap'}});
   return Response.json(isToken?{access_token:token,scope:'write_products'}:{data:{shop:{name:'LincWerks',myshopifyDomain:'eewwjf-tt.myshopify.com'},products:{nodes:[]}}});
  }});
 try{
  let response=await mf.dispatchFetch('http://localhost/check');assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).productAccess,true);assert.equal(calls.length,2);
  for(mode of ['token-redirect','product-redirect']){calls=[];response=await mf.dispatchFetch('http://localhost/check');assert.equal(response.status,502);const body=await response.text();assert.match(body,/redirected/);assert(!body.includes(secret));assert(!body.includes(token));assert.equal(calls.length,mode==='token-redirect'?1:2,'Redirect must never forward credentials or continue verification');}
  console.log('Passed: native Workers token exchange and product read; token and API redirects rejected without forwarding credentials.');
 }finally{await mf.dispose();}
})().catch(error=>{console.error(error);process.exitCode=1;});
