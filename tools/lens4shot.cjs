const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 const p=await b.newPage();
 await p.setViewport({width:320,height:900,deviceScaleFactor:2});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'load'});
 await p.waitForSelector('tbody tr');
 await p.evaluate(()=>document.querySelector('tbody tr.row').click());
 await p.waitForSelector('.sheet');
 await new Promise(r=>setTimeout(r,250));
 await p.screenshot({path:'/tmp/kpi320.png',clip:{x:0,y:0,width:320,height:520}});
 await b.close(); console.log('ok');
})();
