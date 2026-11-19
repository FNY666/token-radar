// Do HEAD's shipped screenshots reproduce from HEAD's code?
const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const dir=process.argv[2];
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--force-device-scale-factor=1','--hide-scrollbars','--allow-file-access-from-files']});
 const p=await b.newPage();
 const url='file://'+path.join(dir,'out/dashboard/index.html');
 await p.setViewport({width:1440,height:1440,deviceScaleFactor:1});
 await p.goto(url,{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr'); await new Promise(r=>setTimeout(r,200));
 await p.screenshot({path:'/tmp/zz-h1.png'});
 await p.evaluate(()=>{const rows=Array.from(document.querySelectorAll('tbody tr.row'));const t=rows.find(r=>r.querySelector('.pname')&&r.querySelector('.pname').textContent.indexOf('Gauntlet')!==-1)||rows[0];t.click();});
 await p.waitForSelector('.sheet',{visible:true});await new Promise(r=>setTimeout(r,250));
 await p.evaluate(()=>{const sh=document.querySelector('.sheet');const st=sh.querySelector('.steps');if(st)sh.scrollTop=Math.max(0,st.offsetTop-90);});
 await new Promise(r=>setTimeout(r,200));
 await p.setViewport({width:1440,height:1200,deviceScaleFactor:1});await new Promise(r=>setTimeout(r,200));
 await p.screenshot({path:'/tmp/zz-h2.png'});
 await b.close();
 execFileSync(process.execPath,[path.join(__dirname,'pngopt.cjs'),'/tmp/zz-h1.png','/tmp/zz-h1o.png']);
 execFileSync(process.execPath,[path.join(__dirname,'pngopt.cjs'),'/tmp/zz-h2.png','/tmp/zz-h2o.png']);
 const s1=fs.readFileSync('/tmp/zz-h1o.png'),S1=fs.readFileSync(dir+'/screenshots/1-board.png');
 const s2=fs.readFileSync('/tmp/zz-h2o.png'),S2=fs.readFileSync(dir+'/screenshots/2-detail.png');
 console.log('1-board identical?',s1.equals(S1));
 console.log('2-detail identical?',s2.equals(S2));
})().catch(e=>{console.error(e);process.exit(1)});
