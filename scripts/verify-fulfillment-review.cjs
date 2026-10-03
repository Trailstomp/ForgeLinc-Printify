const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite'),{randomBytes}=require('node:crypto');
const sql=new DatabaseSync(':memory:');for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const db={prepare(query){const statement=sql.prepare(query);let args=[];return {bind(...v){args=v;return this;},async first(){return statement.get(...args)??null;},async all(){return {results:statement.all(...args)};},async run(){return statement.run(...args);}};},async batch(items){sql.exec('BEGIN');try{const r=[];for(const i of items)r.push(await i.run());sql.exec('COMMIT');return r;}catch(e){sql.exec('ROLLBACK');throw e;}}};
let user=null;const env={DB:db,CONNECTION_ENCRYPTION_KEY:randomBytes(32).toString('hex')},cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(id=>{if(id.endsWith('printify-connection'))return {readPrintifyConnection:async()=>({sealed_secret:'synthetic'}),unsealPrintify:async()=>({token:'synthetic-printify-token',shopId:123})};if(id==='cloudflare:workers')return {env};if(id==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>user};if(id.startsWith('.')||id.startsWith('@/')){const dest=id.startsWith('@/')?path.resolve(id.slice(2)):path.resolve(path.dirname(file),id);return dest.endsWith('.json')?require(dest):load(dest+'.ts');}return require(id);},m,m.exports);return m.exports;}

