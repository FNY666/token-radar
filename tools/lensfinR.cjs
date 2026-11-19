const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr.row');
 // the chain filter's option list
 const opts=await p.evaluate(()=>{
   const sels=document.querySelectorAll('.controls select');
   const chainSel=[...sels].find(s=>[...s.options].some(o=>o.textContent==='Ethereum')||s.options.length>5);
   return {selects:sels.length, chainOptions:[...chainSel.options].map(o=>o.textContent)};
 });
 console.log('chain filter options count:',opts.chainOptions.length);
 console.log('has Berachain:',opts.chainOptions.includes('Berachain'),'has Sonic:',opts.chainOptions.includes('Sonic'),'has TAC:',opts.chainOptions.includes('TAC'));
 // select Berachain and confirm Re7 Labs survives
 await p.evaluate(()=>{
   const sels=document.querySelectorAll('.controls select');
   let target=null;
   for (const s of sels) { for (const o of s.options) if (o.value==='Berachain') { target=s; break; } if(target) break; }
   target.value='Berachain'; target.dispatchEvent(new Event('change'));
 });
 await new Promise(r=>setTimeout(r,400));
 const rows=await p.evaluate(()=>[...document.querySelectorAll('tbody tr.row .pname')].map(e=>e.textContent.trim()));
 console.log('rows under chain=Berachain:',rows.length,'contains Re7 Labs:',rows.some(r=>/Re7/.test(r)));
 await b.close();
})();
