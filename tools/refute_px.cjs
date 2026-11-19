const fs=require('node:fs'),zlib=require('node:zlib');
function decodePNG(path){const buf=fs.readFileSync(path);let o=8,idat=[],ihdr=null;
while(o<buf.length){const len=buf.readUInt32BE(o),type=buf.toString('ascii',o+4,o+8),body=buf.slice(o+8,o+8+len);
if(type==='IHDR')ihdr=body;if(type==='IDAT')idat.push(body);o+=12+len;if(type==='IEND')break;}
const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ch=ihdr[9]===6?4:3;
const raw=zlib.inflateSync(Buffer.concat(idat)),stride=w*ch,out=Buffer.alloc(h*stride);let prev=Buffer.alloc(stride);
for(let y=0;y<h;y++){const ft=raw[y*(stride+1)],src=raw.slice(y*(stride+1)+1,(y+1)*(stride+1));const cur=Buffer.alloc(stride);
for(let x=0;x<stride;x++){const a=x>=ch?cur[x-ch]:0,b=prev[x],c=x>=ch?prev[x-ch]:0;let v;
if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+b;else if(ft===3)v=src[x]+((a+b)>>1);else{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);}
cur[x]=v&0xff;}cur.copy(out,y*stride);prev=cur;}
return {w,h,ch,data:out};}
const [src,X0,X1,Y0,Y1]=process.argv.slice(2);
const img=decodePNG(src);const x0=+X0,x1=+X1,y0=+Y0,y1=+Y1;
const px=(x,y)=>{const i=(y*img.w+x)*img.ch;return [img.data[i],img.data[i+1],img.data[i+2]];};
// background estimate: the mode of the region
const cnt=new Map();
for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const k=px(x,y).join(',');cnt.set(k,(cnt.get(k)||0)+1);}
let modal=null,mv=-1;for(const [k,v] of cnt)if(v>mv){mv=v;modal=k;}
const [mr,mg,mb]=modal.split(',').map(Number);
console.log('modal bg',modal,'count',mv,'of',(x1-x0)*(y1-y0));
for(let y=y0;y<y1;y++){let n=0,xs=[];
for(let x=x0;x<x1;x++){const [r,g,b]=px(x,y);if(Math.abs(r-mr)+Math.abs(g-mg)+Math.abs(b-mb)>40){n++;xs.push(x);}}
if(n)console.log('row',y,'ink',n,'x',xs[0],'..',xs[xs.length-1]);}
