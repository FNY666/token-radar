// What text sits at the first differing rows of the committed vs rendered board shot?
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/home/muse-newapi/makefun-token-radar/tools/');
const puppeteer = require('puppeteer');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const b64=p=>'data:image/png;base64,'+fs.readFileSync(p).toString('base64');
const browser=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage();
const out=await page.evaluate(async(da,db)=>{
  const load=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});
  const A=await load(da), B=await load(db);
  const w=A.width,h=A.height;
  const grab=async(img)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.drawImage(img,0,0);return x.getImageData(0,0,w,h).data;};
  const pa=await grab(A), pb=await grab(B);
  const rows=[];
  for(let y=0;y<h;y++){let n=0;for(let x=0;x<w;x++){const i=(y*w+x)*4;if(pa[i]!==pb[i]||pa[i+1]!==pb[i+1]||pa[i+2]!==pb[i+2])n++;} if(n>0)rows.push([y,n]);}
  // summarise contiguous bands
  const bands=[]; let cur=null;
  for(const [y,n] of rows){ if(!cur||y>cur.end+1){cur={start:y,end:y,max:n};bands.push(cur);} else {cur.end=y;cur.max=Math.max(cur.max,n);} }
  return bands.map(b=>`rows ${b.start}-${b.end} (${b.end-b.start+1} rows, max ${b.max} px wide)`);
}, b64('/tmp/head-1o.png'), b64('/home/muse-newapi/makefun-token-radar/work/screenshots/1-board.png'));
console.log(out.join('\n'));
await browser.close();
