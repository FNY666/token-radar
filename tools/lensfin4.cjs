const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 const p=await b.newPage(); await p.setViewport({width:1300,height:1000,deviceScaleFactor:1});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr.row');
 await p.evaluate(()=>{location.hash='#p=re7-labs';});
 await new Promise(r=>setTimeout(r,400));
 await p.screenshot({path:'/home/muse-newapi/makefun-token-radar/work/tools/_re7_top.png'});
 const info=await p.evaluate(()=>{
   const s=document.querySelector('.sheet');
   const chips=[...s.querySelectorAll('.chips')];
   const chainRow=chips.find(c=>[...c.children].some(x=>x.textContent.trim()==='World Chain'));
   const r=chainRow.getBoundingClientRect();
   // what is near the chip row? print parent structure
   return {chainRowHTML:chainRow.outerHTML, parentClass:chainRow.parentElement.className,
     rect:{t:Math.round(r.top),h:Math.round(r.height),w:Math.round(r.width)},
     sheetScrollTop:s.scrollTop, sheetH:s.clientHeight};
 });
 console.log(JSON.stringify(info,null,1));
 await b.close();
})();
