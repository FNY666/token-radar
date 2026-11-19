// Does the proposed fix render, and does it shift the shipped 2-detail framing?
const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path'),fs=require('node:fs');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const dir=process.argv[2]||'/home/muse-newapi/makefun-token-radar/work';
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--force-device-scale-factor=1','--hide-scrollbars','--allow-file-access-from-files']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:1200,deviceScaleFactor:1});
 await p.goto('file://'+path.join(dir,'out/dashboard/index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr');
 await p.evaluate(()=>{const rows=Array.from(document.querySelectorAll('tbody tr.row'));const t=rows.find(r=>r.querySelector('.pname')&&r.querySelector('.pname').textContent.indexOf('Gauntlet')!==-1)||rows[0];t.click();});
 await p.waitForSelector('.sheet',{visible:true});await new Promise(r=>setTimeout(r,250));
 const before=await p.evaluate(()=>{const sh=document.querySelector('.sheet');const st=sh.querySelector('.steps');
  const chips=Array.from(sh.querySelectorAll('.chips')).find(c=>c.querySelectorAll('.chip-static').length>2);
  return {chipRowHeight:chips?Math.round(chips.getBoundingClientRect().height):null,
          chipTexts:chips?Array.from(chips.querySelectorAll('.chip-static')).map(c=>c.textContent):[],
          stepsOffsetTop:st?st.offsetTop:null, sheetScrollHeight:sh.scrollHeight};});
 console.log('BEFORE scroll:',JSON.stringify(before));
 await p.evaluate(()=>{const sh=document.querySelector('.sheet');const st=sh.querySelector('.steps');if(st)sh.scrollTop=Math.max(0,st.offsetTop-90);});
 await new Promise(r=>setTimeout(r,200));
 await p.screenshot({path:process.argv[3]||'/tmp/zz-fixshot.png'});
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
