const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 for(const W of [320,360,419,420,421,440,480,560,640,768]){
  const p=await b.newPage(); await p.setViewport({width:W,height:800});
  await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'load'});
  await p.waitForSelector('tbody tr');
  await p.evaluate(()=>{const tr=[...document.querySelectorAll('tbody tr.row')].find(t=>t.textContent.indexOf('Steakhouse')>=0); tr.click();});
  await p.waitForSelector('.sheet'); await new Promise(x=>setTimeout(x,150));
  const res=await p.evaluate(()=>{
    const s=document.querySelector('.sheet'); const sr=s.getBoundingClientRect();
    return {sheet:{l:Math.round(sr.left),r:Math.round(sr.right),sw:s.scrollWidth,cw:s.clientWidth},
      kpis:[...document.querySelectorAll('.kpi')].map(k=>{const kr=k.getBoundingClientRect();const v=k.querySelector('.v');const vr=v.getBoundingClientRect();
        return {t:v.textContent, cellR:Math.round(kr.right), vR:Math.round(vr.right), cellL:Math.round(kr.left), vL:Math.round(vr.left),
          overCell: Math.round(vr.right)>Math.round(kr.right), overSheet: Math.round(vr.right)>Math.round(sr.right), sw:k.scrollWidth, cw:k.clientWidth};})};
  });
  const bad=res.kpis.filter(k=>k.overCell||k.overSheet);
  console.log(`W=${W} sheet[l=${res.sheet.l} r=${res.sheet.r} sw=${res.sheet.sw} cw=${res.sheet.cw}] overflowCells=${bad.length} ${JSON.stringify(bad)}`);
  await p.close();
 }
 await b.close();
})();
