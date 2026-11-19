const p=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await p.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const pg=await b.newPage();
await pg.setViewport({width:1440,height:1200,deviceScaleFactor:2});
await pg.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,500));
await pg.click('tbody tr');
await new Promise(r=>setTimeout(r,500));
const out=await pg.evaluate(()=>{
  const dr=document.querySelector('.drawer');
  const items=[];
  dr.querySelectorAll('*').forEach(e=>{
    const cs=getComputedStyle(e);
    const t=(e.textContent||'').trim();
    if(!t)return;
    const acc=cs.color!=='rgb(232, 237, 244)'&&cs.color!=='rgb(168, 182, 200)'&&cs.color!=='rgb(132, 147, 168)';
    if(!acc)return;
    const r=e.getBoundingClientRect();
    items.push({cls:e.className&&typeof e.className==='string'?e.className:e.tagName,tag:e.tagName,color:cs.color,bg:cs.backgroundColor,border:cs.borderTopColor,txt:t.slice(0,40),x:Math.round(r.x),y:Math.round(r.y)});
  });
  return items;
});
console.log(JSON.stringify(out,null,1));
await b.close();
})();
