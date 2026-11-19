const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const DIR='/tmp/cfshots';
fs.mkdirSync(DIR,{recursive:true});
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files','--hide-scrollbars','--force-device-scale-factor=1']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr'); await new Promise(x=>setTimeout(x,300));
 await p.screenshot({path:DIR+'/1-board.png'});
 // detail
 await p.evaluate(()=>{const rows=[...document.querySelectorAll('tbody tr.row')];const t=rows.find(r=>r.textContent.indexOf('Gauntlet')>=0)||rows[0];t.click();});
 await p.waitForSelector('.sheet',{visible:true}); await new Promise(x=>setTimeout(x,250));
 await p.evaluate(()=>{const s=document.querySelector('.sheet');const st=s.querySelector('.steps');if(st)s.scrollTop=Math.max(0,st.offsetTop-90);});
 await new Promise(x=>setTimeout(x,200));
 await p.screenshot({path:DIR+'/2-detail.png'});
 await p.evaluate(()=>document.querySelector('.drawer .close').click()); await new Promise(x=>setTimeout(x,150));
 // filtered
 await p.evaluate(()=>{const cat=document.querySelectorAll('.controls select')[0];for(const o of cat.options)if(o.value==='Risk Curators'){cat.value='Risk Curators';break;}cat.dispatchEvent(new Event('change'));});
 await p.evaluate(()=>{const ch=document.querySelectorAll('.controls select')[1];for(const o of ch.options)if(o.value==='Ethereum'){ch.value='Ethereum';break;}ch.dispatchEvent(new Event('change'));});
 await p.evaluate(()=>{const s=document.querySelector('input[type=search]');s.value='a';s.dispatchEvent(new Event('input'));});
 await p.evaluate(()=>{const th=[...document.querySelectorAll('thead th button')].find(h=>h.textContent.indexOf('TVL')===0);if(th)th.click();});
 await new Promise(x=>setTimeout(x,300));
 await p.screenshot({path:DIR+'/3-filtered.png'});
 await b.close();
 for(const f of fs.readdirSync(DIR)){
   const x=fs.readFileSync(DIR+'/'+f);
   console.log(f, x.readUInt32BE(16)+'x'+x.readUInt32BE(20), x.length+' bytes');
 }
})();
