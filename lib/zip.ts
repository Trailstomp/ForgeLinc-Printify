const enc=new TextEncoder();
function crc32(bytes:Uint8Array){let c=0xffffffff;for(const v of bytes){c^=v;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function block(size:number){const bytes=new Uint8Array(size);return {bytes,v:new DataView(bytes.buffer)};}
export function zipFiles(files:{name:string;bytes:Uint8Array}[]):Blob{
 const local:Uint8Array[]=[];const central:Uint8Array[]=[];let offset=0,total=0;
 for(const f of files){
 const name=enc.encode(f.name),crc=crc32(f.bytes),h=block(30);
 h.v.setUint32(0,0x04034b50,true);h.v.setUint16(4,20,true);h.v.setUint16(6,0x800,true);h.v.setUint32(14,crc,true);h.v.setUint32(18,f.bytes.length,true);h.v.setUint32(22,f.bytes.length,true);h.v.setUint16(26,name.length,true);
 local.push(h.bytes,name,f.bytes);
 const c=block(46);c.v.setUint32(0,0x02014b50,true);c.v.setUint16(4,20,true);c.v.setUint16(6,20,true);c.v.setUint16(8,0x800,true);c.v.setUint32(16,crc,true);c.v.setUint32(20,f.bytes.length,true);c.v.setUint32(24,f.bytes.length,true);c.v.setUint16(28,name.length,true);c.v.setUint32(42,offset,true);central.push(c.bytes,name);
 offset+=30+name.length+f.bytes.length;total+=46+name.length;
 }
 const end=block(22);end.v.setUint32(0,0x06054b50,true);end.v.setUint16(8,files.length,true);end.v.setUint16(10,files.length,true);end.v.setUint32(12,total,true);end.v.setUint32(16,offset,true);
 return new Blob([...local,...central,end.bytes] as BlobPart[],{type:"application/zip"});
}
export function download(blob:Blob,name:string){const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);}

