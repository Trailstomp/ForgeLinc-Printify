// Restore the original diagonal head unchanged, with a separate membership title.
const fs=require('node:fs'),ts=require('typescript');
const native=require(process.env.JERSEY_CANVAS_MODULE||'@napi-rs/canvas');
const code=ts.transpileModule(fs.readFileSync('lib/artwork-background.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const background={};new Function('exports',code)(background);
(async()=>{
 const original=await native.loadImage('public/assets/qr.png');
 const title=await native.loadImage('public/assets/membership-script-v2.png');
 const titleCanvas=native.createCanvas(title.width,title.height),tc=titleCanvas.getContext('2d');tc.drawImage(title,0,0);
 const pixels=tc.getImageData(0,0,title.width,title.height);pixels.data.set(background.removeOuterWhite(pixels.data,title.width,title.height));tc.putImageData(pixels,0,0);
 let left=title.width,top=title.height,right=0,bottom=0;
 for(let y=0;y<title.height;y++)for(let x=0;x<title.width;x++)if(pixels.data[(y*title.width+x)*4+3]>20){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
 const cv=native.createCanvas(original.width,original.height+200),c=cv.getContext('2d');
 // Pixel-for-pixel original: same diagonal angle, perspective, ball texture and QR.
 c.drawImage(original,0,200);
 const sw=right-left+1,sh=bottom-top+1,dw=original.width-100,dh=dw*sh/sw;
 c.drawImage(titleCanvas,left,top,sw,sh,50,12,dw,dh);
 fs.writeFileSync('public/assets/membership-head-angled-v2.png',cv.toBuffer('image/png'));
 console.log('Original angled head restored with membership lettering.');
})().catch(e=>{console.error(e);process.exit(1);});
