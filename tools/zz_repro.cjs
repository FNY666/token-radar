// Reproduce the SHIPPED screenshots from the CURRENT code using shootscreens.cjs's exact sequence.
const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const dir=process.argv[2]||'/home/muse-newapi/makefun-token-radar/work';
 const b=await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--force-device-scale-factor=1','--hide-scrollbars','--allow-file-access-from-files']});
 const p=await b.newPage();
 const url='file://'+path.join(dir,'out/dashboard/index.html');
 // --- shot 1: exact sequence of shootscreens.cjs
 await p.setViewport({width:1440,height:1440,deviceScaleFactor:1});
 await p.goto(url,{waitUntil:'networkidle0'});
 await p.waitForSelector('tbody tr');
 await new Promise(r=>setTimeout(r,200));
 await p.screenshot({path:'/tmp/zz-r1.png'});
 // --- shot 2: click Gauntlet at viewport 1440x1440, then scroll, THEN set viewport to 1200 (shot() sets viewport AFTER the scroll)
 await p.evaluate(()=>{const rows=Array.from(document.querySelectorAll('tbody tr.row'));const t=rows.find(r=>r.querySelector('.pname')&&r.querySelector('.pname').textContent.indexOf('Gauntlet')!==-1)||rows[0];t.click();});
 await p.waitForSelector('.sheet',{visible:true});
 await new Promise(r=>setTimeout(r,250));
 await p.evaluate(()=>{const sh=document.querySelector('.sheet');const st=sh.querySelector('.steps');if(st)sh.scrollTop=Math.max(0,st.offsetTop-90);});
 await new Promise(r=>setTimeout(r,200));
 await p.setViewport({width:1440,height:1200,deviceScaleFactor:1});
 await new Promise(r=>setTimeout(r,200));
 await p.screenshot({path:'/tmp/zz-r2.png'});
 await b.close();
 execFileSync(process.execPath,[path.join(__dirname,'pngopt.cjs'),'/tmp/zz-r1.png','/tmp/zz-r1o.png']);
 execFileSync(process.execPath,[path.join(__dirname,'pngopt.cjs'),'/tmp/zz-r2.png','/tmp/zz-r2o.png']);
 const s1=fs.readFileSync('/tmp/zz-r1o.png'), S1=fs.readFileSync(dir+'/screenshots/1-board.png');
 const s2=fs.readFileSync('/tmp/zz-r2o.png'), S2=fs.readFileSync(dir+'/screenshots/2-detail.png');
 console.log('1-board  repro identical to shipped?', s1.equals(S1), s1.length, S1.length);
 console.log('2-detail repro identical to shipped?', s2.equals(S2), s2.length, S2.length);
})().catch(e=>{console.error(e);process.exit(1)});
