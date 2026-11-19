const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr.row');
 const info=await p.evaluate(()=>{
   const sels=[...document.querySelectorAll('.controls select')];
   const desc=sels.map(s=>({n:s.options.length, first5:[...s.options].slice(0,4).map(o=>o.textContent),
     hasBerachain:[...s.options].some(o=>o.value==='Berachain'),
     hasSonic:[...s.options].some(o=>o.value==='Sonic'),
     hasTAC:[...s.options].some(o=>o.value==='TAC'),
     hasArc:[...s.options].some(o=>o.value==='Arc')}));
   return desc;
 });
 console.log(JSON.stringify(info,null,1));
 await b.close();
})();
