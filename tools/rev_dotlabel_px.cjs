// Pixel-level check: does the label's ink overlap the amber dot's painted disc?
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
const {w,h,ch,data} = decodePNG(process.argv[2]);
const amber=[], white=[];
for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const i=(y*w+x)*ch; const r=data[i],g=data[i+1],bl=data[i+2],a=ch===4?data[i+3]:255;
  if(a<50) continue;
  if(r>190&&g>130&&g<220&&bl<140&&(r-bl)>90) amber.push([x,y]);
  else if(r>200&&g>210&&bl>225) white.push([x,y]);
}
console.log('image',w,'x',h,'ch',ch);
console.log('amber px',amber.length,'label-white px',white.length);
if(!amber.length||!white.length) process.exit(0);
console.log('amber bbox x',Math.min(...amber.map(a=>a[0])),'-',Math.max(...amber.map(a=>a[0])),' y',Math.min(...amber.map(a=>a[1])),'-',Math.max(...amber.map(a=>a[1])));
console.log('white  bbox x',Math.min(...white.map(a=>a[0])),'-',Math.max(...white.map(a=>a[0])),' y',Math.min(...white.map(a=>a[1])),'-',Math.max(...white.map(a=>a[1])));
const aset=new Set(amber.map(a=>a[0]+','+a[1]));
let hits=0; for(const [x,y] of white) if(aset.has(x+','+y)) hits++;
console.log('EXACT overlapping px (label ink on amber):',hits);
// nearest amber pixel to the leftmost white pixel
const first=white.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1])[0];
let best=1e9,bp=null; for(const [x,y] of amber){const d=Math.hypot(x-first[0],y-first[1]); if(d<best){best=d;bp=[x,y];}}
console.log('leftmost label ink px',first,'-> nearest amber px',bp,'dist',best.toFixed(2));
// horizontal gap between the amber disc's right edge and the label's leftmost ink
const amax=Math.max(...amber.map(a=>a[0])), wmin=Math.min(...white.map(a=>a[0]));
console.log('amber right edge x =',amax,' label leftmost ink x =',wmin,' horizontal gap =',wmin-amax-1,'px');
