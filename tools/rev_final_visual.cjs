const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 24 });
  await p.goto('file://' + path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'), { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');
  const geo = await p.evaluate(() => {
    const svg = document.querySelector('.plot svg');
    const q = svg.querySelector('text.q');
    const tx = parseFloat(q.getAttribute('x'))-9;
    let t=null; for(const c of svg.querySelectorAll('circle')) if(Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01){t=c;break;}
    const tr=t.getBoundingClientRect();
    return { rect:{l:tr.left,t:tr.top,r:tr.right,b:tr.bottom} };
  });
  // the last 13 css px of the disc + the first 13 css px of the label
  await p.screenshot({ path: '/tmp/final24.png', clip: { x: geo.rect.r-13, y: geo.rect.t+1, width: 26, height: (geo.rect.b-geo.rect.t)-2 } });
  console.log('ok', JSON.stringify(geo.rect));
  await b.close();
})();
