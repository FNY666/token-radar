const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args:['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
  await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html', { waitUntil:'networkidle0' });
  await new Promise(r=>setTimeout(r,500));
  const box = await (await p.$('.plot svg')).boundingBox();
  console.log('svg box at 1440x1440:', JSON.stringify(box));
  const info = await p.evaluate(()=>{
    const t = Array.from(document.querySelectorAll('.plot svg text'));
    return t.filter(x=>['Implied value','$10.0M'].includes(x.textContent)).map(x=>{const bb=x.getBBox();return {t:x.textContent,x:bb.x,y:bb.y,w:bb.width,h:bb.height};});
  });
  console.log(JSON.stringify(info));
  await p.screenshot({ path:'/tmp/refute_shot.png' });
  await b.close();
})();
