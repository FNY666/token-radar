const fs = require('node:fs'); const zlib = require('node:zlib');
function dec(p){const buf=fs.readFileSync(p);let o=8,idat=[],ihdr=null;while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),b=buf.subarray(o+8,o+8+len);if(t==='IHDR')ihdr=b;if(t==='IDAT')idat.push(b);o+=12+len;if(t==='IEND')break;}const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:ct===2?3:1,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(h*st);let prev=Buffer.alloc(st);for(let y=0;y<h;y++){const ft=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),cur=Buffer.alloc(st);for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,bb=prev[x],c=x>=ch?prev[x-ch]:0;let v;if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+bb;else if(ft===3)v=src[x]+((a+bb)>>1);else{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?bb:c;}cur[x]=v&255;}cur.copy(out,y*st);prev=cur;}return{w,h,ch,data:out};}
const A=dec('/tmp/junction.png');
const clipX = 555.1276245117188-14, clipY = 607.2408447265625-4, dpr=12;
const dcx=(543.1475524902344-clipX)*dpr, dcy=(619.2209167480469-clipY)*dpr, dr=11.98*dpr;
console.log('junction.png', A.w,'x',A.h,' disc centre dev',dcx.toFixed(1),dcy.toFixed(1),'r',dr.toFixed(1));
let inside=[], whiteInside=[];
for(let y=0;y<A.h;y++)for(let x=0;x<A.w;x++){ const i=(y*A.w+x)*A.ch; const r=A.data[i],g=A.data[i+1],b=A.data[i+2];
  if(Math.hypot(x-dcx,y-dcy)>dr) continue;
  inside.push([x,y,r,g,b]);
  if(r>195&&g>205&&b>215) whiteInside.push([x,y,r,g,b]);
}
console.log('px inside disc:',inside.length,' near-white(label ink) inside disc:',whiteInside.length);
if(whiteInside.length){
  console.log('  label ink inside disc: dev x',Math.min(...whiteInside.map(a=>a[0])),'-',Math.max(...whiteInside.map(a=>a[0])),
    ' y',Math.min(...whiteInside.map(a=>a[1])),'-',Math.max(...whiteInside.map(a=>a[1])));
  console.log('  => css x',(clipX+Math.min(...whiteInside.map(a=>a[0]))/dpr).toFixed(2),'-',(clipX+Math.max(...whiteInside.map(a=>a[0]))/dpr).toFixed(2),
    ' y',(clipY+Math.min(...whiteInside.map(a=>a[1]))/dpr).toFixed(2),'-',(clipY+Math.max(...whiteInside.map(a=>a[1]))/dpr).toFixed(2));
  console.log('  disc css right edge = 555.13, so ink OVERLAP width =', (555.13-(clipX+Math.min(...whiteInside.map(a=>a[0]))/dpr)).toFixed(2),'css px');
}
console.log('--- map, 1 dev px = 1 char, x starts at css', clipX.toFixed(2),'---');
console.log('    '+'0123456789'.repeat(1));
for(let y=0;y<A.h;y+=4){ let line='';
  for(let x=0;x<A.w;x+=4){ const i=(y*A.w+x)*A.ch; const r=A.data[i],g=A.data[i+1],b=A.data[i+2];
    const inD=Math.hypot(x-dcx,y-dcy)<=dr;
    const isW=(r>195&&g>205&&b>215); const isA=(r>160&&g>110&&g<200&&b<130);
    line += isW?'W':(isA?'A':(inD?'o':'.')); }
  console.log(String(y).padStart(4)+' '+line); }
