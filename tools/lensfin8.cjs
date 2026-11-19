const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path');
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900,deviceScaleFactor:1});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr.row');
 // 1. vertical order of chip row vs Chains line in the drawer
 await p.evaluate(()=>{location.hash='#p=re7-labs';});
 await new Promise(r=>setTimeout(r,400));
 const ord=await p.evaluate(()=>{
   const s=document.querySelector('.sheet');
   const all=[...s.querySelectorAll('*')];
   const chipRow=[...s.querySelectorAll('.chips')].find(c=>[...c.children].some(x=>x.textContent.trim()==='World Chain'));
   const chainsLine=[...s.querySelectorAll('.deriv > *')].find(x=>/^Chains/.test(x.textContent.trim()));
   const idx=a=>all.indexOf(a);
   return {chipIndex:idx(chipRow), chainsIndex:idx(chainsLine), chipBefore: idx(chipRow)<idx(chainsLine)};
 });
 console.log('ORDER in drawer DOM:',JSON.stringify(ord));
 // 2. are the omitted chains reachable via the chain filter / search?
 const res=await p.evaluate(()=>{
   const R=window.RADAR;
   const row=R.rows.find(r=>r.slug==='re7-labs');
   const omitted=row.chains.slice(8);
   const searchHit=omitted.map(c=>({c, found: R.rows.some(r=>(r.chains||[]).indexOf(c)!==-1 && r.slug==='re7-labs' && (r.name+' '+r.slug+' '+(r.category||'')+' '+(r.chains||[]).join(' ')).toLowerCase().indexOf(c.toLowerCase())!==-1)}));
   return {omitted, searchHit, allFound: searchHit.every(x=>x.found)};
 });
 console.log('OMITTED chains reachable by search:',JSON.stringify(res));
 // 3. live check: type "Berachain" (an omitted chain) into the search box
 await p.evaluate(()=>{location.hash='';});
 await new Promise(r=>setTimeout(r,300));
 await p.evaluate(()=>{
   const s=document.querySelector('input[type=search]'); s.value='Berachain';
   s.dispatchEvent(new Event('input',{bubbles:true}));
 });
 await new Promise(r=>setTimeout(r,300));
 const shown=await p.evaluate(()=>[...document.querySelectorAll('tbody tr.row .pname')].map(e=>e.textContent.trim()));
 console.log('search "Berachain" -> rows:',JSON.stringify(shown.slice(0,10)),'contains Re7:',shown.some(s=>/Re7/.test(s)));
 await b.close();
})();
