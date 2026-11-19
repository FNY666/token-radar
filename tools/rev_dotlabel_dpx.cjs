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
const A = decodePNG('/tmp/rev_with.png'), B = decodePNG('/tmp/rev_without.png');
// dot disc in this crop's pixels (4x dpr, crop origin = dotCss.cx-20, cy-20)
const dcx = (543.1475315656567-523.1475315656567)*4, dcy=(619.1072916666667-599.1072916666667)*4, dr=11.980059459477472*4;
let diffIn=0, diffOut=0, tot=0, minx=1e9,maxx=-1,miny=1e9,maxy=-1;
for(let y=0;y<A.h;y++)for(let x=0;x<A.w;x++){ const i=(y*A.w+x)*A.ch;
  const d=Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]);
  const inDisc = Math.hypot(x-dcx,y-dcy) <= dr;
  tot++; if(d>6){ if(inDisc) diffIn++; else diffOut++;
    minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);} }
console.log('crop', A.w,'x',A.h,'dot centre px', dcx.toFixed(1), dcy.toFixed(1), 'r', dr.toFixed(1));
console.log('differing pixels INSIDE the dot disc:', diffIn);
console.log('differing pixels OUTSIDE the dot disc:', diffOut);
console.log('diff bbox x', minx,'-',maxx,' y', miny,'-',maxy, ' (label ink left edge at px', (A.w===0?0:0)+'' + ')');
