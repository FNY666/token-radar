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
   const peers=s.querySelector('.peers');
   const R=window.RADAR;
   const row=R.rows.find(r=>r.slug==='re7-labs');
   const totalPeers=R.rows.filter(r=>r.slug!=='re7-labs'&&(r.category||'Other')===(row.category||'Other')).length;
   return {peersHeading: peers&&peers.previousElementSibling&&peers.previousElementSibling.textContent,
     peersShown: peers?peers.children.length:0, totalPeers,
     peersHTML: peers&&peers.outerHTML.slice(0,400)};
 });
 console.log(JSON.stringify(out,null,1));
 await b.close();
})();
