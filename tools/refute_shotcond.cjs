// Replicate shootscreens.cjs exactly: goto at the default viewport, THEN resize to 1440x1440.
// Measure the axis title vs the top tick in that state, and shoot it.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--force-device-scale-factor=1','--hide-scrollbars','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html', { waitUntil:'networkidle0' });
  await p.waitForSelector('tbody tr');
  await p.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
  await new Promise(r=>setTimeout(r,300));
  const out = await p.evaluate(()=>{
    const svg=document.querySelector('.plot svg');
    const sr=svg.getBoundingClientRect();
    const g=(t)=>{const e=Array.from(svg.querySelectorAll('text')).find(x=>x.textContent===t);const r=e.getBoundingClientRect();return {x:+r.x.toFixed(2),y:+r.y.toFixed(2),w:+r.width.toFixed(2),h:+r.height.toFixed(2)};};
    const A=g('Implied value'), B=g('$10.0M');
    const ix=Math.min(A.x+A.w,B.x+B.w)-Math.max(A.x,B.x), iy=Math.min(A.y+A.h,B.y+B.h)-Math.max(A.y,B.y);
    return {svg:{x:sr.x,y:sr.y,w:sr.width,h:sr.height}, viewBox:svg.getAttribute('viewBox'), title:A, tick:B, overlap:[+ix.toFixed(2),+iy.toFixed(2)], overlaps: ix>0&&iy>0};
  });
  console.log(JSON.stringify(out,null,1));
  await p.screenshot({path:'/tmp/shotcond.png'});
  await b.close();
})();
