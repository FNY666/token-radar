const p=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await p.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const pg=await b.newPage();
await pg.setViewport({width:1440,height:1200,deviceScaleFactor:2});
await pg.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,600));
// crop the table region showing Scope + Launch odds columns
const el=await pg.$('#table-wrap');
const box=await el.boundingBox();
await pg.screenshot({path:'/home/muse-newapi/makefun-token-radar/work/tools/rev_cyan_table.png',clip:{x:box.x+380,y:box.y+40,width:760,height:240}});
// crop the plot legend + callout
const el2=await pg.$('.plot-wrap');
const b2=await el2.boundingBox();
await pg.screenshot({path:'/home/muse-newapi/makefun-token-radar/work/tools/rev_cyan_plot.png',clip:{x:b2.x,y:b2.y+b2.height-140,width:900,height:140}});
console.log(JSON.stringify({box,b2}));
await b.close();
})();
