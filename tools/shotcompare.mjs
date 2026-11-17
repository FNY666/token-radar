// Render the HEAD dashboard and the WORKING dashboard, and compare against the COMMITTED screenshot.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/home/muse-newapi/makefun-token-radar/tools/');
const puppeteer = require('puppeteer');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const WORK='/home/muse-newapi/makefun-token-radar/work';
const browser = await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1']});
async function shoot(dashDir, outPng, w, h){
  const tmp='/tmp/shoot_'+Math.random().toString(36).slice(2);
  fs.mkdirSync(tmp+'/dashboard',{recursive:true});
  for(const f of fs.readdirSync(dashDir)) fs.copyFileSync(dashDir+'/'+f, tmp+'/dashboard/'+f);
  fs.copyFileSync('/tmp/r1/data.js', tmp+'/data.js');
  const page=await browser.newPage();
  await page.setViewport({width:w,height:h,deviceScaleFactor:1});
  await page.goto('file://'+tmp+'/dashboard/index.html',{waitUntil:'networkidle0'});
  await page.waitForSelector('tbody tr');
  await new Promise(r=>setTimeout(r,250));
  await page.screenshot({path:outPng});
  await page.close();
  fs.rmSync(tmp,{recursive:true,force:true});
}
await shoot('/tmp/head-dash','/tmp/head-1-board.png',1440,1440);
await shoot(WORK+'/dashboard','/tmp/work-1-board.png',1440,1440);
// compare the rendered TEXT of the board between HEAD and WORKING
async function text(dashDir){
  const tmp='/tmp/text_'+Math.random().toString(36).slice(2);
  fs.mkdirSync(tmp+'/dashboard',{recursive:true});
  for(const f of fs.readdirSync(dashDir)) fs.copyFileSync(dashDir+'/'+f, tmp+'/dashboard/'+f);
  fs.copyFileSync('/tmp/r1/data.js', tmp+'/data.js');
  const page=await browser.newPage();
  await page.setViewport({width:1440,height:1200,deviceScaleFactor:1});
  await page.goto('file://'+tmp+'/dashboard/index.html',{waitUntil:'networkidle0'});
  await page.waitForSelector('tbody tr');
  const t=await page.evaluate(()=>{
    const o=[];
    o.push(document.querySelector('#hero').innerText.replace(/\s+/g,' '));
    o.push(document.querySelector('#bar-meta').innerText.replace(/\s+/g,' '));
    for(const r of document.querySelectorAll('tbody tr')) o.push(r.innerText.replace(/\s+/g,' '));
    return o.join('\n');
  });
  await page.close(); fs.rmSync(tmp,{recursive:true,force:true});
  return t;
}
const a=await text('/tmp/head-dash'), b=await text(WORK+'/dashboard');
console.log('board text HEAD vs WORKING identical:', a===b);
if(a!==b){const A=a.split('\n'),B=b.split('\n');for(let i=0;i<Math.max(A.length,B.length);i++) if(A[i]!==B[i]){console.log('first diff line',i);console.log('HEAD:',A[i]);console.log('WORK:',B[i]);break;}}
fs.writeFileSync('/tmp/head-text.txt',a); fs.writeFileSync('/tmp/work-text.txt',b);
await browser.close();
