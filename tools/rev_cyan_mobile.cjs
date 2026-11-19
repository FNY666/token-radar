const p=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await p.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
for(const w of [420,768]){
const pg=await b.newPage();
await pg.setViewport({width:w,height:900});
await pg.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,500));
const o=await pg.evaluate(()=>{
 const ths=[...document.querySelectorAll('thead th')].map(t=>{const r=t.getBoundingClientRect();return {h:(t.textContent||'').trim(),x:Math.round(r.x),right:Math.round(r.right)};});
 const wrap=document.querySelector('.table-wrap');
 return {ths, scrollW:wrap.scrollWidth, clientW:wrap.clientWidth, overflowX:getComputedStyle(document.documentElement).overflowX};
});
console.log(w, JSON.stringify(o));
await pg.close();
}
await b.close();
})();
