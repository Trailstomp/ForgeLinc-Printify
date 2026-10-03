const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite'),{randomBytes}=require('node:crypto');
const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const db={prepare(query){const statement=sql.prepare(query);let args=[];return {bind(...v){args=v;return this;},async first(){return statement.get(...args)??null;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};},async batch(items){sql.exec('BEGIN');try{const r=[];for(const i of items)r.push(await i.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
let user=null;const env={DB:db,CONNECTION_ENCRYPTION_KEY:randomBytes(32).toString('hex')},cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(id=>{if(id.endsWith('printify-connection'))return {readPrintifyConnection:async()=>({sealed_secret:'synthetic'}),unsealPrintify:async()=>({token:'synthetic-printify-token',shopId:123})};if(id==='cloudflare:workers')return {env};if(id==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>user};if(id.startsWith('.')||id.startsWith('@/')){const dest=id.startsWith('@/')?path.resolve(id.slice(2)):path.resolve(path.dirname(file),id);return dest.endsWith('.json')?require(dest):load(dest+'.ts');}return require(id);},m,m.exports);return m.exports;}

(async()=>{
const access=load('lib/studio-access.ts'),catalog=load('lib/catalog.ts'),conn=load('lib/shopify-connection.ts'),checkout=load('lib/shopify-checkout.ts'),transfers=load('lib/printify-transfers.ts'),route=load('app/api/printify/drafts/route.ts');
const post=(body,origin='https://studio.test')=>route.POST(new Request('https://studio.test/api/printify/drafts',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)}));
let rawOrder,productWrites=0,uploads=0,orderReads=0,size='L',created=[];
const areas=['front','back','left_sleeve','right_sleeve','collar'].map(position=>({position,width:500,height:600}));
global.fetch=async(url,init)=>{
 const u=new URL(url);assert.equal(init.redirect,'manual');assert.equal(init.cache,'no-store');
 if(u.hostname===conn.SHOPIFY_DOMAIN){
  if(url.endsWith('/admin/oauth/access_token'))return Response.json({access_token:'synthetic-admin-token',scope:'write_products,read_orders'});
  const b=JSON.parse(init.body);if(b.query.startsWith('query ForgeLincInstalledPermissions'))return Response.json({data:{currentAppInstallation:{accessScopes:[{handle:'read_orders'},{handle:'write_products'}],app:{apiKey:conn.SHOPIFY_CLIENT_ID,requestedAccessScopes:[{handle:'read_orders'},{handle:'write_products'}]}}}});assert(b.query.startsWith('query ForgeLincPurchasedArtwork'));assert.equal(b.variables.id,rawOrder.id);orderReads++;return Response.json({data:{order:rawOrder}});
 }
 assert.equal(u.hostname,'api.printify.com');assert(!/orders|publish|payment/.test(u.pathname));
 if(u.pathname.endsWith('/blueprints.json'))return Response.json([{id:10,title:"Men's Sports Jersey (AOP)"}]);
 if(u.pathname.endsWith('/print_providers.json'))return Response.json([{id:20,title:'Miami Sublimation'}]);
 if(u.pathname.endsWith('/variants.json'))return Response.json({variants:[{id:30,title:size,options:{size},placeholders:areas}]});
 if(u.pathname.endsWith('/uploads/images.json')){uploads++;return Response.json({id:'image-'+uploads,width:500,height:600});}
 assert.equal(u.pathname,'/v1/shops/123/products.json');assert.equal(init.method,'POST');productWrites++;const payload=JSON.parse(init.body);created.push(payload);return Response.json({...payload,id:'product-'+productWrites,images:[]});
};
for(const identity of [null,{userId:'shopper'}]){user=identity;assert.equal((await post({action:'prepare-order',orderId:'x',lineId:'y'})).status,user?403:401);}assert.equal(orderReads,0);
user={userId:access.STUDIO_OWNER_ID};const owner=user.userId;
assert.equal((await post({action:'prepare-order',orderId:'x',lineId:'y'},'https://other.test')).status,403);
await conn.saveConnection(owner,await conn.seal(owner,{clientSecret:'synthetic-secret'}),{checkedAt:'now'});
const id=crypto.randomUUID(),team=catalog.teams.find(t=>t.id==='dayton-eagles');
const items=[{teamId:team.id,size:'L',quantity:1,config:{...catalog.defaultConfig,playerName:'GreyLax',playerNumber:'035'}},{teamId:team.id,size:'L',quantity:2,config:{...catalog.defaultConfig,jerseyTheme:'dark',shirtColor:'#101820',playerName:'Other',playerNumber:'00'}}];
const product={id:'gid://shopify/Product/9657946210548',variants:[{id:'gid://shopify/ProductVariant/100',size:'L',available:true}]},lines=checkout.cartLines(items,product,id,new Map([[team.id,team.name]]));
const snapshot={id,items,teams:items.map(()=>team),product,lines,result:{id,checkoutUrl:'https://example.test/checkout'}};
sql.prepare('INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?)').run(owner,'checkout:'+id,JSON.stringify(snapshot),'now');
const orderLines=items.map((item,i)=>({id:'gid://shopify/LineItem/'+(123+i),title:'Dayton Eagles',quantity:item.quantity,currentQuantity:item.quantity,unfulfilledQuantity:item.quantity,variant:{id:lines[i].merchandiseId},product:{id:product.id},customAttributes:lines[i].attributes,originalUnitPriceSet:{shopMoney:{amount:'37.53',currencyCode:'USD'}}}));
const order={id:'gid://shopify/Order/1234',name:'#1001',createdAt:'2026-09-13T00:00:00Z',test:false,cancelledAt:null,displayFinancialStatus:'PAID',displayFulfillmentStatus:'UNFULFILLED',customAttributes:[{key:'ForgeLinc checkout',value:id}],lineItems:{nodes:orderLines,pageInfo:{hasNextPage:false}}};rawOrder=structuredClone(order);
const prepare=async(i=0)=>post({action:'prepare-order',orderId:order.id,lineId:orderLines[i].id,config:{playerName:'Tampered'},price:1});
let response=await prepare();assert.equal(response.status,200,await response.clone().text());const first=(await response.json()).transfer;
assert.equal(first.snapshot.config.playerName,'GreyLax');assert.equal(first.snapshot.config.playerNumber,'035');assert.equal(first.snapshot.price,3753);assert.equal(first.snapshot.order.quantity,1);assert.equal(first.snapshot.variant.size,'L');
const second=(await (await prepare(1)).json()).transfer;assert.notEqual(first.id,second.id);assert.equal(second.snapshot.config.playerName,'Other');assert.equal(second.snapshot.config.playerNumber,'00');assert.equal(second.snapshot.order.quantity,2);assert.equal(second.snapshot.config.shirtColor,'#101820');assert.equal(await transfers.readTransfer(owner,undefined,team.id),null,'Order transfers do not replace the latest ordinary team draft');assert.equal((await (await prepare()).json()).transfer.id,first.id);
// Later studio edits cannot replace an order's immutable design.
sql.prepare('INSERT INTO drafts VALUES(?,?,?,?,?)').run(owner,catalog.draftKey(team.id),team.id,JSON.stringify({...items[0].config,playerName:'Changed'}),'now');
assert.equal((await (await prepare()).json()).transfer.snapshot.config.playerName,'GreyLax');
for(const patch of [{cancelledAt:'now'},{displayFinancialStatus:'PENDING'},{displayFinancialStatus:'REFUNDED'},{test:true},{displayFulfillmentStatus:'FULFILLED'}]){rawOrder={...order,...patch};assert.equal((await prepare()).status,409);}rawOrder=structuredClone(order);
for(const patch of [{quantity:2},{currentQuantity:0},{unfulfilledQuantity:0},{originalUnitPriceSet:{shopMoney:{amount:'37.53',currencyCode:'EUR'}}},{customAttributes:[]}]){rawOrder.lineItems.nodes[0]={...orderLines[0],...patch};assert.equal((await prepare()).status,409);}rawOrder=structuredClone(order);
size='XL';assert.equal((await prepare()).status,409);size='L';assert.equal(productWrites,0);
function png(){const b=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.write('IHDR',12);b.writeUInt32BE(500,16);b.writeUInt32BE(600,20);return b;}
for(const transfer of [first,second])for(const a of transfer.snapshot.variant.areas)await transfers.uploadPanel(owner,transfer.id,a.panel,png());assert.equal(uploads,10);
// Cancellation after rendering is checked again immediately before product creation.
rawOrder={...order,cancelledAt:'now'};assert.equal((await post({action:'create',id:first.id})).status,409);assert.equal(productWrites,0);rawOrder=structuredClone(order);
const results=await Promise.all([post({action:'create',id:first.id}),post({action:'create',id:first.id})]);assert(results.some(r=>r.status===200));assert.equal(productWrites,1);
assert.equal((await post({action:'create',id:first.id})).status,200);assert.equal(productWrites,1);
assert.equal((await post({action:'create',id:second.id})).status,200);assert.equal(productWrites,2);
for(let i=0;i<2;i++){const body=created[i];assert(body.title.includes(items[i].config.playerName));assert(body.title.includes('#'+items[i].config.playerNumber));assert.equal(body.variants[0].price,3753);assert.equal(body.variants[0].id,30);assert.equal(body.print_areas[0].placeholders.length,5);assert.equal(body.tags.length,3);}
assert.notEqual(created[0].tags[2],created[1].tags[2]);assert(orderReads>=10);
console.log('Order-to-Printify checks passed: owner/origin gates, immutable distinct designs and quantities, paid/order-change checks, exact purchased size and price, five panel uploads, final cancellation recheck, duplicate-create protection. Only product drafts created in the mock provider; no production/order/payment calls.');
})().catch(e=>{console.error(e);process.exit(1)});
