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
const step = parseInt(process.argv[3]||'4');
function cls(r,g,b){
  if(r>200&&g>205&&b>220) return 'W';           // label ink (near-white)
  if(r>190&&g>130&&g<215&&b<125&&r-b>100) return 'A';  // amber
  if(r>195&&g>150&&g<200&&b<110) return 'a';    // amber-ish antialias
  if(b>110&&g>110&&r<190&&g>b) return 'g';     // mint/green
  if(r<40&&g<45&&b<60) return '.';             // panel bg
  return '-';
}
for(let y=0;y<h;y+=step){ let line='';
  for(let x=0;x<w;x+=step){ const i=(y*w+x)*ch; line+=cls(data[i],data[i+1],data[i+2]); }
  console.log(String(y).padStart(4), line);
}
console.log('     '+'0123456789'.repeat(1)+'  (x index / step='+step+')');
