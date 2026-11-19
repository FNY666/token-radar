const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'), { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');
  const geo = await p.evaluate(() => {
    const svg = document.querySelector('.plot svg');
    const q = svg.querySelector('text.q');
    const tx = parseFloat(q.getAttribute('x'))-9;
    let t=null; for(const c of svg.querySelectorAll('circle')) if(Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01){t=c;break;}
    // isolate: only this dot and this label
    [...svg.querySelectorAll('circle')].forEach(c=>{ if(c!==t) c.style.display='none'; });
    [...svg.querySelectorAll('text')].forEach(x=>{ if(x!==q) x.style.display='none'; });
    const tr=t.getBoundingClientRect();
    return { rect:{l:tr.left,t:tr.top,r:tr.right,b:tr.bottom} };
  });
  await p.screenshot({ path: '/tmp/iso1x.png', clip: { x: geo.rect.l-3, y: geo.rect.t-3, width: 40, height: (geo.rect.b-geo.rect.t)+6 } });
  console.log('ok');
  await b.close();
})();
