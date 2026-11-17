// Do the entry's COMMITTED screenshots match what the current source renders?
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire('/home/muse-newapi/makefun-token-radar/tools/');
const puppeteer = require('puppeteer');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';

async function renderFrom(dashDir, outDir, label){
  // build a temp output dir whose dashboard/ is the given source, and data.js from the current build
  fs.mkdirSync(outDir+'/dashboard',{recursive:true});
  fs.mkdirSync(outDir+'/screenshots',{recursive:true});
  fs.copyFileSync('/tmp/r1/data.js', outDir+'/data.js');
  for(const f of fs.readdirSync(dashDir)) fs.copyFileSync(dashDir+'/'+f, outDir+'/dashboard/'+f);
  execFileSync('node',['tools/shootscreens.cjs',outDir,outDir+'/screenshots'],{cwd:'/home/muse-newapi/makefun-token-radar/work'});
}
const browser = await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1']});
async function shotOf(dashDir, dataJs, outPng, w, h, prep){
  const tmp='/tmp/shotone'; fs.mkdirSync(tmp+'/dashboard',{recursive:true});
  for(const f of fs.readdirSync(dashDir)) fs.copyFileSync(dashDir+'/'+f, tmp+'/dashboard/'+f);
  fs.copyFileSync(dataJs, tmp+'/data.js');
  const page=await browser.newPage();
  await page.setViewport({width:w,height:h,deviceScaleFactor:1});
  await page.goto('file://'+tmp+'/dashboard/index.html',{waitUntil:'networkidle0'});
  await page.waitForSelector('tbody tr');
  if(prep) await prep(page);
  await new Promise(r=>setTimeout(r,250));
  await page.screenshot({path:outPng});
  await page.close();
}
const WORK='/home/muse-newapi/makefun-token-radar/work';
// 1-board: 1440x1440
await shotOf(WORK+'/dashboard', '/tmp/r1/data.js', '/tmp/cur-1-board.png', 1440, 1440);
console.log('rendered current 1-board.png');
await browser.close();
