const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  // 1x, real reader scale
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await p.goto('file://' + path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'), { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');
  const geo = await p.evaluate(() => {
    const svg = document.querySelector('.plot svg');
    const q = svg.querySelector('text.q');
    const labelX = parseFloat(q.getAttribute('x')), labelY = parseFloat(q.getAttribute('y'));
    const tx = labelX - 9, ty = labelY - 3.5;
    let target=null;
    for (const c of svg.querySelectorAll('circle')) if (Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01) { target=c; break; }
    const tr = target.getBoundingClientRect();
    return { rect:{l:tr.left,t:tr.top,r:tr.right,b:tr.bottom} };
  });
  await p.screenshot({ path: '/tmp/real1x.png', clip: { x: geo.rect.l-8, y: geo.rect.t-8, width: 60, height: (geo.rect.b-geo.rect.t)+16 } });
  // 2x
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await p.reload({waitUntil:'load'}); await p.waitForSelector('tbody tr');
  const g2 = await p.evaluate(() => {
    const svg = document.querySelector('.plot svg'); const q = svg.querySelector('text.q');
    const tx = parseFloat(q.getAttribute('x'))-9;
    let t=null; for(const c of svg.querySelectorAll('circle')) if(Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01){t=c;break;}
    const tr=t.getBoundingClientRect(); return {rect:{l:tr.left,t:tr.top,r:tr.right,b:tr.bottom}};
  });
  await p.screenshot({ path: '/tmp/real2x.png', clip: { x: g2.rect.l-8, y: g2.rect.t-8, width: 60, height: (g2.rect.b-g2.rect.t)+16 } });
  console.log('ok');
  await b.close();
})();
