// Does the judge's own artifact (screenshots/1-board.png) show a label next to the rank-1 dot?
const fs = require('node:fs'); const zlib = require('node:zlib');
function dec(p){const buf=fs.readFileSync(p);let o=8,idat=[],ihdr=null;while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),b=buf.subarray(o+8,o+8+len);if(t==='IHDR')ihdr=b;if(t==='IDAT')idat.push(b);o+=12+len;if(t==='IEND')break;}const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:ct==2?3:1,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(h*st);let prev=Buffer.alloc(st);for(let y=0;y<h;y++){const ft=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),cur=Buffer.alloc(st);for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,bb=prev[x],c=x>=ch?prev[x-ch]:0;let v;if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+bb;else if(ft===3)v=src[x]+((a+bb)>>1);else{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?bb:c;}cur[x]=v&255;}cur.copy(out,y*st);prev=cur;}return{w,h,ch,data:out};}
const A=dec(process.argv[2]);
// dump actual RGB on the label's rows to the right of the disc
console.log('raw pixels, judge screenshot rows 610-618, x 640-700:');
for(let y=610;y<=618;y+=4){ let row=[];
  for(let x=640;x<=700;x+=6){ const j=(y*A.w+x)*A.ch; row.push(x+':'+A.data[j]+','+A.data[j+1]+','+A.data[j+2]); }
  console.log(' y='+y, row.join('  ')); }
// Any pixel in the whole image matching the label ink #e8edf4 exactly?
let exact=0, minx=1e9,maxx=-1,miny=1e9,maxy=-1;
for(let y=560;y<680;y++)for(let x=0;x<A.w;x++){ const j=(y*A.w+x)*A.ch;
  if(A.data[j]===232&&A.data[j+1]===237&&A.data[j+2]===244){ exact++; minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y);} }
console.log('pixels exactly #e8edf4 (label ink) in y 560-680:', exact, exact?('bbox x '+minx+'-'+maxx+' y '+miny+'-'+maxy):'');
