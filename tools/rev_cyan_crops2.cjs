const p=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await p.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const pg=await b.newPage();
await pg.setViewport({width:1440,height:1200,deviceScaleFactor:2});
await pg.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,600));
await pg.screenshot({path:'/home/muse-newapi/makefun-token-radar/work/tools/rev_c_scope.png',clip:{x:419,y:798,width:400,height:300}});
await pg.screenshot({path:'/home/muse-newapi/makefun-token-radar/work/tools/rev_c_odds.png',clip:{x:1000,y:798,width:260,height:300}});
await pg.screenshot({path:'/home/muse-newapi/makefun-token-radar/work/tools/rev_c_row.png',clip:{x:44,y:798,width:1352,height:220}});
await b.close(); console.log('ok');
})();
