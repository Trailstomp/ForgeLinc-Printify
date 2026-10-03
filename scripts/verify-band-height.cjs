// Inspect the production mesh and panel UVs without starting a browser or WebGL server.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),ts=require('typescript'),THREE=require('three'),native=require('@napi-rs/canvas');
const cache=new Map();function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;const m={exports:{}};cache.set(file,m);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)(id=>id.startsWith('.')?(id.endsWith('.json')?require(path.resolve(path.dirname(file),id)):load(path.resolve(path.dirname(file),id+'.ts'))):require(id),m,m.exports);return m.exports;}
global.document={createElement:()=>native.createCanvas(1,1)};
global.Image=class extends native.Image{set src(v){if(typeof v==='string'&&v.startsWith('blob:'))fetch(v).then(r=>r.arrayBuffer()).then(b=>{super.src=Buffer.from(b);});else super.src=typeof v==='string'&&v.startsWith('/assets/')?path.resolve('public'+v):v;}};
(async()=>{
const {renderPanel}=load('lib/panel-renderer.ts'),{teams,teamDefaultConfig,artworkPanels,artworkLayer,configSchema,sameDesign}=load('lib/catalog.ts');
const base=teamDefaultConfig('dayton-eagles');base.artwork=Object.fromEntries(artworkPanels.map(id=>[id,{...artworkLayer(base,id),visible:false}]));
assert.equal(configSchema.parse({...base,bandHeight:undefined}).bandHeight,.18);
for(const stripeStyle of ['sweep','angular','curved','straight','lightning','pixels','digital-camo']){
 const configs=[.08,.18,.4].map(bandHeight=>({...base,stripeLayout:'bands',stripeStyle,bandHeight}));
 for(const id of ['front','back','left-sleeve']){
  const hashes=new Set();for(const config of configs){const cv=native.createCanvas(1,1);await renderPanel(cv,id,teams[0],config,true);hashes.add(require('crypto').createHash('sha256').update(cv.toBuffer('image/png')).digest('hex'));assert.equal(configSchema.parse(JSON.parse(JSON.stringify(config))).bandHeight,config.bandHeight);}
  assert.equal(hashes.size,3, stripeStyle+' '+id+' adjusts height');
 }
 assert(!sameDesign(configs[0],configs[2]));
}
// A real opaque artwork pixel in the lower overlap must remain identical to the
// no-stripes render, even when the saved wedge layering option is enabled.
const cfg={...teamDefaultConfig('dayton-eagles'),stripeLayout:'bands',bandHeight:.4,backBehindStripes:true};
const clean=native.createCanvas(1,1),band=native.createCanvas(1,1);await renderPanel(clean,'back',teams[0],{...cfg,stripeStyle:'none'},true);await renderPanel(band,'back',teams[0],{...cfg,stripeStyle:'straight'},true);
const a=clean.getContext('2d').getImageData(0,0,clean.width,clean.height).data,b=band.getContext('2d').getImageData(0,0,band.width,band.height).data;let preserved=0;
for(let y=Math.ceil(clean.height*.64);y<clean.height*.77;y++)for(let x=Math.floor(clean.width*.3);x<clean.width*.7;x++){const i=(y*clean.width+x)*4;if(a[i]<80&&a[i+1]<80&&a[i+2]<80&&a[i-4]<80&&a[i+4]<80){if(b[i]===a[i]&&b[i+1]===a[i+1]&&b[i+2]===a[i+2])preserved++;}}
assert(preserved>200,'Real roster pixels remain in front of the taller band');
const foreground=native.createCanvas(1,1);await renderPanel(foreground,'back',teams[0],{...cfg,stripeStyle:'straight',backBehindStripes:false},true);assert.deepEqual(band.toBuffer('image/png'),foreground.toBuffer('image/png'),'Bands always render behind players regardless of wedge layering setting');
const out=native.createCanvas(clean.width*2,clean.height),ctx=out.getContext('2d');ctx.drawImage(clean,0,0);ctx.drawImage(band,clean.width,0);fs.writeFileSync('/tmp/forgelinc-band-layering.png',out.toBuffer('image/png'));
console.log('Band height: all seven styles and three panels adjust; saved configs retain height; distinct designs stay separate; '+preserved+' roster pixels stay above bands.');
})().catch(e=>{console.error(e);process.exit(1)});
