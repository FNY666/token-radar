// In the FRESH judge screenshot, find the white label text run near the rank-1 disc.
const fs = require('node:fs'); const zlib = require('node:zlib');
function dec(p){const buf=fs.readFileSync(p);let o=8,idat=[],ihdr=null;while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),b=buf.subarray(o+8,o+8+len);if(t==='IHDR')ihdr=b;if(t==='IDAT')idat.push(b);o+=12+len;if(t==='IEND')break;}const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:ct===2?3:1,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(h*st);let prev=Buffer.alloc(st);for(let y=0;y<h;y++){const ft=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),cur=Buffer.alloc(st);for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,bb=prev[x],c=x>=ch?prev[x-ch]:0;let v;if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+bb;else if(ft===3)v=src[x]+((a+bb)>>1);else{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?bb:c;}cur[x]=v&255;}cur.copy(out,y*st);prev=cur;}return{w,h,ch,data:out};}
const A=dec(process.argv[2]);
const isW=(r,g,b)=>r>170&&g>180&&b>190;   // any light-ish (label ink is 232,237,244)
const isAmber=(r,g,b)=>r>150&&g>100&&g<200&&b<140&&r-b>70;
// scan a band and report light-ink columns
for (const [ya,yb] of [[605,625],[608,622],[610,620]]) {
  let cols=[];
  for(let x=600;x<=820;x++){ let n=0;
    for(let y=ya;y<=yb;y++){const j=(y*A.w+x)*A.ch; if(isW(A.data[j],A.data[j+1],A.data[j+2])) n++;}
    if(n) cols.push([x,n]); }
  if(cols.length) console.log('band y',ya,'-',yb,' light columns:', cols.map(c=>c[0]+'('+c[1]+')').join(' '));
}
// where is the amber disc exactly (per row)?
let discRows={};
for(let y=596;y<=634;y++){ let a=-1,b=-1;
  for(let x=600;x<=700;x++){ const j=(y*A.w+x)*A.ch; if(isAmber(A.data[j],A.data[j+1],A.data[j+2])) { if(a<0)a=x; b=x; } }
  if(a>=0) discRows[y]=[a,b]; }
console.log('amber disc extent by row:', JSON.stringify(discRows));
