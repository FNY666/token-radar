const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const EXE='/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async()=>{
 const b=await puppeteer.launch({executablePath:EXE,args:['--no-sandbox']});
 const p=await b.newPage(); await p.setViewport({width:1440,height:900});
 await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
 await p.waitForSelector('#plot-wrap .plot');
 // focus the plot group
 await p.evaluate(()=>document.querySelector('#plot-wrap .plot').focus());
 let seq=[];
 for(let i=0;i<4;i++){
  await p.keyboard.press('ArrowRight');
  seq.push(await p.evaluate(()=>{const a=document.activeElement;return a.tagName+'.'+(a.getAttribute('class')||'')+' ti='+a.getAttribute('tabindex')+' label="'+(a.getAttribute('aria-label')||'')+'"';}));
 }
 console.log('arrow walk:',seq.join('\n            '));
 // Enter on a dot opens detail?
 await p.keyboard.press('Enter');
 await new Promise(r=>setTimeout(r,400));
 console.log('after Enter drawer open?', await p.evaluate(()=>{const d=document.getElementById('drawer');return d&&!d.hidden;}));
 // dots count / focusable circles
 console.log(await p.evaluate(()=>({circles:document.querySelectorAll('#plot-wrap circle').length,
   focusableCircles:document.querySelectorAll('#plot-wrap circle[tabindex="0"]').length})));
 await b.close();
})();
