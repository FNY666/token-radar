const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--force-device-scale-factor=1','--hide-scrollbars','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
  await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html', { waitUntil:'networkidle0' });
  await p.waitForSelector('tbody tr');
  await new Promise(r=>setTimeout(r,600));
  const out = await p.evaluate(()=>{
    const svg=document.querySelector('.plot svg'); const sr=svg.getBoundingClientRect();
    const f=(t)=>{const e=Array.from(svg.querySelectorAll('text')).find(x=>x.textContent===t);const r=e.getBoundingClientRect();return {x:+r.x.toFixed(2),y:+r.y.toFixed(2),w:+r.width.toFixed(2),h:+r.height.toFixed(2)};};
    return {svg:{x:sr.x,y:sr.y,w:sr.width,h:sr.height}, title:f('Implied value'), tick:f('$10.0M'), bottom:f('Launch odds (chance it issues a token)')};
  });
  console.log(JSON.stringify(out));
  await p.screenshot({path:'/tmp/live_shot.png'});
  await b.close();
})();
