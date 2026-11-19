const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'load'});
 await p.waitForSelector('tbody tr');
 const slugs=await p.evaluate(()=>{
   const rows=(window.RADAR.rows||[]);
   return rows.map(r=>({slug:r.slug,name:r.name,n:(r.chains||[]).length,chains:r.chains||[]}))
     .filter(r=>r.n>8).sort((a,b)=>b.n-a.n);
 });
 console.log('rows>8:',slugs.length,'max:',slugs[0]&&slugs[0].n);
 console.log('all >8:',slugs.map(r=>r.name+':'+r.n).join(', '));
 for(const r of slugs){
   await p.evaluate(s=>{location.hash='#p='+s;},r.slug);
   await new Promise(res=>setTimeout(res,250));
   const info=await p.evaluate(()=>{
     const sh=document.querySelector('.sheet');
     if(!sh) return null;
     const chipRows=[...sh.querySelectorAll('.chips')].map(c=>[...c.children].map(x=>x.textContent.trim()));
     const recLines=[...sh.querySelectorAll('.deriv')].flatMap(d=>[...d.children].map(l=>l.textContent.trim())).filter(l=>/^Chains/.test(l));
     const chainChipRow=chipRows.find(cr=>cr.some(c=>/chain/i.test(c)) ) ;
     // find the row containing the first chain name
     const first=r=>null;
     const allText=sh.textContent;
     const plusN=/\+\s*\d+/.test(allText);
     return {title:sh.querySelector('h2')&&sh.querySelector('h2').textContent, chipRows, recLines, plusN};
   });
   console.log(JSON.stringify({slug:r.slug,name:r.name,chainsInData:r.n,first8:r.chains.slice(0,8),info},null,1));
 }
 await b.close();
})();
