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
 const out=await p.evaluate(()=>{
   const s=document.querySelector('.sheet');
   const txt=s.textContent;
   const R=window.RADAR; const row=R.rows.find(r=>r.slug==='re7-labs');
   const present=row.chains.map(c=>({c, n:(txt.match(new RegExp(c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'))||[]).length}));
   return {present, drawerHasEllipsis:/\.\.\.|…/.test(txt), warn: s.querySelector('.warn')&&s.querySelector('.warn').textContent};
 });
 console.log(JSON.stringify(out,null,1));
 // any copy strings mentioning chains
 const copies=await p.evaluate(()=>{
   const c=(window.RADAR.copy)||{};
   return Object.keys(c).filter(k=>/chain/i.test(JSON.stringify(c[k]))).map(k=>[k,c[k]]);
 });
 console.log('copy mentioning chain:',JSON.stringify(copies));
 await b.close();
})();
