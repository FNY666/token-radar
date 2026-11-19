const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await puppeteer.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const p=await b.newPage();
await p.setViewport({width:1440,height:1200});
await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'load'});
await new Promise(r=>setTimeout(r,1200));
const names=['Gauntlet','Steakhouse Financial','Polymarket International'];
for(const n of names){
  const ok=await p.evaluate((n)=>{
    const cell=[...document.querySelectorAll('td,th,[role=cell]')].find(e=>(e.textContent||'').trim().startsWith(n));
    if(!cell) return false;
    (cell.closest('tr')||cell).querySelector('button,[role=button]')?.click();
    return true;
  },n);
  await new Promise(r=>setTimeout(r,700));
  const txt=await p.evaluate(()=>{
    const d=document.querySelector('dialog[open], .drawer[open], [role=dialog], aside, section.detail, .detail');
    return d?d.innerText:'(no detail container) '+document.body.innerText.slice(0,200);
  });
  console.log('=== '+n+' (clicked='+ok+') ===');
  console.log(txt.slice(0,2200));
  await p.evaluate(()=>{document.querySelector('dialog[open]')?.close();document.querySelector('.drawer[open]')?.removeAttribute('open');});
  await new Promise(r=>setTimeout(r,300));
}
await b.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
