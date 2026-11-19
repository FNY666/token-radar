// Does the shipped 2-detail.png's drawer show the chain-chip row?
// Method: render the CURRENT code's drawer at 1440x1200 at two scroll states
//   (A) scrolled to the farm plan (what shootscreens.cjs does)
//   (B) unscrolled (chip row + "Chains N" both in frame)
// and compare each against the SHIPPED image's drawer-top region.
const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path'),fs=require('node:fs'),zlib=require('node:zlib');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
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
function regionDiff(A,B,x0,x1,y0,y1){let n=0;
 for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*A.w+x)*4;
  if(A.px[i]!==B.px[i]||A.px[i+1]!==B.px[i+1]||A.px[i+2]!==B.px[i+2])n++;}
 return n+'/'+((x1-x0)*(y1-y0));}
(async()=>{
 const dir=process.argv[2]||'/home/muse-newapi/makefun-token-radar/work';
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--force-device-scale-factor=1','--hide-scrollbars','--allow-file-access-from-files']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:1440,deviceScaleFactor:1});
 await p.goto('file://'+path.join(dir,'out/dashboard/index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr');
 await p.evaluate(()=>{const rows=Array.from(document.querySelectorAll('tbody tr.row'));const t=rows.find(r=>r.querySelector('.pname')&&r.querySelector('.pname').textContent.indexOf('Gauntlet')!==-1)||rows[0];t.click();});
 await p.waitForSelector('.sheet',{visible:true});await new Promise(r=>setTimeout(r,250));
 // state A: scrolled to farm plan (shootscreens sequence), viewport 1200
 await p.evaluate(()=>{const sh=document.querySelector('.sheet');const st=sh.querySelector('.steps');if(st)sh.scrollTop=Math.max(0,st.offsetTop-90);});
 await p.setViewport({width:1440,height:1200,deviceScaleFactor:1});await new Promise(r=>setTimeout(r,250));
 await p.screenshot({path:'/tmp/zz-A.png'});
 // state B: unscrolled, same viewport
 await p.evaluate(()=>{document.querySelector('.sheet').scrollTop=0;});
 await new Promise(r=>setTimeout(r,250));
 await p.screenshot({path:'/tmp/zz-B.png'});
 await b.close();
 const S=decode('/home/muse-newapi/makefun-token-radar/work/screenshots/2-detail.png');
 const A=decode('/tmp/zz-A.png'), B=decode('/tmp/zz-B.png');
 for(const [nm,X] of [['A scrolled-to-plan',A],['B unscrolled',B]]){
  console.log(nm,'| drawer-top region (760-1440,0-260) diff vs shipped:',regionDiff(S,X,760,1440,0,260));
  console.log('        | drawer-mid region (760-1440,600-900) diff vs shipped:',regionDiff(S,X,760,1440,600,900));
 }
})().catch(e=>{console.error(e);process.exit(1)});
