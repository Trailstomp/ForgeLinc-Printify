const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript'),{createRequire}=require('node:module');
const sharp=createRequire(require.resolve('next/package.json'))('sharp');
const mod={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('lib/artwork-background.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports);
const {removeOuterWhite}=mod.exports;
(async()=>{
 const output='/tmp/lincforge-background-check';fs.mkdirSync(output,{recursive:true});
 const teams=JSON.parse(fs.readFileSync('lib/teams.json','utf8'));const montage=[];
 for(const [n,team] of teams.entries()){
  const {data,info}=await sharp('public'+team.back).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const original=new Uint8ClampedArray(data);const rgba=removeOuterWhite(original,info.width,info.height);
  assert.deepEqual(original,new Uint8ClampedArray(data),'Never mutate original pixels');
  for(const p of [0,info.width-1,(info.height-1)*info.width,info.height*info.width-1])assert.equal(rgba[p*4+3],0,team.id+' transparent corners');
  let transparent=0,opaque=0;
  for(let p=0;p<rgba.length;p+=4){if(rgba[p+3]===0)transparent++;if(rgba[p+3]===255)opaque++;if(rgba[p+3]===original[p+3])assert.deepEqual(rgba.subarray(p,p+4),original.subarray(p,p+4),'Protected foreground unchanged');}
  assert(transparent>100000&&opaque>500000,team.id+' expected foreground and background');
  const png=await sharp(Buffer.from(rgba),{raw:{width:info.width,height:info.height,channels:4}}).flatten({background:'#09374f'}).resize(256,384).png().toBuffer();
  montage.push({input:png,left:(n%4)*256,top:Math.floor(n/4)*384});
  console.log(team.id+': '+transparent+' transparent pixels; '+opaque+' unchanged opaque pixels');
 }
 await sharp({create:{width:1024,height:1152,channels:3,background:'#09374f'}}).composite(montage).png().toFile(output+'/all-teams-on-navy.png');
 const size=80,pixels=new Uint8ClampedArray(size*size*4).fill(255);
 // White uniform surrounded by a dark outline, with a tiny opening: retain its white interior.
 for(let y=20;y<60;y++)for(let x=20;x<60;x++)if(x===20||x===59||y===20||y===59){const p=(y*size+x)*4;pixels[p]=pixels[p+1]=pixels[p+2]=20;}
 for(let y=20;y<22;y++){const p=(y*size+40)*4;pixels[p]=pixels[p+1]=pixels[p+2]=255;}
 const masked=removeOuterWhite(pixels,size,size);assert.equal(masked[3],0);assert.equal(masked[(40*size+40)*4+3],255);
 console.log('All 11 backgrounds and protected white-region checks passed.');
})().catch(e=>{console.error(e);process.exit(1);});
