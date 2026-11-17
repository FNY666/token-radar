// Does the RENDERED page differ when the snapshot's row order is shuffled?
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire('/home/muse-newapi/makefun-token-radar/tools/');
const puppeteer = require('puppeteer');
const CHROME='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const browser = await puppeteer.launch({executablePath:CHROME,args:['--no-sandbox','--allow-file-access-from-files','--disable-gpu','--hide-scrollbars']});
async function render(dir, label){
  const page=await browser.newPage();
  await page.setViewport({width:1440,height:1200,deviceScaleFactor:1});
  const errs=[]; page.on('pageerror',e=>errs.push(e.message)); page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.goto('file://'+dir+'/dashboard/index.html',{waitUntil:'networkidle0'});
  await page.waitForSelector('tbody tr');
  const txt = await page.evaluate(()=>{
    const out=[];
    out.push('HERO:'+document.querySelector('#hero').innerText.replace(/\s+/g,' '));
    out.push('BAR:'+document.querySelector('#bar-meta').innerText.replace(/\s+/g,' '));
    // the board table, all cells
    const rows=Array.from(document.querySelectorAll('tbody tr'));
    for(const r of rows) out.push('ROW:'+r.innerText.replace(/\s+/g,' '));
    return out.join('\n');
  });
  // the model tab
  await page.goto('file://'+dir+'/dashboard/index.html#view=model',{waitUntil:'networkidle0'});
  await new Promise(r=>setTimeout(r,300));
  const model = await page.evaluate(()=> (document.querySelector('#view-model')||{}).innerText ? document.querySelector('#view-model').innerText.replace(/\s+/g,' ') : 'NONE');
  await page.close();
  fs.writeFileSync('/tmp/render_'+label+'.txt', txt+'\n---MODEL---\n'+model);
  return {txt, model, errs};
}
const A=await render('/tmp/ord/base/out','base');
const B=await render('/tmp/ord/shuf/out','shuf');
console.log('board render identical:', A.txt===B.txt);
console.log('model tab identical:', A.model===B.model);
if(A.txt!==B.txt){const a=A.txt.split('\n'),b=B.txt.split('\n');for(let i=0;i<Math.max(a.length,b.length);i++) if(a[i]!==b[i]){console.log('first diff line',i);console.log(' A:',a[i]);console.log(' B:',b[i]);break;}}
if(A.model!==B.model){const a=A.model,b=B.model;for(let i=0;i<Math.max(a.length,b.length);i++) if(a[i]!==b[i]){console.log('model diff at',i);console.log(' A:',a.slice(i-80,i+160));console.log(' B:',b.slice(i-80,i+160));break;}}
console.log('page errors base:', A.errs.length, 'shuf:', B.errs.length);
await browser.close();
