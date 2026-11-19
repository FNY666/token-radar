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
const {w,h,ch,data} = decodePNG('/tmp/rev_iso.png');
// crop origin: discRect.l-10 css, discRect.t-10 css, dpr 4
// disc centre css x 543.1475, y 619.2209 ; r 11.98
const ox = 531.16748046875-10, oy = 607.2408447265625-10;
const dcx=(543.1475524902344-ox)*4, dcy=(619.2209167480469-oy)*4, dr=11.98*4;
console.log('image',w,'x',h,' disc centre dev', dcx.toFixed(1), dcy.toFixed(1), 'r dev', dr.toFixed(1));
// classify: amber disc pixels, white label ink pixels, and count ink pixels that lie ON the disc
let amberSet=new Set(), whitePx=[], onDisc=0, onDiscList=[];
for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const i=(y*w+x)*ch; const r=data[i],g=data[i+1],b=data[i+2];
  const inD = Math.hypot(x-dcx,y-dcy)<=dr;
  if (inD && r>190&&g>140&&g<215&&b<125) { amberSet.add(x+','+y); }
  if (r>200&&g>208&&b>218) { whitePx.push([x,y]); if(inD){onDisc++; onDiscList.push([x,y,r,g,b]);} }
}
console.log('white-ish px inside disc:', onDisc);
console.log('first 20:', JSON.stringify(onDiscList.slice(0,20)));
// min x of any white ink overall
if(whitePx.length) console.log('white ink x range', Math.min(...whitePx.map(a=>a[0])), '-', Math.max(...whitePx.map(a=>a[0])),
  ' y range', Math.min(...whitePx.map(a=>a[1])), '-', Math.max(...whitePx.map(a=>a[1])));
console.log('--- ASCII (A=amber, W=white ink, +=white ink inside disc, .=bg) ---');
for(let y=0;y<h;y+=3){ let line='';
  for(let x=0;x<w;x+=3){ const i=(y*w+x)*ch; const r=data[i],g=data[i+1],b=data[i+2];
    const inD=Math.hypot(x-dcx,y-dcy)<=dr;
    const isW=(r>200&&g>208&&b>218); const isA=(r>190&&g>140&&g<215&&b<125);
    line += isW ? (inD?'+':'W') : (isA?'A':(inD?'o':'.')); }
  console.log(String(y).padStart(4), line); }
