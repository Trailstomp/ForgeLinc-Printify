const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite'),{randomBytes}=require('node:crypto');
const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const db={prepare(query){const statement=sql.prepare(query);let args=[];return {bind(...v){args=v;return this;},async first(){return statement.get(...args)??null;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};},async batch(items){sql.exec('BEGIN');try{const r=[];for(const i of items)r.push(await i.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
let user=null;const env={DB:db,CONNECTION_ENCRYPTION_KEY:randomBytes(32).toString('hex')},cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(id=>{if(id==='cloudflare:workers')return {env};if(id==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>user};if(id.startsWith('.')||id.startsWith('@/')){const dest=id.startsWith('@/')?path.resolve(id.slice(2)):path.resolve(path.dirname(file),id);return dest.endsWith('.json')?require(dest):load(dest+'.ts');}return require(id);},m,m.exports);return m.exports;}
(async()=>{
const access=load('lib/studio-access.ts'),catalog=load('lib/catalog.ts'),conn=load('lib/shopify-connection.ts'),checkout=load('lib/shopify-checkout.ts'),orders=load('lib/shopify-orders.ts'),route=load('app/api/shopify-orders/route.ts');
const get=(after='')=>route.GET(new Request('https://studio.test/api/shopify-orders'+after));
let mode='ok',queries=0,rawOrders=[],providerErrors=null;
global.fetch=async(url,init)=>{assert.equal(new URL(url).hostname,conn.SHOPIFY_DOMAIN);assert.equal(init.redirect,'manual');assert.equal(init.cache,'no-store');
 if(url.endsWith('/admin/oauth/access_token'))return Response.json({access_token:'synthetic-admin-token',scope:['no-scope','stale-token'].includes(mode)?'write_products':'write_products,read_orders'});
 assert(url.includes('/admin/api/'));const body=JSON.parse(init.body);assert(body.query.startsWith('query '));if(body.query.startsWith('query ForgeLincInstalledPermissions'))return Response.json({data:{currentAppInstallation:{accessScopes:(['no-scope','missing-installation'].includes(mode)?['write_products']:['write_products','read_orders']).map(handle=>({handle})),app:{apiKey:conn.SHOPIFY_CLIENT_ID,requestedAccessScopes:['write_products','read_orders'].map(handle=>({handle}))}}}});assert(!/customer|shippingAddress|email|mutation|paymentGateway/.test(body.query));queries++;assert(body.query.includes('orders(first:3,'),'Order pages must remain bounded');if(providerErrors)return Response.json({errors:providerErrors});
 if(mode==='access-denied')return Response.json({errors:[{extensions:{code:'ACCESS_DENIED'},message:'private provider detail'}]});
 return Response.json({data:{orders:{nodes:rawOrders,pageInfo:{hasNextPage:true,endCursor:'next-page'}}}});
};
for(const identity of [null,{userId:'shopper',email:'shopper@test'}]){user=identity;assert.equal((await get()).status,user?403:401);}assert.equal(queries,0);
user={userId:access.STUDIO_OWNER_ID,email:'owner@test'};const owner=user.userId;
await conn.saveConnection(owner,await conn.seal(owner,{clientSecret:'synthetic-secret'}),{checkedAt:'now'});
mode='no-scope';let denied=await get();assert.equal(denied.status,403);assert((await denied.json()).error.includes('read_orders'));assert.equal(queries,0);
mode='missing-installation';const grantDenied=await get(),grantBody=await grantDenied.json();assert.equal(grantDenied.status,403);assert.equal(grantBody.diagnosticCode,'installation_scope_missing');assert(grantBody.installation.requestedScopes.includes('read_orders'));assert(grantBody.installation.tokenScopes.includes('read_orders'));assert.equal(queries,0,'Token metadata never overrides missing installed grants');
mode='stale-token';assert.equal((await get()).status,200,'Installed grants allow the Shopify-authorized query despite older token metadata');
mode='access-denied';denied=await get();assert.equal(denied.status,403);assert(!(await denied.text()).includes('private provider detail'));mode='ok';
for(const [errors,status,code] of [
 [[{message:'Query cost is 1542, which exceeds the maximum cost of 1000',extensions:{code:'MAX_COST_EXCEEDED'}}],502,'query_limit'],
 [[{message:'private detail',extensions:{code:'THROTTLED'}}],429,'throttled'],
 [[{message:'This app is not approved to access protected customer data. private detail',extensions:{code:'ACCESS_DENIED'}}],403,'order_data_access'],
 [[{message:'Field does not exist private detail',extensions:{code:'undefinedField'}}],502,'query_error']
]){providerErrors=errors;const response=await get(),body=await response.json();assert.equal(response.status,status);assert.equal(body.diagnosticCode,code);assert.equal(body.needsOrderAccess,false);assert(body.grantedScopes.includes('read_orders'));assert(!JSON.stringify(body).includes('private detail'));}providerErrors=null;
const id=crypto.randomUUID(),item={teamId:'dayton-eagles',size:'L',quantity:1,config:{...catalog.defaultConfig,playerName:'GreyLax',playerNumber:'035'}},team=catalog.teams.find(t=>t.id===item.teamId);
const product={id:'gid://shopify/Product/9657946210548',variants:[{id:'gid://shopify/ProductVariant/100',size:'L',available:true}]},lines=checkout.cartLines([item],product,id,new Map([[team.id,team.name]]));
const snapshot={id,items:[item],teams:[team],product,lines,result:{id,checkoutUrl:'https://example.test/checkout'}};
sql.prepare('INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?)').run(owner,'checkout:'+id,JSON.stringify(snapshot),'now');
const line={id:'gid://shopify/LineItem/123',title:'Dayton Eagles',quantity:1,currentQuantity:1,unfulfilledQuantity:1,variant:{id:lines[0].merchandiseId},product:{id:product.id},customAttributes:lines[0].attributes};
const order={id:'gid://shopify/Order/1234',name:'#1001',createdAt:'2026-09-13T00:00:00Z',test:false,cancelledAt:null,displayFinancialStatus:'PAID',displayFulfillmentStatus:'UNFULFILLED',customAttributes:[{key:'ForgeLinc checkout',value:id}],lineItems:{nodes:[line],pageInfo:{hasNextPage:false}}};
rawOrders=[order];let r=await get(),data=await r.json();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(data.nextCursor,'next-page');assert.equal(data.orders[0].hold,null);assert.equal(data.orders[0].lines[0].artwork.config.playerNumber,'035');assert.equal(data.orders[0].url,'https://admin.shopify.com/store/eewwjf-tt/orders/1234');
// Editing the current team template or editable draft must not change checkout artwork.
sql.prepare('INSERT INTO drafts VALUES(?,?,?,?,?)').run(owner,catalog.draftKey(item.teamId),item.teamId,JSON.stringify({...item.config,playerName:'Changed',playerNumber:'9'}),'now');
assert.equal((await orders.matchOrderLine(owner,order,line)).artwork.config.playerName,'GreyLax');
for(const changed of [
 {...line,quantity:2},{...line,currentQuantity:0},{...line,unfulfilledQuantity:0},
 {...line,variant:{id:'gid://shopify/ProductVariant/999'}},{...line,product:{id:'gid://shopify/Product/999'}},
 {...line,customAttributes:line.customAttributes.filter(a=>a.key!=='_ForgeLinc design')},
 {...line,customAttributes:line.customAttributes.map(a=>a.key==='Player number'?{...a,value:'36'}:a)},
 {...line,customAttributes:[...line.customAttributes,{key:'Player name',value:'Another'}]}
]){const match=await orders.matchOrderLine(owner,order,changed);assert(match.issue);assert.equal(match.artwork,null);}
assert((await orders.matchOrderLine('different-owner',order,line)).issue);
assert((await orders.matchOrderLine(owner,{...order,customAttributes:[]},line)).issue);
assert((await orders.matchOrderLine(owner,{...order,lineItems:{...order.lineItems,nodes:[line,{...line,id:'other'}]}},line)).issue);
for(const patch of [{cancelledAt:'now'},{displayFinancialStatus:'PENDING'},{displayFinancialStatus:'REFUNDED'},{displayFulfillmentStatus:'FULFILLED'},{test:true},{lineItems:{...order.lineItems,pageInfo:{hasNextPage:true}}}]){rawOrders=[{...order,...patch}];assert((await (await get()).json()).orders[0].hold);}
rawOrders=[{...order,lineItems:{...order.lineItems,nodes:[{...line,product:{id:'gid://shopify/Product/999'},customAttributes:[]}]}}];assert.equal((await (await get()).json()).orders.length,0);
assert.equal((await get('?after='+('x'.repeat(1001)))).status,400);
assert.equal(sql.prepare("SELECT count(*) n FROM templates").get().n,1,'Order review never writes snapshots or provider orders');
console.log('Order review passed: owner gate, required scope, sanitized errors, exact immutable artwork, leading-zero number, pagination, changed/duplicate/missing references, quantities, cancelled/refunded/test/fulfilled holds. Read-only Shopify queries; no production actions.');
})().catch(e=>{console.error(e);process.exit(1)});
