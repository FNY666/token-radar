// Scan the judge's screenshot for the near-white label text run in the plot band,
// and for the rank-1 amber disc, then relate them.
const fs = require('node:fs'); const zlib = require('node:zlib');
function dec(p){const buf=fs.readFileSync(p);let o=8,idat=[],ihdr=null;while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),b=buf.subarray(o+8,o+8+len);if(t==='IHDR')ihdr=b;if(t==='IDAT')idat.push(b);o+=12+len;if(t==='IEND')break;}const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:ct==2?3:1,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(h*st);let prev=Buffer.alloc(st);for(let y=0;y<h;y++){const ft=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),cur=Buffer.alloc(st);for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,bb=prev[x],c=x>=ch?prev[x-ch]:0;let v;if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+bb;else if(ft===3)v=src[x]+((a+bb)>>1);else{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?bb:c;}cur[x]=v&255;}cur.copy(out,y*st);prev=cur;}return{w,h,ch,data:out};}
const A=dec(process.argv[2]);
const isLabel=(r,g,b)=>Math.abs(r-232)<14&&Math.abs(g-237)<14&&Math.abs(b-244)<14;
const isDisc=(r,g,b)=>r>205&&g>145&&g<200&&b<95&&r-b>105;
// scan the whole plot band for near-white pixels (label ink)
let hits=[];
for(let y=580;y<660;y++)for(let x=0;x<A.w;x++){ const j=(y*A.w+x)*A.ch;
  if(isLabel(A.data[j],A.data[j+1],A.data[j+2])) hits.push([x,y]); }
if(!hits.length){console.log('no near-white label ink in band 580-660');}
else{
  const xs=hits.map(a=>a[0]);
  // cluster columns
  const cols=[...new Set(xs)].sort((a,b)=>a-b);
  const groups=[]; let s=cols[0], pv=cols[0];
  for(const c of cols.slice(1)){ if(c-pv>8){groups.push([s,pv]); s=c;} pv=c; } groups.push([s,pv]);
  console.log('near-white column groups in band 580-660:', JSON.stringify(groups));
  console.log('  y range', Math.min(...hits.map(a=>a[1])), '-', Math.max(...hits.map(a=>a[1])));
}
// disc candidates
let discs=[];
for(let cy=585;cy<655;cy++)for(let cx=400;cx<900;cx++){ const j=(cy*A.w+cx)*A.ch;
  if(!isDisc(A.data[j],A.data[j+1],A.data[j+2])) continue;
  let n=0; for(let dy=-8;dy<=8;dy++)for(let dx=-8;dx<=8;dx++){ if(dx*dx+dy*dy>64) continue; const k=((cy+dy)*A.w+(cx+dx))*A.ch; if(isDisc(A.data[k],A.data[k+1],A.data[k+2])) n++; }
  if(n>44) discs.push({cx,cy,n}); }
console.log('solid-amber disc candidates:', JSON.stringify(discs.slice(0,10)));
