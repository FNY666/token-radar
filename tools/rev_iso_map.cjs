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
const ox=525.16748046875, oy=601.2408447065625, dpr=8;
const dcx=(543.1475524902344-ox)*dpr, dcy=(619.2209167480469-oy)*dpr, dr=11.98*dpr;
console.log('Legend: X = label ink painted OVER the amber disc; W = label ink outside disc; A = amber; . = bg');
console.log('     ' + '|'.repeat(0));
const step=3;
for(let y=0;y<A.h;y+=step){ let line='';
  for(let x=0;x<A.w;x+=step){ const i=(y*A.w+x)*A.ch;
    const d=Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]);
    const inD=Math.hypot(x-dcx,y-dcy)<=dr;
    const isW=(A.data[i]>200&&A.data[i+1]>205&&A.data[i+2]>215);
    line += (d>6 && inD) ? 'X' : (isW?'W':(inD?'A':'.')); }
  console.log(String(y).padStart(4)+' '+line); }
// count
let nOver=0,nOverWhite=0;
for(let y=0;y<A.h;y++)for(let x=0;x<A.w;x++){ const i=(y*A.w+x)*A.ch;
  const d=Math.abs(A.data[i]-B.data[i])+Math.abs(A.data[i+1]-B.data[i+1])+Math.abs(A.data[i+2]-B.data[i+2]);
  if(d>6 && Math.hypot(x-dcx,y-dcy)<=dr){ nOver++;
    if(A.data[i]>200&&A.data[i+1]>205&&A.data[i+2]>215) nOverWhite++; } }
console.log('\npixels changed inside disc:', nOver, ' of which are label-ink-white:', nOverWhite);
console.log('label anchor css x=552.134 ; disc right edge css x=555.128 ; overlap =', (555.128-552.134).toFixed(3), 'css px');
