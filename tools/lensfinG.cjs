const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr.row');
 for (const slug of ['re7-labs','gauntlet','steer-protocol']) {
  await p.evaluate(s=>{location.hash='#p='+s;},slug);
  await new Promise(r=>setTimeout(r,400));
  const o=await p.evaluate(()=>{
   const s=document.querySelector('.sheet');
   const chip=[...s.querySelectorAll('.chips')].find(c=>[...c.children].length>2);
   const cl=[...s.querySelectorAll('.deriv > *')].find(x=>/^Chains/.test(x.textContent.trim()));
   const sheetKids=[...s.children].map(c=>c.tagName+'.'+c.className);
   const cr=chip.getBoundingClientRect(), lr=cl.getBoundingClientRect();
   return {sheetKids, chipY:Math.round(cr.top), chainLineY:Math.round(lr.top), chainText:cl.textContent.trim(),
     chipsShown:chip.children.length, chipAboveChainLine: cr.top<lr.top};
  });
  console.log(slug, JSON.stringify(o));
 }
 await b.close();
})();
