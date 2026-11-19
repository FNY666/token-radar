// MY lens: is the SHIPPED 2-detail.png still what the current code renders?
// And does the shipped frame contain the chain chips / the "Chains N" line at all?
const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const url='file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html';
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--force-device-scale-factor=1','--hide-scrollbars','--allow-file-access-from-files']});
 const p=await b.newPage();
 await p.setViewport({width:1440,height:1200,deviceScaleFactor:1});
 await p.goto(url,{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr');
 await p.evaluate(()=>{const rows=Array.from(document.querySelectorAll('tbody tr.row'));const t=rows.find(r=>r.querySelector('.pname')&&r.querySelector('.pname').textContent.indexOf('Gauntlet')!==-1)||rows[0];t.click();});
 await p.waitForSelector('.sheet',{visible:true});
 await new Promise(r=>setTimeout(r,250));
 await p.evaluate(()=>{const sh=document.querySelector('.sheet');const st=sh.querySelector('.steps');if(st)sh.scrollTop=Math.max(0,st.offsetTop-90);});
 await new Promise(r=>setTimeout(r,200));
 await p.screenshot({path:'/tmp/zz-detail-raw.png'});
 await b.close();
 execFileSync(process.execPath,[path.join(__dirname,'pngopt.cjs'),'/tmp/zz-detail-raw.png','/tmp/zz-detail-opt.png']);
 const A=fs.readFileSync('/tmp/zz-detail-raw.png'),B=fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/screenshots/2-detail.png');
 console.log('fresh render bytes',A.length,'shipped bytes',B.length);
 console.log('byte-identical?', A.equals(B));
 // compare raw decode of shipped vs fresh with pngopt
 execFileSync(process.execPath,[path.join(__dirname,'pngopt.cjs'),'/home/muse-newapi/makefun-token-radar/work/screenshots/2-detail.png','/tmp/zz-shipped-ree.png']);
 const F=fs.readFileSync('/tmp/zz-detail-opt.png'),S=fs.readFileSync('/tmp/zz-shipped-ree.png');
 console.log('fresh-opt vs shipped bytes identical?', F.equals(S));
})().catch(e=>{console.error(e);process.exit(1)});
