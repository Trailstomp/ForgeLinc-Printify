// Real application functions + all migrations, with synthetic provider responses.
// This test cannot contact Shopify or Printify or charge a payment method.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript'),{DatabaseSync}=require('node:sqlite'),{randomBytes}=require('node:crypto');
const sql=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sql.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const db={prepare(query){const s=sql.prepare(query);let args=[];return {bind(...v){args=v;return this;},async first(){return s.get(...args)??null;},async all(){return {results:s.all(...args)};},async run(){return s.run(...args);}};},async batch(items){sql.exec('BEGIN');try{const results=[];for(const item of items)results.push(await item.run());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}}};
const env={DB:db,CONNECTION_ENCRYPTION_KEY:randomBytes(32).toString('hex'),FORGELINC_PRIVATE_AUTOMATION:'enabled'},cache=new Map();let user;
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);new Function('require','module','exports',ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(id=>{if(id==='cloudflare:workers')return {env};if(id==='@/app/chatgpt-auth')return {getChatGPTUser:async()=>user};if(id.startsWith('.')||id.startsWith('@/')){const dest=id.startsWith('@/')?path.resolve(id.slice(2)):path.resolve(path.dirname(file),id);return dest.endsWith('.json')?require(dest):load(dest+'.ts');}return require(id);},m,m.exports);return m.exports;}
const areas=[{position:'front',width:500,height:600},{position:'back',width:500,height:600},{position:'left_sleeve',width:400,height:200},{position:'right_sleeve',width:400,height:200},{position:'collar',width:400,height:40}];
const png=a=>{const b=new Uint8Array(33);b.set([137,80,78,71,13,10,26,10]);b.set([73,72,68,82],12);new DataView(b.buffer).setUint32(16,a.width);new DataView(b.buffer).setUint32(20,a.height);return b;};
(async()=>{
 const cat=load('lib/catalog.ts'),conn=load('lib/shopify-connection.ts'),pfconn=load('lib/printify-connection.ts'),transfers=load('lib/printify-transfers.ts'),catalog=load('lib/checkout-catalog.ts'),checkout=load('lib/prepared-checkout.ts'),fulfillment=load('lib/automatic-fulfillment.ts'),route=load('app/api/checkout/route.ts'),automation=load('app/api/automation/checkout/route.ts');
 user={userId:load('lib/studio-access.ts').STUDIO_OWNER_ID};const owner=user.userId;
 await conn.saveConnection(owner,await conn.seal(owner,{clientSecret:'synthetic-secret'}),{checkedAt:'now'});
 sql.prepare('INSERT INTO shop_connections VALUES(?,?,?,?,?)').run(owner,'printify',await pfconn.sealPrintify(owner,{token:'synthetic-printify',shopId:123}),'{}','now');
 sql.prepare('INSERT INTO shop_connections VALUES(?,?,?,?,?)').run(owner,'shopify-storefront',await conn.seal(owner+':storefront',{clientSecret:'synthetic-storefront'}),'{}','now');
 let product=null,publicationCalls=0,cartCalls=0,productCalls=0,uploadCalls=0,orderCalls=0,releaseCalls=0,mode='ok',currentOrder=null,nextOrder=1000,providerSizes=['L','XXL'];const products=new Map(),orders=new Map();let lastCartInput;
 global.fetch=async(url,init)=>{
  const u=new URL(url);assert.equal(init.redirect,'manual');assert.equal(init.cache,'no-store');const b=typeof init.body==='string'&&init.body.startsWith('{')?JSON.parse(init.body):null;
  if(u.hostname===conn.SHOPIFY_DOMAIN){
   if(url.endsWith('/admin/oauth/access_token'))return Response.json({access_token:'synthetic-admin',scope:'read_orders,write_products,read_publications,write_publications'});
   if(b.query.includes('ForgeLincInstalledPermissions'))return Response.json({data:{currentAppInstallation:{accessScopes:[{handle:'read_orders'}],app:{apiKey:conn.SHOPIFY_CLIENT_ID,requestedAccessScopes:[{handle:'read_orders'}]}}}});
   if(b.query.includes('ForgeLincCheckoutPermissions'))return Response.json({data:{currentAppInstallation:{accessScopes:[{handle:'read_orders'},{handle:'write_products'},{handle:'write_publications'}]}}});
   if(b.query.includes('ForgeLincCheckoutLookup'))return Response.json({data:{products:{nodes:product?[product]:[]}}});
   if(b.query.includes('ForgeLincSetupCheckout')){const input=b.variables.input;assert(input.variants.every(v=>v.inventoryItem.sku.startsWith('FORGELINC-CUSTOM-')));product={...input,id:input.id??'gid://shopify/Product/10000',variants:{nodes:input.variants.map((v,i)=>({...v,id:v.id??'gid://shopify/ProductVariant/'+(100+i),title:v.optionValues[0].name,selectedOptions:v.optionValues.map(o=>({name:o.optionName,value:o.name}))})),pageInfo:{hasNextPage:false}}};return Response.json({data:{productSet:{product,userErrors:[]}}});}
   if(b.query.includes('ForgeLincCheckoutChannels'))return Response.json({data:{publications:{nodes:[{id:'gid://shopify/Publication/10',name:'Headless'}]}}});
   if(b.query.includes('ForgeLincCheckoutPublish')){publicationCalls++;return Response.json({data:{publishablePublish:{userErrors:[]}}});}
   if(b.query.includes('ForgeLincCustomCatalog'))return Response.json({data:{product}});
   if(b.query.includes('ForgeLincPreparedProduct'))return Response.json({data:{product:{...product,onlineStoreUrl:null,variants:{nodes:product.variants.nodes.map(v=>({...v,availableForSale:mode!=='sold-out',price:{amount:v.price,currencyCode:'USD'}})),pageInfo:{hasNextPage:false}}}}});
   if(b.query.includes('ForgeLincCheckoutOrderAccess')){if(mode==='no-address-access')return Response.json({errors:[{message:'protected customer data is not approved',extensions:{code:'ACCESS_DENIED'}}]});return Response.json({data:{orders:{nodes:[]}}});}
   if(b.query.includes('ForgeLincPreparedCheckout')){cartCalls++;lastCartInput=structuredClone(b.variables.input);return Response.json({data:{cartCreate:{cart:{checkoutUrl:'https://eewwjf-tt.myshopify.com/checkouts/test-'+cartCalls,lines:{nodes:lastCartInput.lines.map(l=>({quantity:l.quantity,merchandise:{id:l.merchandiseId},attributes:mode==='lost-attributes'?[]:l.attributes}))}},userErrors:[],warnings:[]}}});}
   if(b.query.includes('ForgeLincPaidDesign'))return Response.json({data:{order:structuredClone(currentOrder)}});
   if(b.query.includes('ForgeLincPaidCheckouts'))return Response.json({data:{orders:{nodes:currentOrder?[structuredClone(currentOrder)]:[],pageInfo:{hasNextPage:false,endCursor:null}}}});
   throw new Error('Unexpected synthetic Shopify operation');
  }
  assert.equal(u.hostname,'api.printify.com');assert.equal(init.headers.Authorization,'Bearer synthetic-printify');assert(!url.includes('/publish'));
  if(url.endsWith('/blueprints.json'))return Response.json([{id:10,title:"Men's Sports Jersey (AOP)"}]);
  if(url.endsWith('/print_providers.json'))return Response.json([{id:20,title:'Miami Sublimation'}]);
  if(url.endsWith('/variants.json'))return Response.json({variants:providerSizes.map((size,i)=>({id:30+i,title:'White / '+size,options:{size},placeholders:areas}))});
  if(url.endsWith('/uploads/images.json')){uploadCalls++;const bytes=Buffer.from(b.contents,'base64');return Response.json({id:'image-'+uploadCalls,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)});}
  if(u.pathname.endsWith('/products.json')&&init.method==='POST'){productCalls++;const p={...b,id:'product-'+productCalls,images:[]};products.set(p.id,p);return Response.json(p);}
  if(/\/products\/[^/]+\.json$/.test(u.pathname)){const id=u.pathname.split('/').pop().replace('.json',''),remote=structuredClone(products.get(id));for(const panel of remote.print_areas[0].placeholders)if(['front','back'].includes(panel.position)&&panel.images[0].y===.5)panel.images[0].y=.5000000000000001;remote.print_areas[0].placeholders.push({position:'all',decoration_method:'aop',images:[]});return Response.json(remote);}
  if(u.pathname.endsWith('/orders.json')&&init.method==='GET')return Response.json({data:[...orders.values()],next_page_url:null});
  if(u.pathname.endsWith('/orders.json')&&init.method==='POST'){
   orderCalls++;assert.equal(currentOrder.displayFinancialStatus,'PAID');assert(!currentOrder.test);assert(b.line_items.every(l=>products.has(l.product_id)));
   const p={id:'remote-order-'+orderCalls,status:'on-hold',address_to:b.address_to,metadata:{order_type:'api',shop_order_id:b.external_id},line_items:b.line_items.map(l=>({...l,print_provider_id:20,status:'on-hold'}))};orders.set(p.id,p);
   if(mode==='order-timeout')throw new Error('Synthetic lost response');return Response.json(p);
  }
  if(u.pathname.endsWith('/send_to_production.json')){releaseCalls++;const id=u.pathname.split('/').at(-2),p=orders.get(id);p.status='sending-to-production';p.line_items.forEach(l=>l.status='sending-to-production');if(mode==='release-timeout')throw new Error('Synthetic lost production response');return new Response(null,{status:204});}
  if(/\/orders\/[^/]+\.json$/.test(u.pathname))return Response.json(orders.get(u.pathname.split('/').pop().replace('.json','')));
  throw new Error('Unexpected synthetic Printify operation');
 };
 // Existing auth and same-origin restrictions continue to apply.
 const post=(body,origin='https://studio.test')=>route.POST(new Request('https://studio.test/api/checkout',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)}));
 assert.equal((await post({action:'process'},'https://other.test')).status,403);
 user=null;assert.equal((await post({action:'process'})).status,401);user={userId:'other'};assert.equal((await post({action:'process'})).status,403);user={userId:owner};
 env.FORGELINC_PRIVATE_AUTOMATION='disabled';assert.equal((await automation.POST(new Request('https://studio.test/api/automation/checkout',{method:'POST',headers:{'content-type':'application/json'},body:'{"action":"status"}'}))).status,403);env.FORGELINC_PRIVATE_AUTOMATION='enabled';
 await fulfillment.processPaidCheckouts(owner);assert((await fulfillment.fulfillmentLastRun(owner)).completedAt);assert.equal(orderCalls,0);
 // One shared checkout product gains provider sizes; 2XL and XXL are the same mapping.
 const setup=await catalog.setupCustomCatalog(owner,'55.00');assert(setup.ready);assert.deepEqual(setup.product.variants.map(v=>v.size),['L','2XL']);assert.equal(publicationCalls,1);
 const existingIds=product.variants.nodes.map(v=>v.id);await catalog.setupCustomCatalog(owner);assert.deepEqual(product.variants.nodes.map(v=>v.id),existingIds);
 const customId='custom-team-'+crypto.randomUUID();sql.prepare('INSERT INTO templates VALUES(?,?,?,?)').run(owner,'team-definition:'+customId,JSON.stringify({id:customId,name:'Tournament Team',kind:'team',primary:'#123456',accent:'#abcdef',logoAssetId:null,backAssetId:null}),'now');
 const config={...cat.defaultConfig,playerName:'Hopkins',playerNumber:'35',jerseyTheme:'custom:'+crypto.randomUUID(),themeName:'Tournament',accent:'#15ab32',stripeStyle:'lightning',artwork:{}};
 const item={teamId:'dayton-bombers',size:'2XL',quantity:1,config};assert(cat.teams.some(t=>t.id===item.teamId));
 for(const team of cat.teams){const p=await checkout.prepareCheckout(owner,{id:crypto.randomUUID(),items:[{...item,teamId:team.id}]});assert.equal(p.transfers[0].snapshot.team.id,team.id);assert.equal(p.transfers[0].snapshot.variant.id,31);}
 const request={id:crypto.randomUUID(),items:[item,{...item,teamId:'dayton-eagles',config:{...config,playerName:'Taylor',playerNumber:'7'}},{...item,teamId:customId,config:{...config,playerName:'Morgan'}}]};
 let prepared=await checkout.prepareCheckout(owner,request);const recovered=await route.GET(new Request('https://studio.test/api/checkout?resume='+request.id));assert.equal(recovered.status,200);assert.deepEqual((await recovered.json()).items.map(i=>i.config.playerName),['Hopkins','Taylor','Morgan']);assert.equal((await route.GET(new Request('https://studio.test/api/checkout?resume='+crypto.randomUUID()))).status,404);assert.equal(prepared.transfers.length,3);assert.equal(new Set(prepared.transfers.map(t=>t.id)).size,3);assert(prepared.transfers.every(t=>t.snapshot.variant.size==='XXL'));assert(prepared.transfers.every(t=>t.snapshot.config.stripeStyle==='lightning'));assert.equal(prepared.transfers[0].snapshot.teamId,'dayton-bombers');
 assert.deepEqual((await checkout.prepareCheckout(owner,{...request,items:request.items.map(i=>({...i,size:'XXL'}))})).transfers.map(t=>t.id),prepared.transfers.map(t=>t.id));
 await assert.rejects(checkout.prepareCheckout(owner,{...request,items:[{...item,quantity:2}]}));
 await assert.rejects(checkout.prepareCheckout(owner,{id:crypto.randomUUID(),items:[{...item,size:'5XL'}]}));
 await assert.rejects(checkout.prepareCheckout(owner,{id:crypto.randomUUID(),items:[{...item,teamId:'unknown-team'}]}));
 await assert.rejects(checkout.prepareCheckout(owner,{id:crypto.randomUUID(),items:[{...item,config:{...config,stripeAssetId:crypto.randomUUID(),stripeStyle:'custom'}}]}));
 assert.equal(cartCalls,0);await assert.rejects(checkout.completePreparedCheckout(owner,request.id));assert.equal(cartCalls,0);
 // Upload all five specific panels for each distinct design and size.
 async function uploadAll(p){for(const t of p.transfers){for(const area of t.snapshot.variant.areas)await transfers.uploadPanel(owner,t.id,area.panel,png(area));await transfers.createProduct(owner,t.id);}}
 await uploadAll(prepared);assert.equal(uploadCalls,15);assert.equal(productCalls,3);assert.equal(orderCalls,0);
 // Live Printify returns a sixth, empty 'all' slot. Every real panel must still match.
 const review=load('lib/fulfillment-review.ts'),sample=prepared.transfers[0],sampleRow=sql.prepare('SELECT * FROM printify_transfers WHERE id=?').get(sample.id),actual=structuredClone(products.get('product-1'));
 actual.print_areas[0].variant_ids=[30,31];actual.print_areas[0].placeholders.reverse();actual.print_areas[0].placeholders.push({position:'all',decoration_method:'aop',images:[]});
 assert(review.productMatches(actual,sampleRow,sample.snapshot),'Empty provider aggregate is valid');
 // Observed on the live OH10 XL: coordinates differ only by floating-point serialization.
 for(const field of ['x','y','scale','angle']){
  const rounded=structuredClone(actual),image=rounded.print_areas[0].placeholders[0].images[0];image[field]+=Number.EPSILON;
  assert(review.productMatches(rounded,sampleRow,sample.snapshot),'Provider round-off is valid: '+field);
  for(const value of [image[field]+1e-8,String(image[field]),null,NaN,Infinity]){const changed=structuredClone(actual);changed.print_areas[0].placeholders[0].images[0][field]=value;assert(!review.productMatches(changed,sampleRow,sample.snapshot),'Changed/invalid placement must block: '+field);}
 }
 for(const mutation of [p=>p.print_areas[0].placeholders.at(-1).images.push({id:'other-art'}),p=>p.print_areas[0].placeholders.at(-1).position='unknown',p=>p.print_areas[0].placeholders.push({position:'all',images:[]}),p=>p.print_areas[0].placeholders[0].images[0].x=.4,p=>p.print_areas[0].placeholders[0].images[0].id='other',p=>p.print_areas[0].placeholders.splice(0,1)]){const altered=structuredClone(actual);mutation(altered);assert(!review.productMatches(altered,sampleRow,sample.snapshot),'Altered or missing artwork must block checkout');}
 const inspection=await checkout.inspectPreparedCheckout(owner,request.id);assert(inspection.items.every(i=>i.matches));assert.equal(inspection.checkoutCreated,false);assert.equal(cartCalls,0);assert.equal(orderCalls,0);
 const first=products.get('product-1'),originalImage=first.print_areas[0].placeholders[0].images[0].id;first.print_areas[0].placeholders[0].images[0].id='default-eagles-panel';await assert.rejects(checkout.completePreparedCheckout(owner,request.id));assert.equal(cartCalls,0);first.print_areas[0].placeholders[0].images[0].id=originalImage;
 mode='no-address-access';await assert.rejects(checkout.completePreparedCheckout(owner,request.id),e=>e.message.includes('protected'));assert.equal(cartCalls,0);mode='ok';
 const result=await checkout.completePreparedCheckout(owner,request.id);assert.equal(cartCalls,1);assert.equal(lastCartInput.lines.length,3);assert.equal(new Set(lastCartInput.lines.map(l=>l.attributes.find(a=>a.key==='_ForgeLinc design').value)).size,3);assert.equal(orderCalls,0);
 assert.equal((await checkout.completePreparedCheckout(owner,request.id)).checkoutUrl,result.checkoutUrl);assert.equal(cartCalls,1);
 const snapshot=await checkout.readPreparedCheckout(owner,request.id);
 function orderFor(s){return {id:'gid://shopify/Order/'+(++nextOrder),name:'#'+nextOrder,createdAt:new Date().toISOString(),test:false,cancelledAt:null,displayFinancialStatus:'PAID',displayFulfillmentStatus:'UNFULFILLED',email:'buyer@example.test',phone:null,shippingAddress:{firstName:'Test',lastName:'Buyer',address1:'1 Example St',address2:null,city:'Dayton',provinceCode:'OH',countryCodeV2:'US',zip:'45402',phone:null},customAttributes:[{key:'ForgeLinc checkout',value:s.id},{key:'ForgeLinc fulfillment',value:'automated-v2'}],lineItems:{nodes:s.lines.map((l,i)=>({id:'gid://shopify/LineItem/'+(nextOrder*10+i),quantity:l.quantity,currentQuantity:l.quantity,unfulfilledQuantity:l.quantity,variant:{id:l.merchandiseId},product:{id:s.product.id},customAttributes:structuredClone(l.attributes)})),pageInfo:{hasNextPage:false}}};}
 // Orders are read back server-side; client payment flags cannot submit a shirt.
 for(const patch of [{displayFinancialStatus:'PENDING'},{test:true},{cancelledAt:'now'},{displayFinancialStatus:'PARTIALLY_REFUNDED'}]){currentOrder={...orderFor(snapshot),...patch};assert.equal((await fulfillment.submitPaidOrder(owner,currentOrder)).state,'blocked');}
 currentOrder=orderFor(snapshot);currentOrder.lineItems.nodes[0].quantity++;assert.equal((await fulfillment.submitPaidOrder(owner,currentOrder)).state,'blocked');assert.equal(orderCalls,0);
 currentOrder=orderFor(snapshot);const native={id:'native-import',metadata:{order_type:'external',shop_order_id:currentOrder.id.split('/').pop()},line_items:[]};orders.set(native.id,native);assert.equal((await fulfillment.submitPaidOrder(owner,currentOrder)).state,'blocked');orders.delete(native.id);assert.equal(orderCalls,0);
 // Concurrent requests create one provider order and one production request.
 currentOrder=orderFor(snapshot);await Promise.all([fulfillment.submitPaidOrder(owner,currentOrder),fulfillment.submitPaidOrder(owner,currentOrder)]);assert.equal(orderCalls,1);assert.equal(releaseCalls,1);await fulfillment.submitPaidOrder(owner,currentOrder);assert.equal(orderCalls,1);assert.equal(releaseCalls,1);
 assert.deepEqual(orders.get('remote-order-1').line_items.map(l=>l.product_id),['product-1','product-2','product-3']);assert(orders.get('remote-order-1').line_items.every(l=>l.variant_id===31));
 // Lost create response reconciles by the unique external ID, without a second order.
 currentOrder=orderFor(snapshot);mode='order-timeout';assert.equal((await fulfillment.submitPaidOrder(owner,currentOrder)).state,'uncertain');assert.equal(orderCalls,2);mode='ok';assert.equal((await fulfillment.submitPaidOrder(owner,currentOrder)).state,'submitted');assert.equal(orderCalls,2);assert.equal(releaseCalls,2);
 // Lost production response is read back; it never creates or submits twice.
 currentOrder=orderFor(snapshot);mode='release-timeout';assert.equal((await fulfillment.submitPaidOrder(owner,currentOrder)).state,'release_uncertain');mode='ok';assert.equal((await fulfillment.submitPaidOrder(owner,currentOrder)).state,'submitted');assert.equal(orderCalls,3);assert.equal(releaseCalls,3);
 // An address edited while Printify prepares is held before charging production.
 currentOrder=orderFor(snapshot);mode='order-timeout';await fulfillment.submitPaidOrder(owner,currentOrder);mode='ok';currentOrder.shippingAddress.address1='2 Changed St';assert.equal((await fulfillment.submitPaidOrder(owner,currentOrder)).state,'blocked');assert.equal(orderCalls,4);assert.equal(releaseCalls,3);
 // Same artwork bought as separate lines is combined for exact quantity checking.
 const repeated={id:crypto.randomUUID(),items:[item,{...item,quantity:2}]};const repeatPrepared=await checkout.prepareCheckout(owner,repeated);assert.equal(repeatPrepared.transfers[0].id,repeatPrepared.transfers[1].id);await checkout.completePreparedCheckout(owner,repeated.id);currentOrder=orderFor(await checkout.readPreparedCheckout(owner,repeated.id));assert.equal((await fulfillment.submitPaidOrder(owner,currentOrder)).state,'submitted');assert.equal(releaseCalls,4);
 await fulfillment.processPaidCheckouts(owner);assert((await fulfillment.fulfillmentLastRun(owner)).completedAt);
 const output=JSON.stringify(await fulfillment.fulfillmentStatus(owner));assert(!output.includes('synthetic-'));assert(!output.includes('Example St'));assert(!output.includes('buyer@example'));
 console.log('Prepared checkout passed: all teams + custom team, 2XL/XXL mapping, exact five-panel products, separate designs, unavailable/missing artwork holds, order-data preflight, immutable checkout, auth/CSRF, paid-only submission, duplicate imports, concurrency, timeout reconciliation, address changes, production release and private status. All provider requests were synthetic.');
})().catch(e=>{console.error(e);process.exitCode=1;});
