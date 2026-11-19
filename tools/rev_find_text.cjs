// Search the whole judge screenshot for a long light text run in the plot panel.
const fs = require('node:fs'); const zlib = require('node:zlib');
function dec(p){const buf=fs.readFileSync(p);let o=8,idat=[],ihdr=null;while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),b=buf.subarray(o+8,o+8+len);if(t==='IHDR')ihdr=b;if(t==='IDAT')idat.push(b);o+=12+len;if(t==='IEND')break;}const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:ct==2?3:1,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(h*st);let prev=Buffer.alloc(st);for(let y=0;y<h;y++){const ft=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),cur=Buffer.alloc(st);for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,bb=prev[x],c=x>=ch?prev[x-ch]:0;let v;if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+bb;else if(ft===3)v=src[x]+((a+bb)>>1);else{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?bb:c;}cur[x]=v&255;}cur.copy(out,y*st);prev=cur;}return{w,h,ch,data:out};}
const A=dec(process.argv[2]);
// For each row band, find runs of columns that contain a light-grey text pixel
// (the label uses --ink #e8edf4 = 232,237,244; the tick uses --i3 #8493a8; axis-title --i3)
const rowsOfInterest=[];
for(let y=560;y<660;y++){
  let runs=[],inR=false,s=0;
  for(let x=0;x<A.w;x++){ const j=(y*A.w+x)*A.ch; const r=A.data[j],g=A.data[j+1],b=A.data[j+2];
    const grey = r>110&&g>110&&b>110&&Math.abs(r-g)<25&&Math.abs(g-b)<35&&!(r>150&&b<130);
    if(grey && !inR){inR=true;s=x;} else if(!grey&&inR){inR=false;if(x-s>=6) runs.push([s,x-1]);} }
  if(inR&&A.w-s>=6) runs.push([s,A.w-1]);
  if(runs.length) rowsOfInterest.push([y,runs]);
}
for(const [y,runs] of rowsOfInterest) console.log('y='+y, JSON.stringify(runs));
