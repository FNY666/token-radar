const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 for (const vp of [{width:1440,height:900},{width:1300,height:1300},{width:390,height:844}]) {
  const p=await b.newPage(); await p.setViewport(vp);
  await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'networkidle0'});
  await p.waitForSelector('tbody tr.row');
  await p.evaluate(()=>{location.hash='#p=re7-labs';});
  await new Promise(r=>setTimeout(r,400));
  const info=await p.evaluate(()=>{
    const s=document.querySelector('.sheet');
    const chainRow=[...s.querySelectorAll('.chips')].find(c=>[...c.children].some(x=>x.textContent.trim()==='World Chain'));
    const chainsLine=[...s.querySelectorAll('.deriv > *')].find(x=>/^Chains/.test(x.textContent.trim()));
    const sr=s.getBoundingClientRect();
    const vis=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {top:Math.round(r.top),vis:r.bottom>sr.top&&r.top<sr.bottom&&r.bottom<sr.bottom};};
    return {chain:vis(chainRow), chainsLine:vis(chainsLine), lineText:chainsLine&&chainsLine.textContent.trim(),
      sheetTop:Math.round(sr.top),sheetBottom:Math.round(sr.bottom), scrollTop:s.scrollTop};
  });
  console.log(JSON.stringify(vp), JSON.stringify(info));
  await p.close();
 }
 await b.close();
})();