(async()=>{
const access=load('lib/studio-access.ts'),catalog=load('lib/catalog.ts'),conn=load('lib/shopify-connection.ts'),checkout=load('lib/shopify-checkout.ts'),transfers=load('lib/printify-transfers.ts'),orders=load('lib/shopify-orders.ts'),route=load('app/api/fulfillment/route.ts');
const get=(extra='')=>route.GET(new Request('https://studio.test/api/fulfillment?order='+encodeURIComponent('gid://shopify/Order/1234')+extra));
const post=(body,origin='https://studio.test')=>route.POST(new Request('https://studio.test/api/fulfillment',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}));
let rawOrder,remote,remoteStatus=200,providerReads=0;const products=new Map();
global.fetch=async(url,init)=>{
 const u=new URL(url);assert.equal(init.redirect,'manual');assert.equal(init.cache,'no-store');
 if(u.hostname===conn.SHOPIFY_DOMAIN){
  if(url.endsWith('/admin/oauth/access_token'))return Response.json({access_token:'synthetic-admin-token',scope:'write_products,read_orders'});
  const b=JSON.parse(init.body);assert(b.query.startsWith('query '));if(b.query.startsWith('query ForgeLincInstalledPermissions'))return Response.json({data:{currentAppInstallation:{accessScopes:[{handle:'read_orders'}],app:{apiKey:conn.SHOPIFY_CLIENT_ID,requestedAccessScopes:[{handle:'read_orders'}]}}}});assert.equal(b.variables.id,rawOrder.id);return Response.json({data:{order:rawOrder}});
 }
 assert.equal(u.hostname,'api.printify.com');assert.equal(init.method,'GET','Fulfillment review must never place, edit, cancel or submit a provider order');providerReads++;
 if(remoteStatus!==200)return Response.json({private:'Do not expose personal provider details'},{status:remoteStatus});
 if(u.pathname.endsWith('/orders.json'))return Response.json({data:remote?[remote]:[],next_page_url:remote?null:'https://api.printify.com/next'});
 if(u.pathname.includes('/orders/'))return Response.json(remote);
 const key=u.pathname.split('/').pop().replace('.json','');assert(products.has(key),key);return Response.json(products.get(key));
};
for(const identity of [null,{userId:'shopper'}]){user=identity;assert.equal((await get()).status,user?403:401);assert.equal((await post({})).status,user?403:401);}assert.equal(providerReads,0);
user={userId:access.STUDIO_OWNER_ID};const owner=user.userId;
assert.equal((await post({},'https://other.test')).status,403);
await conn.saveConnection(owner,await conn.seal(owner,{clientSecret:'synthetic-secret'}),{checkedAt:'now'});
const id=crypto.randomUUID(),team=catalog.teams.find(t=>t.id==='dayton-eagles');
const items=[{teamId:team.id,size:'L',quantity:1,config:{...catalog.defaultConfig,playerName:'GreyLax',playerNumber:'035'}},{teamId:team.id,size:'L',quantity:2,config:{...catalog.defaultConfig,jerseyTheme:'dark',shirtColor:'#101820',playerName:'Other',playerNumber:'00'}}];
const product={id:'gid://shopify/Product/9657946210548',variants:[{id:'gid://shopify/ProductVariant/100',size:'L',available:true}]},lines=checkout.cartLines(items,product,id,new Map([[team.id,team.name]]));
const snapshot={id,items,teams:items.map(()=>team),product,lines,result:{id,checkoutUrl:'https://example.test/checkout'}};
sql.prepare('INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?)').run(owner,'checkout:'+id,JSON.stringify(snapshot),'now');
const orderLines=items.map((item,i)=>({id:'gid://shopify/LineItem/'+(123+i),title:'Dayton Eagles',quantity:item.quantity,currentQuantity:item.quantity,unfulfilledQuantity:item.quantity,variant:{id:lines[i].merchandiseId},product:{id:product.id},customAttributes:lines[i].attributes,originalUnitPriceSet:{shopMoney:{amount:'37.53',currencyCode:'USD'}}}));
const order={id:'gid://shopify/Order/1234',name:'#1001',createdAt:'2026-09-13T00:00:00Z',test:false,cancelledAt:null,displayFinancialStatus:'PAID',displayFulfillmentStatus:'UNFULFILLED',customAttributes:[{key:'ForgeLinc checkout',value:id}],lineItems:{nodes:orderLines,pageInfo:{hasNextPage:false}}};rawOrder=structuredClone(order);
const pid='a'.repeat(24),lookup='&printifyOrder='+pid;
remote={id:pid,status:'on-hold',metadata:{order_type:'external',shop_order_id:1234,shop_order_label:'#1001'},line_items:[{product_id:'original-unpersonalized',variant_id:30,print_provider_id:20,quantity:3,status:'on-hold',metadata:{variant_label:'L'}}],address_to:{address1:'Synthetic private address',email:'private@example.test'},shipping_method:1,total_shipping:500,total_price:5000,total_tax:100};
let r=await get(),data=await r.json();assert.equal(r.status,200,JSON.stringify(data));assert.equal(data.ready,false);assert(data.lines.every(l=>l.issue.includes('Prepare')));
const rows=[];
for(let i=0;i<2;i++){
 const purchase=await orders.purchasedArtwork(owner,order.id,orderLines[i].id),variant={id:30,title:'L',size:'L',areas:catalog.panels.map(p=>({panel:p.id,position:p.id,width:500,height:600}))};
 const snapshot={teamId:team.id,team:purchase.artwork.team,config:purchase.artwork.config,shopId:123,catalog:{blueprint:{id:10,title:'Jersey'},provider:{id:20,title:'Miami'},variants:[variant]},variant,price:3753,order:purchase.order};
 const row={id:String(i+1).repeat(64),product_id:'product-'+i,snapshot:JSON.stringify(snapshot),uploads:JSON.stringify(Object.fromEntries(catalog.panels.map(p=>[p.id,{id:'image-'+i+'-'+p.id,width:500,height:600}]))),product:JSON.stringify({id:'product-'+i,title:'Prepared '+items[i].config.playerName,images:[]}),updated_at:'now'};
 rows.push(row);products.set(row.product_id,{id:row.product_id,...transfers.buildProduct(row.id,snapshot,JSON.parse(row.uploads))});
 sql.prepare('INSERT INTO printify_transfers(owner,id,team_id,snapshot,uploads,status,product_id,product,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(owner,row.id,team.id,row.snapshot,row.uploads,'created',row.product_id,row.product,'now');
}
data=await (await get()).json();assert.equal(data.ready,false);assert(data.issues.some(s=>s.includes('quantities')));
const correct=rows.map((row,i)=>({product_id:row.product_id,variant_id:30,print_provider_id:20,quantity:items[i].quantity,status:'on-hold',metadata:{variant_label:'L'}}));remote.line_items=structuredClone(correct);
data=await (await get(lookup)).json();assert.equal(data.ready,true,JSON.stringify(data));assert.equal(data.lines[0].artwork.config.playerNumber,'035');assert.equal(data.lines[1].artwork.config.playerNumber,'00');assert(!JSON.stringify(data).includes('private@example.test'));assert(!JSON.stringify(data).includes('Synthetic private address'));
const body={action:'approve-artwork',orderId:order.id,printifyOrderId:pid,fingerprint:data.fingerprint,confirmed:true};
assert.equal((await post({...body,confirmed:false})).status,400);assert.equal((await post(body)).status,200);let approved=await (await get()).json();assert(approved.reviewedAt);assert.equal((await post(body)).status,200);assert.equal((await (await get()).json()).reviewedAt,approved.reviewedAt);
assert.equal(sql.prepare("SELECT count(*) n FROM templates WHERE id LIKE 'fulfillment-review:%'").get().n,1);
assert(!JSON.stringify(sql.prepare("SELECT config FROM templates WHERE id LIKE 'fulfillment-review:%'").all()).includes('private@example.test'));
remote.address_to.address1='Changed delivery';assert.equal((await post(body)).status,409);assert.equal((await (await get(lookup)).json()).reviewedAt,null);remote.address_to.address1='Synthetic private address';
for(const list of [[{...correct[0],quantity:3}],[correct[0],correct[1],correct[0]],[{...correct[0],variant_id:31},correct[1]],[correct[0],{...correct[1],quantity:1}],[correct[0],{...correct[1],print_provider_id:21}]]){remote.line_items=list;assert.equal((await (await get(lookup)).json()).ready,false);assert.equal((await post(body)).status,409);}
remote.line_items=[correct[0],{...correct[1],quantity:1},{...correct[1],quantity:1}];assert.equal((await (await get(lookup)).json()).ready,true,'A split quantity is valid only when totals and distinct product IDs match');remote.line_items=structuredClone(correct);
const p=products.get('product-0');p.print_areas[0].placeholders[0].images[0].x=.4;assert.equal((await (await get(lookup)).json()).ready,false);assert.equal((await post(body)).status,409);p.print_areas[0].placeholders[0].images[0].x=.5;
for(const patch of [{cancelledAt:'now'},{displayFinancialStatus:'REFUNDED'},{displayFulfillmentStatus:'FULFILLED'},{test:true},{lineItems:{...order.lineItems,pageInfo:{hasNextPage:true}}}]){rawOrder={...order,...patch};const before=providerReads;const result=await (await get(lookup)).json();assert.equal(result.ready,false);assert(result.hold);assert.equal((await post(body)).status,409);if(patch.test)assert.equal(providerReads,before);}rawOrder=structuredClone(order);
remote.metadata.shop_order_id=999;assert.equal((await get(lookup)).status,409);remote.metadata.shop_order_id=1234;remote.metadata.order_type='manual';assert.equal((await get(lookup)).status,409);remote.metadata.order_type='external';
for(const status of ['in-production','fulfilled','canceled','payment-not-received']){remote.status=status;assert.equal((await (await get(lookup)).json()).ready,false);}remote.status='on-hold';
remote.line_items[0].status='in-production';assert.equal((await (await get(lookup)).json()).ready,false);remote.line_items[0].status='on-hold';
remoteStatus=403;r=await get(lookup);assert.equal(r.status,403);assert((await r.json()).error.includes('orders.read'));remoteStatus=500;r=await get(lookup);assert.equal(r.status,502);assert(!(await r.text()).includes('private'));remoteStatus=200;
sql.prepare("DELETE FROM templates WHERE id LIKE 'fulfillment-review:%'").run();remote=null;data=await (await get()).json();assert.equal(data.ready,false);assert.equal(data.nextSearchPage,2);assert(data.notice.includes('on this page'));
console.log('Fulfillment checks passed: owner/origin gates, distinct designs and quantities, original-order binding, changed panels/address invalidation, persistent approval, test/refund/cancel/production holds, sanitized responses, and no external writes.');
})().catch(e=>{console.error(e);process.exit(1)});
