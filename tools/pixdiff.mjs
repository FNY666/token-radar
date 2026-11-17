// Pixel-level diff of two PNGs, via a headless canvas (no extra deps).
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/home/muse-newapi/makefun-token-radar/tools/');
const puppeteer = require('puppeteer');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const b64=p=>'data:image/png;base64,'+fs.readFileSync(p).toString('base64');
const browser=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage();
async function diff(a,b){
  return await page.evaluate(async(da,db)=>{
    const load=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});
    const A=await load(da), B=await load(db);
    if(A.width!==B.width||A.height!==B.height) return {sizeMismatch:[A.width,A.height,B.width,B.height]};
    const w=A.width,h=A.height;
    const ca=document.createElement('canvas'); ca.width=w; ca.height=h; const xa=ca.getContext('2d');
    xa.drawImage(A,0,0); const pa=xa.getImageData(0,0,w,h).data;
    const cb=document.createElement('canvas'); cb.width=w; cb.height=h; const xb=cb.getContext('2d');
    xb.drawImage(B,0,0); const pb=xb.getImageData(0,0,w,h).data;
    let n=0; const rows=new Set();
    for(let i=0;i<pa.length;i+=4){ if(pa[i]!==pb[i]||pa[i+1]!==pb[i+1]||pa[i+2]!==pb[i+2]){n++; rows.add(Math.floor((i/4)/w));} }
    return {w,h,diffPixels:n,total:w*h,pct:+(100*n/(w*h)).toFixed(3),rowsAffected:rows.size,firstRows:[...rows].slice(0,8)};
  }, b64(a), b64(b));
}
console.log('1-board  ', JSON.stringify(await diff('/tmp/head-1o.png','/home/muse-newapi/makefun-token-radar/work/screenshots/1-board.png')));
console.log('2-detail ', JSON.stringify(await diff('/tmp/head-2o.png','/home/muse-newapi/makefun-token-radar/work/screenshots/2-detail.png')));
await browser.close();
