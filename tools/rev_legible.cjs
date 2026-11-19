// Final: is the first glyph legible where it crosses the disc's rim?
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 4 });
  await p.goto('file://' + path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'), { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');
  const geo = await p.evaluate(() => {
    const svg = document.querySelector('.plot svg');
    const q = svg.querySelector('text.q');
    const tx = parseFloat(q.getAttribute('x'))-9;
    let t=null; for(const c of svg.querySelectorAll('circle')) if(Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01){t=c;break;}
    const tr=t.getBoundingClientRect(); const qr=q.getBoundingClientRect();
    return { dot:{l:tr.left,t:tr.top,r:tr.right,b:tr.bottom}, q:{l:qr.left,t:qr.top,r:qr.right,b:qr.bottom} };
  });
  await p.screenshot({ path: '/tmp/legible4x.png', clip: { x: geo.dot.r-14, y: geo.dot.t+2, width: 28, height: (geo.dot.b-geo.dot.t)-4 } });
  console.log(JSON.stringify(geo));
  await b.close();
})();
