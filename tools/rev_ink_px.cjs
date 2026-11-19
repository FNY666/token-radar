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
const {w,h,ch,data} = decodePNG('/tmp/rev_ink.png');
// crop origin in CSS px was dot.l-8 ; device scale 4
// dot centre css = 543.1475 -> crop x = 543.1475-523.1675 = 19.98 css -> 79.9 device px
// dot r css 11.98 -> 47.9 device
const dcx=79.9, dcy=(619.2209167480469-599.2408447265625)*4, dr=11.98*4;
let amber=[],white=[];
for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const i=(y*w+x)*ch; const r=data[i],g=data[i+1],b=data[i+2];
  const inD=Math.hypot(x-dcx,y-dcy)<=dr;
  if(!inD) continue;
  if(r>180&&g>120&&g<225&&b<140&&r-b>80) amber.push([x,y,r,g,b]);
  else if(r>195&&g>205&&b>215) white.push([x,y,r,g,b]);
}
console.log('inside disc: amber-ish px',amber.length,' near-white px',white.length);
if(amber.length){
  const amax=Math.max(...amber.map(a=>a[0])), amin=Math.min(...amber.map(a=>a[0]));
  console.log('amber disc spans x', amin,'-',amax,' (device px), so right edge =',amax);
}
if(white.length){
  const wmin=Math.min(...white.map(a=>a[0])), wmax=Math.max(...white.map(a=>a[0]));
  const wy=Math.min(...white.map(a=>a[1])), wy2=Math.max(...white.map(a=>a[1]));
  console.log('near-white px inside disc span x',wmin,'-',wmax,' y',wy,'-',wy2);
}
// All near-white in the whole crop (label ink), outside disc
let allWhite=[];
for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const i=(y*w+x)*ch; const r=data[i],g=data[i+1],b=data[i+2];
  if(r>195&&g>205&&b>215) allWhite.push([x,y]); }
if(allWhite.length){
  console.log('label ink (white) in crop: x', Math.min(...allWhite.map(a=>a[0])),'-',Math.max(...allWhite.map(a=>a[0])), ' y',Math.min(...allWhite.map(a=>a[1])),'-',Math.max(...allWhite.map(a=>a[1])));
  const wmin=Math.min(...allWhite.map(a=>a[0]));
  const amberMax = amber.length?Math.max(...amber.map(a=>a[0])):null;
  if(amberMax!==null) console.log('HORIZONTAL GAP between disc right edge and label first ink =', (wmin-amberMax-1), 'device px =', ((wmin-amberMax-1)/4).toFixed(2), 'css px');
}
// ASCII map, 2 device px per char
console.log('--- map (A=amber, W=white label ink, X=both/ambiguous, .=bg) ---');
for(let y=0;y<h;y+=3){ let line='';
  for(let x=0;x<w;x+=3){ const i=(y*w+x)*ch; const r=data[i],g=data[i+1],b=data[i+2];
    const inD=Math.hypot(x-dcx,y-dcy)<=dr;
    const isA=(r>180&&g>120&&g<225&&b<140&&r-b>80); const isW=(r>195&&g>205&&b>215);
    line += isW?'W':(isA?'A':(inD?'o':'.')); }
  console.log(String(y).padStart(4), line); }
