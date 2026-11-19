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
let diffIn=0, diffOut=0, minx=1e9,maxx=-1,miny=1e9,maxy=-1, ndiff=0;
for(let y=0;y<A.h;y++)for(let x=0;x<A.w;x++){ const i=(y*A.w+x)*A.ch;
  const d=Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]);
  if(d>6){ ndiff++; const inD=Math.hypot(x-dcx,y-dcy)<=dr; if(inD) diffIn++; else {diffOut++; minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);} } }
console.log('crop',A.w,'x',A.h,'dpr',dpr);
console.log('disc centre dev px', dcx.toFixed(1), dcy.toFixed(1), 'r', dr.toFixed(1));
console.log('total differing px:', ndiff);
console.log('differing px INSIDE the disc:', diffIn);
console.log('differing px OUTSIDE the disc:', diffOut);
if(diffOut) console.log('outside-diff bbox x',minx,'-',maxx,' y',miny,'-',maxy, ' => css x', (ox+minx/dpr).toFixed(2),'-',(ox+maxx/dpr).toFixed(2));
