const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr.row');
 await p.evaluate(()=>{location.hash='#p=re7-labs';});
 await new Promise(r=>setTimeout(r,400));
 const o=await p.evaluate(()=>{
   const s=document.querySelector('.sheet');
   // full ordered walk of the sheet's top-level children with their y
   return [...s.children].map((c,i)=>({i, tag:c.tagName, cls:c.className,
     txt:c.textContent.trim().slice(0,60), y:Math.round(c.getBoundingClientRect().top)}));
 });
 console.log(JSON.stringify(o,null,1));
 await b.close();
})();
