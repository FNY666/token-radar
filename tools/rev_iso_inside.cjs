const fs = require('node:fs'); const zlib = require('node:zlib');
function decodePNG(path) {
  const buf = fs.readFileSync(path); let o = 8, idat = [], ihdr = null;
  while (o < buf.length) { const len = buf.readUInt32BE(o); const type = buf.toString('ascii', o+4, o+8);
    const body = buf.subarray(o+8, o+8+len);
    if (type==='IHDR') ihdr = body; if (type==='IDAT') idat.push(body); o += 12+len; if (type==='IEND') break; }
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4), ct = ihdr[9];
  const ch = ct===6?4:ct===2?3:1; const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w*ch; const out = Buffer.alloc(h*stride); let prev = Buffer.alloc(stride);
  for (let y=0;y<h;y++){ const ft=raw[y*(stride+1)]; const src=raw.subarray(y*(stride+1)+1,y*(stride+1)+1+stride);
    const cur=Buffer.alloc(stride);
    for(let x=0;x<stride;x++){ const a=x>=ch?cur[x-ch]:0,b=prev[x],c=x>=ch?prev[x-ch]:0; let v;
      if(ft===0)v=src[x]; else if(ft===1)v=src[x]+a; else if(ft===2)v=src[x]+b; else if(ft===3)v=src[x]+((a+b)>>1);
      else {const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c); v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?b:c;}
      cur[x]=v&0xff;} cur.copy(out,y*stride); prev=cur;}
  return {w,h,ch,data:out};
}
const A=decodePNG('/tmp/iso_with.png'), B=decodePNG('/tmp/iso_without.png');
const ox=525.16748046875, oy=601.2408447265625, dpr=8;
const dcx=(543.1475524902344-ox)*dpr, dcy=(619.2209167480469-oy)*dpr, dr=11.98*dpr;
const inside=[];
for(let y=0;y<A.h;y++)for(let x=0;x<A.w;x++){ const i=(y*A.w+x)*A.ch;
  const d=Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]);
  if(d>6 && Math.hypot(x-dcx,y-dcy)<=dr) inside.push([x,y,A.data[i],A.data[i+1],A.data[i+2],B.data[i],B.data[i+1],B.data[i+2]]); }
console.log('differing inside disc:', inside.length);
console.log('x range', Math.min(...inside.map(a=>a[0])), Math.max(...inside.map(a=>a[0])));
console.log('y range', Math.min(...inside.map(a=>a[1])), Math.max(...inside.map(a=>a[1])));
console.log('=> css x range', (ox+Math.min(...inside.map(a=>a[0]))/dpr).toFixed(2), (ox+Math.max(...inside.map(a=>a[0]))/dpr).toFixed(2));
console.log('=> css y range', (oy+Math.min(...inside.map(a=>a[1]))/dpr).toFixed(2), (oy+Math.max(...inside.map(a=>a[1]))/dpr).toFixed(2));
console.log('disc css: x 531.17-555.13, y 607.24-631.20');
// color histogram of the changed pixels in the WITH image
const h2=new Map(); for(const a of inside){ const k=a[2]+','+a[3]+','+a[4]; h2.set(k,(h2.get(k)||0)+1); }
[...h2.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v])=>console.log(v,k));
console.log('--- first 12 samples (dev x,y | with | without) ---');
inside.slice(0,12).forEach(a=>console.log(a[0],a[1],'|',a[2]+','+a[3]+','+a[4],'|',a[5]+','+a[6]+','+a[7]));
