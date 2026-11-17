// Pixel-compare the COMMITTED screenshots against a fresh render of the COMMITTED dashboard.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire('/home/muse-newapi/makefun-token-radar/tools/');
const puppeteer = require('puppeteer');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const WORK='/home/muse-newapi/makefun-token-radar/work';
// The build that produced the committed screenshots: rebuild from HEAD's dashboard into a temp out.
const head=' /tmp/head-dash';
fs.rmSync('/tmp/headout',{recursive:true,force:true});
fs.mkdirSync('/tmp/headout/dashboard',{recursive:true});
for(const f of fs.readdirSync('/tmp/head-dash')) fs.copyFileSync('/tmp/head-dash/'+f,'/tmp/headout/dashboard/'+f);
// data.js from the current build (the model is unchanged by the page.js edit)
fs.copyFileSync('/tmp/r1/data.js','/tmp/headout/data.js');
const browser = await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1']});
async function shoot(url,out,w,h,prep){
  const page=await browser.newPage();
  await page.setViewport({width:w,height:h,deviceScaleFactor:1});
  await page.goto(url,{waitUntil:'networkidle0'});
  await page.waitForSelector('tbody tr');
  if(prep) await prep(page);
  await new Promise(r=>setTimeout(r,250));
  await page.screenshot({path:out});
  await page.close();
}
const U='file:///tmp/headout/dashboard/index.html';
await shoot(U,'/tmp/head-1.png',1440,1440);
await shoot(U,'/tmp/head-2.png',1200,1220, async(page)=>{
  await page.evaluate(()=>{const rows=Array.from(document.querySelectorAll('tbody tr.row'));const t=rows.find(r=>r.querySelector('.pname')&&r.querySelector('.pname').textContent.indexOf('Gauntlet')!==-1)||rows[0];t.click();});
  await page.waitForSelector('.sheet',{visible:true});
  await new Promise(r=>setTimeout(r,250));
  await page.evaluate(()=>{const s=document.querySelector('.sheet');const st=s.querySelector('.steps');if(st)s.scrollTop=Math.max(0,st.offsetTop-90);});
  await new Promise(r=>setTimeout(r,200));
});
await browser.close();
// compare with the committed PNGs via a pixel dump
for (const [a,b,label] of [['/tmp/head-1.png', WORK+'/screenshots/1-board.png','1-board'],
                            ['/tmp/head-2.png', WORK+'/screenshots/2-detail.png','2-detail']]) {
  const A=fs.readFileSync(a), B=fs.readFileSync(b);
  console.log(label, 'render bytes', A.length, 'committed bytes', B.length, 'identical bytes:', A.equals(B));
}
