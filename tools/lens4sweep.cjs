const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const rows=require('fs').readFileSync(OUT+'/data.js','utf8');
(async()=>{
 global.window={}; new Function('window',rows)(global.window);
 const data=global.window.RADAR.rows;
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 const widths=[320,340,360,380,400,419,420,421,430,440,480,560,640,768,1024,1440];
 // the top-3 rows by max string length of any numeric field
 const rank=data.map(r=>[r.name,Math.max(String(r.implied_value_usd).length,String(r.conditional_value_usd).length,String(r.tvl_usd).length)]).sort((a,b)=>b[1]-a[1]);
 const targets=rank.slice(0,6).map(x=>x[0]);
 for(const W of widths){
   const p=await b.newPage();
   await p.setViewport({width:W,height:800});
   await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'load'});
   await p.waitForSelector('tbody tr');
   let worst={right:0,text:''};
   for(const nm of targets){
     const ok=await p.evaluate(n=>{const tr=[...document.querySelectorAll('tbody tr.row')].find(t=>t.textContent.indexOf(n)>=0); if(!tr)return false; tr.click(); return true;}, nm);
     if(!ok) continue;
     await p.waitForSelector('.sheet'); await new Promise(x=>setTimeout(x,80));
     const res=await p.evaluate(()=>{const s=document.querySelector('.sheet');return{vs:[...document.querySelectorAll('.kpi .v')].map(v=>{const r=v.getBoundingClientRect();return{t:v.textContent,r:Math.round(r.right)}}),sw:s.scrollWidth,cw:s.clientWidth,cols:getComputedStyle(document.querySelector('.kpis')).gridTemplateColumns};});
     for(const x of res.vs) if(x.r>worst.right) worst={right:x.r,text:x.t};
     if(res.sw>res.cw+1) worst.sheetOverflow=res.sw+'>'+res.cw;
     worst.cols=res.cols;
     await p.evaluate(()=>{const c=document.querySelector('.sheet .close'); if(c)c.click();});
     await new Promise(x=>setTimeout(x,60));
   }
   const clip = worst.right>W;
   console.log(`W=${String(W).padStart(4)} cols=${worst.cols} worstRight=${worst.right} clippedByViewport=${clip} ${worst.sheetOverflow?'sheetOverflow='+worst.sheetOverflow:''} [${worst.text}]`);
   await p.close();
 }
 await b.close();
})();
