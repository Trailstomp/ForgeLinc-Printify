const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
class Element{
 constructor(){this.children=[];this.dataset={};this.value='';this.listeners={};this.disabled=false;this.textContent='';}
 get options(){return this.children;}get selectedOptions(){return this.children.filter(c=>c.value===this.value);}
 replaceChildren(){this.children=[];this.value='';}append(c){this.children.push(c);if(this.children.length===1)this.value=c.value;}
 addEventListener(name,fn){this.listeners[name]=fn;}setAttribute(){}
}
let Selector,payload,location;const elements=new Map();for(const key of ['[data-team]','[data-variant]','[data-add]','[data-status]','select[data-theme]','select[data-logo]','[data-title]','[data-link]','[data-image]','[data-images]','[data-price]'])elements.set(key,new Element());
const variants=(id,available=true)=>[{id,title:'L',available,price:4999}];
const products=[['Eagles','Light','Team crest',11,true],['Eagles','Dark','Team crest',22,true],['Eagles','Dark','Alternate eagle',33,true],['Bombers','Light','Team crest',44,false]];
for(const [team,theme,logo,id,available] of products){const o=new Element();o.value=String(id);o.dataset={teamName:team,theme,logo,product:JSON.stringify({id,title:team+' '+theme+' '+logo,handle:'jersey-'+id,variants:variants(id,available),images:['https://images.example/'+id+'.png']})};elements.get('[data-team]').append(o);}
class Host{constructor(){this.dataset={currency:'USD'};}querySelector(key){return elements.get(key);}}
const context={HTMLElement:Host,customElements:{get:()=>null,define:(name,c)=>Selector=c},document:{createElement:()=>new Element(),documentElement:{lang:'en'}},window:{Shopify:{routes:{root:'/en/'}},location:{assign:url=>location=url}},Intl,fetch:async(url,init)=>{assert.equal(url,'/en/cart/add.js');payload=JSON.parse(init.body);return {ok:true,json:async()=>({})};}};
vm.runInNewContext(fs.readFileSync('shopify-extension/extensions/team-shop/assets/team-shop.js','utf8'),context);
(async()=>{const selector=new Selector();selector.connectedCallback();assert.deepEqual(elements.get('[data-team]').options.map(o=>o.value),['Eagles','Bombers']);
 selector.theme.value='Dark';selector.showLogos();assert.deepEqual(selector.logo.options.map(o=>o.value),['Team crest','Alternate eagle']);selector.logo.value='Alternate eagle';selector.showProduct();assert.equal(selector.variant.value,'33');await selector.addToCart();assert.equal(payload.items[0].id,33);assert.equal(payload.items[0].properties['Jersey theme'],'Dark');assert.equal(payload.items[0].properties['Front logo'],'Alternate eagle');assert.equal(location,'/en/cart');
 selector.busy=false;selector.team.value='Bombers';selector.showThemes();assert.equal(selector.theme.value,'Light');assert.equal(selector.logo.value,'Team crest');assert.equal(selector.add.disabled,true);
 console.log('Passed: team/theme/logo grouping, exact mapped variant and cart metadata, locale-aware cart path, missing combination fallback and sold-out blocking.');})().catch(e=>{console.error(e);process.exitCode=1;});
