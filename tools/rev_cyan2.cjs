const p=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await p.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const pg=await b.newPage();
await pg.setViewport({width:1440,height:1200});
await pg.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,800));
const out=await pg.evaluate(()=>{
  const rows=[];
  const seen=new Set();
  document.querySelectorAll('*').forEach(e=>{
    const cs=getComputedStyle(e);
    const key=(e.className&&typeof e.className==='string'?e.className:'#'+e.tagName);
    const id=key+'|'+cs.color+'|'+cs.backgroundColor+'|'+cs.borderTopColor;
    if(seen.has(id))return; seen.add(id);
    const t=(e.textContent||'').trim().slice(0,40);
    if(!t)return;
    const r=e.getBoundingClientRect();
    rows.push({cls:key,tag:e.tagName,color:cs.color,bg:cs.backgroundColor,border:cs.borderTopColor,txt:t,x:Math.round(r.x),y:Math.round(r.y),vis:r.width>0&&r.height>0});
  });
  // specific probes
  const probe=(sel)=>{const e=document.querySelector(sel);if(!e)return null;const cs=getComputedStyle(e);return {sel,color:cs.color,bg:cs.backgroundColor,border:cs.borderTopColor,text:(e.textContent||'').trim().slice(0,50)};};
  return {rows:rows.filter(r=>r.color!=='rgb(232, 237, 244)'), probes:['.tag.wl','.tag.early','.pill','.pill.live','.val','.callout h2','.skip','.plot-legend i','.cond'].map(probe)};
});
console.log(JSON.stringify(out,null,1));
await b.close();
})();
