const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files','--hide-scrollbars','--force-device-scale-factor=1','--disable-gpu']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:1300,deviceScaleFactor:1});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr.row');
 await p.evaluate(()=>{
   const rows=Array.from(document.querySelectorAll('tbody tr.row'));
   const t=rows.find(r=>r.querySelector('.pname')&&r.querySelector('.pname').textContent.indexOf('Gauntlet')!==-1)||rows[0];
   t.click();
 });
 await p.waitForSelector('.sheet',{visible:true});
 await new Promise(r=>setTimeout(r,250));
 await p.evaluate(()=>{const s=document.querySelector('.sheet');const st=s.querySelector('.steps'); if(st) s.scrollTop=Math.max(0,st.offsetTop-90);});
 await new Promise(r=>setTimeout(r,200));
 const v=await p.evaluate(()=>{
   const s=document.querySelector('.sheet');
   const chipRow=[...s.querySelectorAll('.chips')].find(c=>[...c.children].some(x=>x.textContent.trim()==='Base'));
   const chainsLine=[...s.querySelectorAll('.deriv > *')].find(x=>/^Chains/.test(x.textContent.trim()));
   const sr=s.getBoundingClientRect();
   const vis=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {top:Math.round(r.top),bottom:Math.round(r.bottom),inFrame:r.bottom>sr.top&&r.top<sr.bottom};};
   return {title:s.querySelector('h2').textContent, chip:vis(chipRow), chains:vis(chainsLine), chainsText:chainsLine&&chainsLine.textContent.trim(), scrollTop:s.scrollTop};
 });
 console.log('SHOT 2-detail viewport 1440x1300:',JSON.stringify(v));
 await b.close();
})();
