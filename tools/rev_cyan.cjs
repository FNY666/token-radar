const p=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await p.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const pg=await b.newPage();
await pg.setViewport({width:1440,height:1200});
await pg.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,800));
const out=await pg.evaluate(()=>{
  const m={};
  document.querySelectorAll('*').forEach(e=>{
    const cs=getComputedStyle(e);
    const c=cs.color;
    if(c!=='rgb(73, 198, 232)')return;
    if(!(e.textContent||'').trim() && e.tagName!=='I')return;
    const key=e.className&&typeof e.className==='string'?e.className:'(none)';
    const key2=key+' :: '+e.tagName;
    m[key2]=m[key2]||{n:0,txt:new Set()};
    m[key2].n++;
    m[key2].txt.add((e.textContent||'').trim().slice(0,60));
  });
  const res=[];
  for(const k in m) res.push({sel:k,n:m[k].n,txt:[...m[k].txt].slice(0,4)});
  return res;
});
console.log(JSON.stringify(out,null,1));
await b.close();
})();
