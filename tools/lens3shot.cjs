const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await puppeteer.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const p=await b.newPage();
await p.setViewport({width:1440,height:1200});
await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html#p=gauntlet',{waitUntil:'load'});
await new Promise(r=>setTimeout(r,1500));
const t=await p.evaluate(()=>document.body.innerText);
const i=t.indexOf('Open a fresh wallet');
console.log(i>=0? t.slice(i,i+1700) : 'NOT FOUND; hash='+t.slice(0,300));
await p.screenshot({path:'/tmp/gauntlet.png'});
await b.close();process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
