// Crop a band from two PNGs side by side so a human can see the difference.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/home/muse-newapi/makefun-token-radar/tools/');
const puppeteer = require('puppeteer');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const b64=p=>'data:image/png;base64,'+fs.readFileSync(p).toString('base64');
const browser=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage();
const out=await page.evaluate(async(da,db,y0,y1)=>{
  const load=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src;});
  const A=await load(da), B=await load(db);
  const W=A.width, H=y1-y0;
  const c=document.createElement('canvas'); c.width=W; c.height=H*2+12;
  const x=c.getContext('2d');
  x.fillStyle='#f00'; x.fillRect(0,0,W,H*2+12);
  x.drawImage(A,0,0,W,H,0,0,W,H);
  x.drawImage(B,0,0,W,H,0,H+12,W,H);
  return c.toDataURL('image/png');
}, b64('/tmp/head-1o.png'), b64('/home/muse-newapi/makefun-token-radar/work/screenshots/1-board.png'), 155, 260);
fs.writeFileSync('/tmp/crop.png', Buffer.from(out.split(',')[1],'base64'));
await browser.close();
console.log('crop written: TOP = rendered from HEAD code, BOTTOM = the committed screenshot');
