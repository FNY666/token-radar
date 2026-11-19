// Where exactly do the shipped screenshot and the current code disagree? Crop both.
const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path'),fs=require('node:fs');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--force-device-scale-factor=1','--hide-scrollbars','--allow-file-access-from-files']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:1200,deviceScaleFactor:1});
 await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr');
 await p.evaluate(()=>{const rows=Array.from(document.querySelectorAll('tbody tr.row'));const t=rows.find(r=>r.querySelector('.pname')&&r.querySelector('.pname').textContent.indexOf('Gauntlet')!==-1)||rows[0];t.click();});
 await p.waitForSelector('.sheet',{visible:true});await new Promise(r=>setTimeout(r,250));
 await p.evaluate(()=>{const sh=document.querySelector('.sheet');const st=sh.querySelector('.steps');if(st)sh.scrollTop=Math.max(0,st.offsetTop-90);});
 await new Promise(r=>setTimeout(r,200));
 await p.screenshot({path:'/tmp/zz-fresh-full.png'});
 await b.close();
})();
