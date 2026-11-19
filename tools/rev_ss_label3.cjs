// Locate the label's ink in the judge screenshot and measure it against the disc.
const fs = require('node:fs'); const zlib = require('node:zlib');
function dec(p){const buf=fs.readFileSync(p);let o=8,idat=[],ihdr=null;while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),b=buf.subarray(o+8,o+8+len);if(t==='IHDR')ihdr=b;if(t==='IDAT')idat.push(b);o+=12+len;if(t==='IEND')break;}const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:ct==2?3:1,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(h*st);let prev=Buffer.alloc(st);for(let y=0;y<h;y++){const ft=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),cur=Buffer.alloc(st);for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,bb=prev[x],c=x>=ch?prev[x-ch]:0;let v;if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+bb;else if(ft===3)v=src[x]+((a+bb)>>1);else{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?bb:c;}cur[x]=v&255;}cur.copy(out,y*st);prev=cur;}return{w,h,ch,data:out};}
const A=dec(process.argv[2]);
// the label fill is --ink #e8edf4 = 232,237,244; the panel bg is #151d2c.
// Use "much brighter than the panel AND brighter than any amber" -> r>200 && b>150
const isInk=(r,g,b)=>r>195&&g>205&&b>225;
// find the row band of the rank-1 disc (636,619) and scan right for the label
const discCx=636, discCy=619;
let cols=[];
for(let x=discCx-16;x<discCx+220;x++){ let n=0;
  for(let y=discCy-8;y<=discCy+8;y++){ const j=(y*A.w+x)*A.ch; if(isInk(A.data[j],A.data[j+1],A.data[j+2])) n++; }
  if(n) cols.push([x,n]); }
console.log('ink columns from', cols.length?cols[0][0]:'-', 'to', cols.length?cols[cols.length-1][0]:'-');
console.log(cols.map(c=>c[0]+'('+c[1]+')').join(' '));
