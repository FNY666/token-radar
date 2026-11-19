// Where (rows/cols) do the shipped 2-detail.png and a fresh render differ?
const fs=require('node:fs'),zlib=require('node:zlib');
function decode(p){const d=fs.readFileSync(p);let o=8,idat=null,ihdr=null;
 while(o<d.length){const len=d.readUInt32BE(o);const ty=d.toString('ascii',o+4,o+8);const body=d.slice(o+8,o+8+len);
  if(ty==='IHDR')ihdr=body; if(ty==='IDAT')idat=idat?Buffer.concat([idat,body]):body; if(ty==='IEND')break; o+=12+len;}
 const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:3,stride=w*ch;
 const raw=zlib.inflateSync(idat);const out=Buffer.alloc(stride*h);const prev=Buffer.alloc(stride),cur=Buffer.alloc(stride);
 const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
 for(let y=0;y<h;y++){const ft=raw[y*(stride+1)];const src=raw.slice(y*(stride+1)+1,y*(stride+1)+1+stride);
  for(let x=0;x<stride;x++){const a=x>=ch?cur[x-ch]:0,b=prev[x],c=x>=ch?prev[x-ch]:0;let v;
   if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+b;else if(ft===3)v=src[x]+((a+b)>>1);else if(ft===4)v=src[x]+paeth(a,b,c);else throw new Error('ft');
   cur[x]=v&255;} cur.copy(out,y*stride);cur.copy(prev);}
 const rgba=Buffer.alloc(w*h*4);for(let i=0,j=0;i<out.length;i+=3,j+=4){out.copy(rgba,j,i,i+3);rgba[j+3]=255;}
 return {w,h,px:rgba};}
const A=decode('/home/muse-newapi/makefun-token-radar/work/screenshots/2-detail.png');
const B=decode('/tmp/zz-2-opt.png');
let minC=1e9,maxC=-1,minR=1e9,maxR=-1,n=0;const rowsets={};
for(let y=0;y<A.h;y++)for(let x=0;x<A.w;x++){const i=(y*A.w+x)*4;
 if(A.px[i]!==B.px[i]||A.px[i+1]!==B.px[i+1]||A.px[i+2]!==B.px[i+2]){n++;if(x<minC)minC=x;if(x>maxC)maxC=x;if(y<minR)minR=y;if(y>maxR)maxR=y;rowsets[y]=(rowsets[y]||0)+1;}}
console.log('diff px',n,'cols',minC,'..',maxC,'rows',minR,'..',maxR);
const rs=Object.keys(rowsets).map(Number).sort((a,b)=>a-b);
console.log('rows with diffs:',rs.length,'first',rs.slice(0,5),'last',rs.slice(-5));
