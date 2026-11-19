const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:1440});
 await p.goto('file://'+path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr'); await new Promise(x=>setTimeout(x,400));
 const r=await p.evaluate(()=>{
  const fs=s=>{const e=document.querySelector(s); return e?getComputedStyle(e).fontSize:null;};
  const row=document.querySelector('tbody tr.row');
  const cell=row?getComputedStyle(row.querySelector('td')).fontSize:null;
  return {h1:fs('.hero h1'), lede:fs('.hero p.lede'), thead:fs('thead th'), bodyCell:cell,
    pname:fs('.pname'), val:fs('.val'), cat:fs('.cat'), slug:fs('.pname .slug'), brand:fs('.brand-name')};
 });
 console.log(r);
 const cov=0.444444, sheet=0.354167;
 for(const [k,v] of Object.entries(r)){ if(!v) continue; const px=parseFloat(v); console.log(`${k}: css ${v} -> cover ${(px*cov).toFixed(2)}px, sheet ${(px*sheet).toFixed(2)}px`);}
 await b.close();
})();
