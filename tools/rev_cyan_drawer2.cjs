const p=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await p.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const pg=await b.newPage();
await pg.setViewport({width:1440,height:1200,deviceScaleFactor:2});
await pg.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,500));
await pg.click('tbody tr');
await new Promise(r=>setTimeout(r,400));
// pick an early (off-watchlist) row to see .tag.early in drawer
const o=await pg.evaluate(()=>{
  const d=document.querySelector('.drawer');
  const tags=[...d.querySelectorAll('.tag')].map(t=>({cls:t.className,color:getComputedStyle(t).color,txt:t.textContent}));
  const kpis=[...d.querySelectorAll('.kpi')].map(k=>({cls:k.className,txt:k.textContent.slice(0,40),vcolor:getComputedStyle(k.querySelector('.v')).color}));
  return {tags,kpis};
});
console.log(JSON.stringify(o,null,1));
await pg.screenshot({path:'/home/muse-newapi/makefun-token-radar/work/tools/rev_c_drawer.png',clip:{x:790,y:40,width:650,height:340}});
await b.close();
})();
