const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const OUT='/home/muse-newapi/makefun-token-radar/work/out';
(async()=>{
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files','--hide-scrollbars','--force-device-scale-factor=1']});
 const p=await b.newPage();
 for(const H of [900,1000,1200,1440]){
  await p.setViewport({width:1440,height:H,deviceScaleFactor:1});
  await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'networkidle0'});
  await p.waitForSelector('tbody tr'); await new Promise(x=>setTimeout(x,400));
  const raw='/tmp/fr-'+H+'.png'; await p.screenshot({path:raw});
  const opt='/tmp/fropt-'+H+'.png'; execFileSync(process.execPath,[path.join(__dirname,'pngopt.cjs'),raw,opt]);
  const dims=fs.readFileSync(opt).readUInt32BE(16)+'x'+fs.readFileSync(opt).readUInt32BE(20);
  console.log(`H=${H} png ${dims} ${fs.statSync(opt).size} bytes  band(300-350KB)=${fs.statSync(opt).size>=307200&&fs.statSync(opt).size<=358400}`);
 }
 // page scroll height
 await p.setViewport({width:1440,height:1440,deviceScaleFactor:1});
 await p.goto('file://'+path.join(OUT,'dashboard','index.html'),{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr');
 console.log('scrollHeight', await p.evaluate(()=>document.documentElement.scrollHeight));
 await b.close();
})();
