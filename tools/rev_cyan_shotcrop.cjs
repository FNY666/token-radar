const p=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await p.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const pg=await b.newPage();
await pg.setViewport({width:1440,height:1400,deviceScaleFactor:2});
await pg.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,600));
// scroll to the first early row and crop a band spanning Scope..Launch odds
const o=await pg.evaluate(()=>{
  const el=[...document.querySelectorAll('tbody .tag.early')][0];
  const tr=el.closest('tr'); const r=tr.getBoundingClientRect();
  return {y:r.y+window.scrollY};
});
await pg.evaluate(y=>window.scrollTo(0,y-100),o.y);
await new Promise(r=>setTimeout(r,400));
const y2=await pg.evaluate(()=>{const el=[...document.querySelectorAll('tbody .tag.early')][0];const r=el.getBoundingClientRect();return r.y;});
await pg.screenshot({path:'/home/muse-newapi/makefun-token-radar/work/tools/rev_c_band.png',clip:{x:419,y:Math.max(0,y2-60),width:740,height:180}});
console.log(JSON.stringify(o),y2);
await b.close();
})();
