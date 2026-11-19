const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'load'});
 await p.waitForSelector('tbody tr');
 await p.evaluate(()=>{location.hash='#p=re7-labs';});
 await new Promise(r=>setTimeout(r,300));
 const full=await p.evaluate(()=>{
   const sh=document.querySelector('.sheet');
   const chainRow=[...sh.querySelectorAll('.chips')].find(c=>[...c.children].some(x=>x.textContent.trim()==='World Chain'));
   return {
     text: sh.textContent,
     chainRowOuter: chainRow?chainRow.outerHTML:null,
     chainRowAttrs: chainRow?chainRow.getAttributeNames():null,
     chipTitles: chainRow?[...chainRow.children].map(x=>x.getAttribute('title')):null,
     ariaLabels: chainRow?[...chainRow.children].map(x=>x.getAttribute('aria-label')):null
   };
 });
 console.log(full.text);
 console.log('---- chain row outer ----');
 console.log(full.chainRowOuter);
 console.log('---- titles ----', JSON.stringify(full.chipTitles));
 console.log('---- aria ----', JSON.stringify(full.ariaLabels));
 await b.close();
})();
