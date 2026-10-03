// Execute the production panel + garment renderers with a native Canvas adapter.
// Set JERSEY_CANVAS_MODULE to the installed @napi-rs/canvas module for this check.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const native=require(process.env.JERSEY_CANVAS_MODULE||'@napi-rs/canvas');
const modules=new Map();
function load(file){file=path.resolve(file);if(modules.has(file))return modules.get(file).exports;const m={exports:{}};modules.set(file,m);const src=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',src)((name)=>name.startsWith('.')?(name.endsWith('.json')?require(path.resolve(path.dirname(file),name)):load(path.resolve(path.dirname(file),name+'.ts'))):require(name),m,m.exports);return m.exports;}
global.Path2D=native.Path2D;
global.document={createElement(tag){assert.equal(tag,'canvas');return native.createCanvas(1,1);}};
global.Image=class extends native.Image{
 set src(value){this.originalSource=value;if(typeof value==='string'&&value.startsWith('blob:'))fetch(value).then(r=>r.arrayBuffer()).then(b=>{super.src=Buffer.from(b);}).catch(e=>this.onerror(e));else super.src=typeof value==='string'&&value.startsWith('/assets/')?path.resolve('public'+value):value;}
 get src(){return this.originalSource;}
};
const {renderJersey}=load('lib/jersey-renderer.ts'),{teams,teamDefaultConfig}=load('lib/catalog.ts');
(async()=>{
 const out='/tmp/lincforge-jersey-check';fs.mkdirSync(out,{recursive:true});
 const a={...teamDefaultConfig('dayton-eagles'),shirtColor:'#263849',primary:'#e4ae22',accent:'#17bdb1',trimColor:'#ef73bd'};
 const b={...teamDefaultConfig('indy-lacers'),shirtColor:'#faf5e8',primary:'#181c26',accent:'#e6b323',trimColor:'#cbd0d7'};
 const cases=[[teams[0],a,'front'],[teams[0],a,'back'],[teams.find(t=>t.id==='indy-lacers'),b,'front'],[teams.find(t=>t.id==='indy-lacers'),b,'back']];
 const montage=native.createCanvas(1200,1200),mc=montage.getContext('2d');mc.fillStyle='#f0f3f7';mc.fillRect(0,0,1200,1200);
 const outputs=[];
 for(const [i,[team,config,side]] of cases.entries()){
  const cv=native.createCanvas(1,1);await renderJersey(cv,side,team,config);const bytes=cv.toBuffer('image/png');outputs.push(bytes);fs.writeFileSync(out+'/'+team.id+'-'+side+'.png',bytes);mc.drawImage(cv,(i%2)*600,Math.floor(i/2)*600,600,600);
  const data=cv.getContext('2d').getImageData(0,0,1000,1000).data;
  for(const key of ['shirtColor','primary','accent','trimColor']){const rgb=config[key].slice(1).match(/../g).map(v=>parseInt(v,16));let matching=0;for(let p=0;p<data.length;p+=4)if(data[p+3]>240&&rgb.every((v,ch)=>Math.abs(v-data[p+ch])<18))matching++;assert(matching>200,side+' reflects '+key+'; found '+matching);}
  console.log(team.id+' '+side+': all four configured colors rendered');
 }
 fs.writeFileSync(out+'/comparison.png',montage.toBuffer('image/png'));
 const repeat=native.createCanvas(1,1);await renderJersey(repeat,'front',teams[0],a);assert.deepEqual(repeat.toBuffer('image/png'),outputs[0],'Switching back to a team restores its exact garment');
 const changed=native.createCanvas(1,1);await renderJersey(changed,'front',teams[0],{...a,frontScale:.22,frontY:.43,includeQR:false});assert.notDeepEqual(changed.toBuffer('image/png'),outputs[0],'Placement and QR changes reach the garment renderer');
 console.log('Team switching and artwork settings passed.');
})().catch(e=>{console.error(e);process.exit(1);});
