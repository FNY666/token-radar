// MY OWN lens: what does the SHIPPED screenshot frame show, and is the contradiction in it?
// Plus: does the page actually contradict itself in the DOM the judge would read?
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path'); const fs=require('node:fs');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const url='file://'+path.join('/home/muse-newapi/makefun-token-radar/work/out/dashboard','index.html');
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--force-device-scale-factor=1','--hide-scrollbars','--allow-file-access-from-files']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:1300,deviceScaleFactor:1});
 await p.goto(url,{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr');
 // open Gauntlet exactly like shootscreens.cjs
 await p.evaluate(()=>{const rows=Array.from(document.querySelectorAll('tbody tr.row'));const t=rows.find(r=>r.querySelector('.pname')&&r.querySelector('.pname').textContent.indexOf('Gauntlet')!==-1)||rows[0];t.click();});
 await p.waitForSelector('.sheet',{visible:true});
 await new Promise(r=>setTimeout(r,250));
 // measure BEFORE the scroll (drawer unscrolled) at 1300 = the shipped 2-detail viewport
 const pre=await p.evaluate(()=>{
   const sh=document.querySelector('.sheet');
   const chips=Array.from(sh.querySelectorAll('.chips'));
   const chainRow=chips.find(c=>c.querySelectorAll('.chip-static').length>2);
   const n=chainRow?chainRow.querySelectorAll('.chip-static').length:0;
   // find the deriv line whose label is 'Chains'
   const lines=Array.from(sh.querySelectorAll('.deriv div, .deriv .line')).map(d=>d.textContent.trim());
   const chainLine=lines.find(t=>/^Chains/.test(t));
   const r1=chainRow?chainRow.getBoundingClientRect():null;
   const el=Array.from(sh.querySelectorAll('*')).find(e=>e.children.length===0&&e.textContent.trim().startsWith('Chains'));
   const r2=el?el.getBoundingClientRect():null;
   return {chipCount:n, chipTop:r1?Math.round(r1.top):null, chipBottom:r1?Math.round(r1.bottom):null,
           chainLineText:chainLine, chainTop:r2?Math.round(r2.top):null, chainBottom:r2?Math.round(r2.bottom):null,
           viewportH:window.innerHeight,
           chainNames: chainRow?Array.from(chainRow.querySelectorAll('.chip-static')).map(c=>c.textContent):[]};
 });
 console.log('UNSCROLLED drawer, viewport 1300:', JSON.stringify(pre,null,1));
 // now apply the shipped scroll and re-measure
 await p.evaluate(()=>{const sh=document.querySelector('.sheet');const st=sh.querySelector('.steps');if(st)sh.scrollTop=Math.max(0,st.offsetTop-90);});
 await new Promise(r=>setTimeout(r,200));
 const post=await p.evaluate(()=>{
   const sh=document.querySelector('.sheet');
   const chips=Array.from(sh.querySelectorAll('.chips'));
   const chainRow=chips.find(c=>c.querySelectorAll('.chip-static').length>2);
   const r1=chainRow?chainRow.getBoundingClientRect():null;
   const el=Array.from(sh.querySelectorAll('*')).find(e=>e.children.length===0&&e.textContent.trim().startsWith('Chains'));
   const r2=el?el.getBoundingClientRect():null;
   const sr=sh.getBoundingClientRect();
   return {scrollTop:sh.scrollTop, chipTop:r1?Math.round(r1.top):null, chainTop:r2?Math.round(r2.top):null,
           sheetTop:Math.round(sr.top), sheetBottom:Math.round(sr.bottom), viewportH:window.innerHeight};
 });
 console.log('AFTER shipped scroll:', JSON.stringify(post,null,1));
 await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
