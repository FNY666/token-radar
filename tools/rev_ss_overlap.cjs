// In the JUDGE's own screenshot (screenshots/1-board.png), find the amber rank-1 disc and
// measure whether white label ink overlaps it.
const fs = require('node:fs'); const zlib = require('node:zlib');
function dec(p){const buf=fs.readFileSync(p);let o=8,idat=[],ihdr=null;while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),b=buf.subarray(o+8,o+8+len);if(t==='IHDR')ihdr=b;if(t==='IDAT')idat.push(b);o+=12+len;if(t==='IEND')break;}const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:ct===2?3:1,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(h*st);let prev=Buffer.alloc(st);for(let y=0;y<h;y++){const ft=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),cur=Buffer.alloc(st);for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,bb=prev[x],c=x>=ch?prev[x-ch]:0;let v;if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+bb;else if(ft===3)v=src[x]+((a+bb)>>1);else{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?bb:c;}cur[x]=v&255;}cur.copy(out,y*st);prev=cur;}return{w,h,ch,data:out};}
const A=dec(process.argv[2]);
// scan for a disc-shaped amber blob of radius ~12 in the plot band (y 560..660)
const isAmber=(r,g,b)=>r>170&&g>120&&g<200&&b<130&&r-b>80;
const isWhite=(r,g,b)=>r>200&&g>210&&b>220;
let found=null;
// brute force: for each pixel, count amber in a disc of r=12
for(let cy=560;cy<680&&!found;cy++)for(let cx=400;cx<760&&!found;cx++){
  const i=(cy*A.w+cx)*A.ch; if(!isAmber(A.data[i],A.data[i+1],A.data[i+2])) continue;
  let n=0; for(let dy=-13;dy<=13;dy++)for(let dx=-13;dx<=13;dx++){ if(dx*dx+dy*dy>169) continue;
    const j=((cy+dy)*A.w+(cx+dx))*A.ch; if(isAmber(A.data[j],A.data[j+1],A.data[j+2])) n++; }
  if(n>380) found={cx,cy,n};
}
if(!found){console.log('no rank-1 disc found in the plot band');process.exit(0);}
console.log('rank-1 amber disc found at', JSON.stringify(found));
const cx=found.cx, cy=found.cy;
let whiteIn=[], amberIn=[];
for(let y=cy-14;y<=cy+14;y++)for(let x=cx-14;x<=cx+14;x++){ if(x<0||y<0||x>=A.w||y>=A.h) continue;
  const d=Math.hypot(x-cx,y-cy); if(d>12.5) continue;
  const j=(y*A.w+x)*A.ch;
  if(isWhite(A.data[j],A.data[j+1],A.data[j+2])) whiteIn.push([x,y]);
  if(isAmber(A.data[j],A.data[j+1],A.data[j+2])) amberIn.push([x,y]); }
console.log('inside the disc: amber px',amberIn.length,' near-white(label ink) px',whiteIn.length);
if(whiteIn.length){
  console.log('  label ink over disc: x',Math.min(...whiteIn.map(a=>a[0])),'-',Math.max(...whiteIn.map(a=>a[0])),
    ' y',Math.min(...whiteIn.map(a=>a[1])),'-',Math.max(...whiteIn.map(a=>a[1])));
  console.log('  => label ink starts', (Math.min(...whiteIn.map(a=>a[0])) - (cx+12.5)).toFixed(2), 'px LEFT of the disc edge');
}
