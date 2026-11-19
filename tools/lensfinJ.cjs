const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 for (const vp of [{width:1440,height:900},{width:1440,height:800},{width:1280,height:720},{width:1024,height:768},{width:390,height:844}]) {
  const p=await b.newPage(); await p.setViewport(vp);
  await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'networkidle0'});
  await p.waitForSelector('tbody tr.row');
  await p.evaluate(()=>{location.hash='#p=re7-labs';});
  await new Promise(r=>setTimeout(r,400));
  const o=await p.evaluate(()=>{
   const s=document.querySelector('.sheet');
   const chip=[...s.querySelectorAll('.chips')].find(c=>[...c.children].length>2);
   const cl=[...s.querySelectorAll('.deriv > *')].find(x=>/^Chains/.test(x.textContent.trim()));
   const sr=s.getBoundingClientRect();
   const inFrame=e=>{const r=e.getBoundingClientRect(); return r.top>=sr.top && r.bottom<=sr.bottom;};
   const sheetH=s.clientHeight, sheetScroll=s.scrollHeight;
   return {chipIn:inFrame(chip), countIn:inFrame(cl), countText:cl.textContent.trim(),
     sheetH, sheetScroll, needScroll: sheetScroll>sheetH,
     label:cl.children[0].textContent, value:cl.children[1].textContent};
  });
  console.log(JSON.stringify(vp), JSON.stringify(o));
  await p.close();
 }
 await b.close();
})();
