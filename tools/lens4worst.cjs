const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 const p=await b.newPage();
 await p.setViewport({width:320,height:800});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'load'});
 await p.waitForSelector('tbody tr');
 // find the row with the longest dollar value across the dataset
 const best = await p.evaluate(()=>{
   const rows=window.RADAR.rows.filter(r=>r.implied_value!=null);
   rows.sort((a,b)=>String(b.implied_value).length-String(a.implied_value).length);
   return rows.slice(0,5).map(r=>({name:r.name, iv:r.implied_value, tvl:r.tvl}));
 });
 console.log('longest implied_value strings:', JSON.stringify(best));
 // open several rows, measure max KPI right edge
 let worst={right:0,text:'',label:''};
 for (const r of best.slice(0,3)){
   const ok = await p.evaluate((nm)=>{
     const tr=[...document.querySelectorAll('tbody tr.row')].find(t=>t.textContent.indexOf(nm)>=0);
     if(!tr) return false; tr.click(); return true;
   }, r.name);
   if(!ok) continue;
   await p.waitForSelector('.sheet'); await new Promise(x=>setTimeout(x,150));
   const res=await p.evaluate(()=>[...document.querySelectorAll('.kpi .v')].map(v=>{const r=v.getBoundingClientRect();return{text:v.textContent,right:Math.round(r.right),left:Math.round(r.left)}}));
   for(const x of res) if(x.right>worst.right) worst={right:x.right,text:x.text,label:r.name};
   await p.evaluate(()=>{const c=document.querySelector('.sheet .close'); if(c)c.click();});
   await new Promise(x=>setTimeout(x,100));
 }
 console.log('worst KPI right edge at 320:', JSON.stringify(worst));
 console.log('viewport 320 -> clipped?', worst.right>320);
 await b.close();
})();
