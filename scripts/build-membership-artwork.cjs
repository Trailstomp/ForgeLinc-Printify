// Composite the original, verified QR modules onto the AI-created sleeve emblem.
// The QR is functional data, never generated or interpreted by an image model.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const native=require(process.env.JERSEY_CANVAS_MODULE||'@napi-rs/canvas');
const moduleSource=ts.transpileModule(fs.readFileSync('lib/artwork-background.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const background={exports:{}};new Function('exports',moduleSource)(background.exports);
(async()=>{
 const source=await native.loadImage('public/assets/membership-head-source-v1.png');
 const cv=native.createCanvas(source.width,source.height),c=cv.getContext('2d');c.drawImage(source,0,0);
 const pixels=c.getImageData(0,0,cv.width,cv.height);
 pixels.data.set(background.exports.removeOuterWhite(pixels.data,cv.width,cv.height));c.putImageData(pixels,0,0);
 const qr=await native.loadImage('public/assets/qr.png'),qc=native.createCanvas(qr.width,qr.height),q=qc.getContext('2d');q.drawImage(qr,0,0);
 const data=q.getImageData(0,0,qr.width,qr.height).data;
 // Existing 25×25 QR at (489,540), 9 px/module; independently decoded https://mlbl.org.
 const modules=Array.from({length:25},(_,y)=>Array.from({length:25},(_,x)=>{
  const i=((540+y*9+4)*qr.width+489+x*9+4)*4;return data[i]+data[i+1]+data[i+2]<384;
 }));
 const step=7,margin=4,size=(25+2*margin)*step,x=511,y=600;
 c.fillStyle='#fff';c.fillRect(506,595,241,241);
 c.fillStyle='#000';for(let row=0;row<25;row++)for(let col=0;col<25;col++)if(modules[row][col])c.fillRect(x+(col+margin)*step,y+(row+margin)*step,step,step);
 fs.writeFileSync('public/assets/membership-head-v1.png',cv.toBuffer('image/png'));
 fs.writeFileSync('design-notes/membership-head-v1.json',JSON.stringify({source:'public/assets/membership-head-source-v1.png',originalQR:'public/assets/qr.png',decodedURL:'https://mlbl.org',modules,quietZoneModules:margin,placement:{x,y,size}},null,2));
 console.log('Sleeve emblem assembled with original QR modules and transparent outer background.');
})().catch(e=>{console.error(e);process.exit(1);});
