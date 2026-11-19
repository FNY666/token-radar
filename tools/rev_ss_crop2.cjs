// crop a region of a PNG and write it back out (re-encode)
const fs = require('node:fs'); const zlib = require('node:zlib');
function dec(p){const buf=fs.readFileSync(p);let o=8,idat=[],ihdr=null;while(o<buf.length){const len=buf.readUInt32BE(o),t=buf.toString('ascii',o+4,o+8),b=buf.subarray(o+8,o+8+len);if(t==='IHDR')ihdr=b;if(t==='IDAT')idat.push(b);o+=12+len;if(t==='IEND')break;}const w=ihdr.readUInt32BE(0),h=ihdr.readUInt32BE(4),ct=ihdr[9],ch=ct===6?4:ct===2?3:1,raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,out=Buffer.alloc(h*st);let prev=Buffer.alloc(st);for(let y=0;y<h;y++){const ft=raw[y*(st+1)],src=raw.subarray(y*(st+1)+1,y*(st+1)+1+st),cur=Buffer.alloc(st);for(let x=0;x<st;x++){const a=x>=ch?cur[x-ch]:0,bb=prev[x],c=x>=ch?prev[x-ch]:0;let v;if(ft===0)v=src[x];else if(ft===1)v=src[x]+a;else if(ft===2)v=src[x]+bb;else if(ft===3)v=src[x]+((a+bb)>>1);else{const p=a+bb-c,pa=Math.abs(p-a),pb=Math.abs(p-bb),pc=Math.abs(p-c);v=(pa<=pb&&pa<=pc)?a:(pb<=pc)?bb:c;}cur[x]=v&255;}cur.copy(out,y*st);prev=cur;}return{w,h,ch,data:out};}
function crc32(buf){let c,crc=0xFFFFFFFF;for(let n=0;n<buf.length;n++){c=(crc^buf[n])&0xff;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crc=(crc>>>8)^c;}return (crc^0xFFFFFFFF)>>>0;}
function chunk(t,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t,'ascii'),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc32(td));return Buffer.concat([l,td,c]);}
function writePNG(path,w,h,rgb){const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;
 const raw=Buffer.alloc(h*(w*3+1));for(let y=0;y<h;y++){rgb.copy(raw,y*(w*3+1)+1,y*w*3,(y+1)*w*3);}
 fs.writeFileSync(path,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));}
const A=dec(process.argv[2]);
const x0=+process.argv[4],y0=+process.argv[5],cw=+process.argv[6],chh=+process.argv[7],S=+(process.argv[8]||6);
const ow=cw*S, oh=chh*S, out=Buffer.alloc(ow*oh*3);
for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){const sx=x0+Math.floor(x/S),sy=y0+Math.floor(y/S);const i=(sy*A.w+sx)*A.ch,o=(y*ow+x)*3;
 out[o]=A.data[i];out[o+1]=A.data[i+1];out[o+2]=A.data[i+2];}
writePNG(process.argv[3],ow,oh,out);
console.log('wrote',process.argv[3],ow,'x',oh,'from',process.argv[2],'at',x0,y0,cw,chh,'scale',S);
