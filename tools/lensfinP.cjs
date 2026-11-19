const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files','--hide-scrollbars','--disable-gpu','--force-device-scale-factor=1']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:1200,deviceScaleFactor:1});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr.row');
 await p.evaluate(()=>{
   const rows=Array.from(document.querySelectorAll('tbody tr.row'));
   const t=rows.find(r=>r.querySelector('.pname')&&r.querySelector('.pname').textContent.indexOf('Gauntlet')!==-1)||rows[0];
   t.click();
 });
 await p.waitForSelector('.sheet',{visible:true});
 await new Promise(r=>setTimeout(r,250));
 await p.evaluate(()=>{const s=document.querySelector('.sheet');const st=s.querySelector('.steps'); if(st) s.scrollTop=Math.max(0,st.offsetTop-90);});
 await new Promise(r=>setTimeout(r,200));
 await p.screenshot({path:'/tmp/ship2_detail.png'});
 await b.close();
})();
