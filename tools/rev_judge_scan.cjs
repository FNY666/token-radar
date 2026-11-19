// Comprehensive: in the FRESH judge screenshot, map every pixel in the band around the
// rank-1 disc and identify the label's ink and the disc, then relate them.
const fs = require('node:fs'); const zlib = require('node:zlib');
function dec(p){const buf=fs.readFileSync(p);let o=8,idat=[],ihdr=null;while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),b=buf.subarray(o+8,o+8+len);if(t==='IHDR')ihdr=b;if(t==='IDAT')idat.push(b);o+=12+len;if(t==='IEND')break;}const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:ct==2?3:1,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(h*st);let prev=Buffer.alloc(st);for(let y=0;y<h;y++){const ft=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),cur=Buffer.alloc(st);for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,bb=prev[x],c=x>=ch?prev[x-ch]:0;let v;if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+bb;else if(ft===3)v=src[x]+((a+bb)>>1);else{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?bb:c;}cur[x]=v&255;}cur.copy(out,y*st);prev=cur;}return{w,h,ch,data:out};}
const A=dec(process.argv[2]);
const cx=636, cy=614, R=10;
// classify: bright ink (label, #e8edf4 -> 232,237,244); dim ink (antialiased); amber disc
let inkCore=[], inkDim=[], disc=[];
for(let y=cy-14;y<=cy+14;y++)for(let x=cx-14;x<=cx+80;x++){ const j=(y*A.w+x)*A.ch;
  const r=A.data[j],g=A.data[j+1],b=A.data[j+2];
  const isAmber = r>170&&g>115&&g<205&&b<145&&(r-b)>75;
  const isCore  = r>200&&g>210&&b>225;
  const isLight = r>110&&g>120&&b>130 && !(isAmber);
  if(isCore) inkCore.push([x,y]); else if(isLight) inkDim.push([x,y]);
  if(isAmber) disc.push([x,y]);
}
console.log('amber disc px',disc.length,'x',Math.min(...disc.map(a=>a[0])),'-',Math.max(...disc.map(a=>a[0])),'y',Math.min(...disc.map(a=>a[1])),'-',Math.max(...disc.map(a=>a[1])));
console.log('core ink px',inkCore.length, inkCore.length?('x '+Math.min(...inkCore.map(a=>a[0]))+'-'+Math.max(...inkCore.map(a=>a[0]))+' y '+Math.min(...inkCore.map(a=>a[1]))+'-'+Math.max(...inkCore.map(a=>a[1]))):'');
console.log('dim ink px',inkDim.length, inkDim.length?('x '+Math.min(...inkDim.map(a=>a[0]))+'-'+Math.max(...inkDim.map(a=>a[0]))+' y '+Math.min(...inkDim.map(a=>a[1]))+'-'+Math.max(...inkDim.map(a=>a[1]))):'');
// ASCII map
console.log('--- map: D=amber disc, #=core ink, +=dim ink, .=bg (x from cx-14) ---');
for(let y=cy-14;y<=cy+14;y++){ let line='';
  for(let x=cx-14;x<=cx+80;x++){ const j=(y*A.w+x)*A.ch; const r=A.data[j],g=A.data[j+1],b=A.data[j+2];
    const isAmber = r>170&&g>115&&g<205&&b<145&&(r-b)>75;
    const isCore  = r>200&&g>210&&b>225;
    const isLight = r>110&&g>120&&b>130 && !(isAmber);
    line += isCore?'#':(isAmber?'D':(isLight?'+':'.')); }
  console.log(String(y).padStart(4)+' '+line); }
