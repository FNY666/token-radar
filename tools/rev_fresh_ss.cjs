// In the FRESH build's judge screenshot: locate the rank-1 amber disc (largest radius) and
// count near-white label-ink pixels inside it.
const fs = require('node:fs'); const zlib = require('node:zlib');
function dec(p){const buf=fs.readFileSync(p);let o=8,idat=[],ihdr=null;while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),b=buf.subarray(o+8,o+8+len);if(t==='IHDR')ihdr=b;if(t==='IDAT')idat.push(b);o+=12+len;if(t==='IEND')break;}const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:ct===2?3:1,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(h*st);let prev=Buffer.alloc(st);for(let y=0;y<h;y++){const ft=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),cur=Buffer.alloc(st);for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,bb=prev[x],c=x>=ch?prev[x-ch]:0;let v;if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+bb;else if(ft===3)v=src[x]+((a+bb)>>1);else{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?bb:c;}cur[x]=v&255;}cur.copy(out,y*st);prev=cur;}return{w,h,ch,data:out};}
const A=dec(process.argv[2]);
console.log(process.argv[2], A.w,'x',A.h);
const isAmber=(r,g,b)=>r>170&&g>120&&g<200&&b<130&&r-b>80;
const isWhite=(r,g,b)=>r>195&&g>205&&b>215;
// candidate discs in the plot band: count amber in a disc of radius R, maximize R
let best=null;
for(let cy=540;cy<700;cy++)for(let cx=300;cx<800;cx++){
  const i=(cy*A.w+cx)*A.ch; if(!isAmber(A.data[i],A.data[i+1],A.data[i+2])) continue;
  for(const R of [10,11,12,13]){ let n=0; for(let dy=-R;dy<=R;dy++)for(let dx=-R;dx<=R;dx++){ if(dx*dx+dy*dy>R*R) continue;
    const j=((cy+dy)*A.w+(cx+dx))*A.ch; if(isAmber(A.data[j],A.data[j+1],A.data[j+2])) n++; }
    if(n > Math.PI*R*R*0.75) { best={cx,cy,R,n}; break; } }
  if(best) break;
}
if(!best){console.log('no large amber disc found');process.exit(0);}
console.log('rank-1 amber disc:', JSON.stringify(best));
const {cx,cy,R}=best;
let whiteIn=0, amberIn=0, whiteLocs=[];
for(let y=cy-R-2;y<=cy+R+2;y++)for(let x=cx-R-2;x<=cx+R+2;x++){ if(x<0||y<0||x>=A.w||y>=A.h) continue;
  if(Math.hypot(x-cx,y-cy)>R) continue;
  const j=(y*A.w+x)*A.ch;
  if(isWhite(A.data[j],A.data[j+1],A.data[j+2])) {whiteIn++; whiteLocs.push([x,y]);}
  else if(isAmber(A.data[j],A.data[j+1],A.data[j+2])) amberIn++; }
console.log('inside the disc: amber px',amberIn,' near-white label-ink px',whiteIn);
if(whiteIn) console.log('  ink over disc: x',Math.min(...whiteLocs.map(a=>a[0])),'-',Math.max(...whiteLocs.map(a=>a[0])),
  ' y',Math.min(...whiteLocs.map(a=>a[1])),'-',Math.max(...whiteLocs.map(a=>a[1])));
// first white label column to the right of the disc
for(let x=cx+R; x<cx+R+40; x++){ let n=0; for(let y=cy-7;y<=cy+7;y++){const j=(y*A.w+x)*A.ch; if(isWhite(A.data[j],A.data[j+1],A.data[j+2])) n++;}
  if(n>=1){ console.log('first label-ink column right of the disc:', x, '(disc right edge', cx+R, ', overlap', cx+R-x+1, 'px)'); break; } }
