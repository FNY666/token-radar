// Fresh judge screenshot: exact pixel columns of the label's first ink vs the disc rim.
const fs = require('node:fs'); const zlib = require('node:zlib');
function dec(p){const buf=fs.readFileSync(p);let o=8,idat=[],ihdr=null;while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),b=buf.subarray(o+8,o+8+len);if(t==='IHDR')ihdr=b;if(t==='IDAT')idat.push(b);o+=12+len;if(t==='IEND')break;}const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:ct==2?3:1,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(h*st);let prev=Buffer.alloc(st);for(let y=0;y<h;y++){const ft=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),cur=Buffer.alloc(st);for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,bb=prev[x],c=x>=ch?prev[x-ch]:0;let v;if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+bb;else if(ft===3)v=src[x]+((a+bb)>>1);else{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?bb:c;}cur[x]=v&255;}cur.copy(out,y*st);prev=cur;}return{w,h,ch,data:out};}
const A=dec(process.argv[2]);
console.log('img', A.w, A.h);
// Disc: the bright amber 228,172,66
const isDisc=(r,g,b)=>r>210&&g>150&&g<195&&b<90&&r-b>110;
// The disc is the bright one (fill-opacity .75 over panel => the solid 186,143,62? test both)
console.log('--- rows 600-625, x 640-700 ---');
for(let y=600;y<=625;y+=2){ let line='';
  for(let x=640;x<=700;x++){ const j=(y*A.w+x)*A.ch; const r=A.data[j],g=A.data[j+1],b=A.data[j+2];
    if(isDisc(r,g,b)) line+='D';
    else if(r>200&&g>210&&b>220) line+='W';
    else if(r>150&&g>110&&g<200&&b<140) line+='a';
    else if(r>40&&g>40) line+='+';
    else line+='.'; }
  console.log(String(y).padStart(4), line); }
console.log('    '+'0123456789'.repeat(1)+'  (x from 640)');
