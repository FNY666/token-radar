const p=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await p.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const pg=await b.newPage();
await pg.setViewport({width:1440,height:1200});
await pg.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,600));
const out=await pg.evaluate(()=>{
  const ths=[...document.querySelectorAll('thead th')].map(t=>{const r=t.getBoundingClientRect();return {h:(t.textContent||'').trim(),x:Math.round(r.x),w:Math.round(r.width),right:Math.round(r.right)};});
  const row=document.querySelector('tbody tr');
  const cells=[...row.children].map((t,i)=>{const r=t.getBoundingClientRect();return {i,x:Math.round(r.x),right:Math.round(r.right),txt:(t.textContent||'').trim().slice(0,28)};});
  const tag=row.querySelector('.tag'), pill=row.querySelector('.pill');
  const tr=tag?t=>0:0;
  const gt=e=>{if(!e)return null;const cs=getComputedStyle(e);const r=e.getBoundingClientRect();return {cls:e.className,color:cs.color,bg:cs.backgroundColor,border:cs.borderTopWidth+' '+cs.borderTopStyle+' '+cs.borderTopColor,radius:cs.borderRadius,pad:cs.padding,fs:cs.fontSize,box:{x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}};};
  // same-row tag (early) sample
  const early=[...document.querySelectorAll('tbody .tag.early')][0];
  const wl=document.querySelector('tbody .tag.wl');
  return {ths,cells,tag:gt(tag),pill:gt(pill),early:gt(early),wl:gt(wl),
   legend:[...document.querySelectorAll('.plot-legend span')].map(s=>{const i=s.querySelector('i');const cs=getComputedStyle(i);return {txt:s.textContent.trim(),swatchBg:cs.backgroundColor};})};
});
console.log(JSON.stringify(out,null,1));
await b.close();
})();
