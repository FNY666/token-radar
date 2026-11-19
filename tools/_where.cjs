const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:1440});
 await p.goto('file://'+path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr'); await new Promise(x=>setTimeout(x,500));
 console.log(await p.evaluate(()=>{
   const g=s=>{const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect(); return {top:Math.round(r.top+window.scrollY), bottom:Math.round(r.bottom+window.scrollY)};};
   const rows=[...document.querySelectorAll('tbody tr.row')].slice(0,3).map(r=>Math.round(r.getBoundingClientRect().top+window.scrollY));
   return {h1:g('.hero h1'), lede:g('.hero p.lede'), plot:g('.plot'), table:g('table'), thead:g('thead'), firstRowsTop:rows, rowCount:document.querySelectorAll('tbody tr.row').length};
 }));
 await b.close();
})();
