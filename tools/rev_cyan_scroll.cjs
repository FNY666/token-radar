const p=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await p.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const pg=await b.newPage();
await pg.setViewport({width:1440,height:1200});
await pg.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,500));
// apply the "Off list only" filter, so EVERY row is an early tag, and check the odds column
const o=await pg.evaluate(()=>{
  const btns=[...document.querySelectorAll('.controls button')];
  const off=btns.find(b=>b.textContent.trim()==='Off list only');
  if(off) off.click();
  const rows=[...document.querySelectorAll('tbody tr')];
  return {n:rows.length, allEarly:rows.every(r=>!!r.querySelector('.tag.early')),
    anyWl:rows.filter(r=>r.querySelector('.tag.wl')).length};
});
await new Promise(r=>setTimeout(r,400));
console.log(JSON.stringify(o));
await b.close();
})();
