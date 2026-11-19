const fs = require('node:fs'); const zlib = require('node:zlib');
function dec(p){const buf=fs.readFileSync(p);let o=8,idat=[],ihdr=null;while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),b=buf.subarray(o+8,o+8+len);if(t==='IHDR')ihdr=b;if(t==='IDAT')idat.push(b);o+=12+len;if(t==='IEND')break;}const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:ct===2?3:1,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(h*st);let prev=Buffer.alloc(st);for(let y=0;y<h;y++){const ft=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),cur=Buffer.alloc(st);for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,bb=prev[x],c=x>=ch?prev[x-ch]:0;let v;if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+bb;else if(ft===3)v=src[x]+((a+bb)>>1);else{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?bb:c;}cur[x]=v&255;}cur.copy(out,y*st);prev=cur;}return{w,h,ch,data:out};}
const A=dec('/tmp/ctl_a.png'), B=dec('/tmp/ctl_c.png');
const ox=525.16748046875, oy=601.2408447065625, dpr=8;
const dcx=(543.1475524902344-ox)*dpr, dcy=(619.2209167480469-oy)*dpr, dr=11.98*dpr;
// A = with label, C = without label. Inside the disc, what colour did the WITH image have?
const withPix=[], withoutPix=[];
for(let y=0;y<A.h;y++)for(let x=0;x<A.w;x++){ const i=(y*A.w+x)*A.ch;
  if(Math.hypot(x-dcx,y-dcy)>dr) continue;
  withPix.push([x,y,A.data[i],A.data[i+1],A.data[i+2]]);
  withoutPix.push([x,y,B.data[i],B.data[i+1],B.data[i+2]]); }
// Classify WITH pixels: amber-ish vs whitish(ink)
let amberish=0, whitish=0, other=0; const whiteLocs=[]; const amberLocs=[];
for(const [x,y,r,g,b] of withPix){
  if(r>190&&g>200&&b>210){ whitish++; whiteLocs.push([x,y]); }
  else if(r>150&&g>110&&g<200&&b<140){ amberish++; amberLocs.push([x,y]); }
  else other++;
}
console.log('inside disc: amber-ish',amberish,' white-ish',whitish,' other',other,' total',withPix.length);
if(whiteLocs.length){
  console.log('WHITE-ink-in-disc x range dev', Math.min(...whiteLocs.map(a=>a[0])), Math.max(...whiteLocs.map(a=>a[0])),
    '-> css', (ox+Math.min(...whiteLocs.map(a=>a[0]))/dpr).toFixed(2), (ox+Math.max(...whiteLocs.map(a=>a[0]))/dpr).toFixed(2));
  console.log('WHITE-ink-in-disc y range dev', Math.min(...whiteLocs.map(a=>a[1])), Math.max(...whiteLocs.map(a=>a[1])),
    '-> css', (oy+Math.min(...whiteLocs.map(a=>a[1]))/dpr).toFixed(2), (oy+Math.max(...whiteLocs.map(a=>a[1]))/dpr).toFixed(2));
}
