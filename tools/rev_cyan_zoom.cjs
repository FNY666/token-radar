const p=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await p.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const pg=await b.newPage();
await pg.setViewport({width:1440,height:1200,deviceScaleFactor:4});
await pg.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,600));
const y=await pg.evaluate(()=>{const el=[...document.querySelectorAll('tbody .tag.early')][0];return el.getBoundingClientRect().y;});
await pg.screenshot({path:'/home/muse-newapi/makefun-token-radar/work/tools/rev_z_tag.png',clip:{x:425,y:y-24,width:170,height:32}});
await pg.screenshot({path:'/home/muse-newapi/makefun-token-radar/work/tools/rev_z_pill.png',clip:{x:1050,y:y-24,width:110,height:32}});
await b.close(); console.log('ok',y);
})();
