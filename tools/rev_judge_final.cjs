// THE JUDGE'S ARTIFACT: screenshots/1-board.png.
// Find the rank-1 amber disc and the label's first ink pixel, restricted to the disc's rows.
const fs = require('node:fs'); const zlib = require('node:zlib');
function dec(p){const buf=fs.readFileSync(p);let o=8,idat=[],ihdr=null;while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),b=buf.subarray(o+8,o+8+len);if(t==='IHDR')ihdr=b;if(t==='IDAT')idat.push(b);o+=12+len;if(t==='IEND')break;}const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:ct==2?3:1,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(h*st);let prev=Buffer.alloc(st);for(let y=0;y<h;y++){const ft=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),cur=Buffer.alloc(st);for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,bb=prev[x],c=x>=ch?prev[x-ch]:0;let v;if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+bb;else if(ft===3)v=src[x]+((a+bb)>>1);else{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?bb:c;}cur[x]=v&255;}cur.copy(out,y*st);prev=cur;}return{w,h,ch,data:out};}
const A=dec(process.argv[2]);
const isAmber=(r,g,b)=>r>160&&g>105&&g<205&&b<145&&(r-b)>70;
const isInk=(r,g,b)=>r>150&&g>160&&b>175 && !(r>140&&b<130&&g<r); // light, not amber
// the disc: rows 605..621, x 600..680
let discMaxX=-1, discMinX=1e9;
for(let y=605;y<=621;y++)for(let x=600;x<=690;x++){ const j=(y*A.w+x)*A.ch;
  if(isAmber(A.data[j],A.data[j+1],A.data[j+2])) { if(x>discMaxX)discMaxX=x; if(x<discMinX)discMinX=x; } }
console.log('rank-1 disc (rows 605-621): x', discMinX, '-', discMaxX, ' right edge', discMaxX);
// light ink columns in those rows, right of the disc
let cols=[];
for(let x=discMaxX-6;x<=discMaxX+40;x++){ let n=0, samples=[];
  for(let y=605;y<=621;y++){ const j=(y*A.w+x)*A.ch; const r=A.data[j],g=A.data[j+1],b=A.data[j+2];
    if(isInk(r,g,b) && !isAmber(r,g,b)) { n++; if(samples.length<3) samples.push(r+','+g+','+b); } }
  cols.push([x,n,samples]); }
cols.forEach(([x,n,s])=>console.log('  x='+x, 'lightInk='+n, s.join(' | ')));
