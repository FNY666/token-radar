// Precise: find the amber disc and the near-white label ink in one anchored crop, and measure
// the real gap and any true ink-on-ink overlap.
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
    const labelX = parseFloat(q.getAttribute('x')), labelY = parseFloat(q.getAttribute('y'));
    const tx = labelX - 9, ty = labelY - 3.5;
    let dot=null; for(const c of svg.querySelectorAll('circle.dot')) if(Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01){dot=c;break;}
    const dr = dot.getBoundingClientRect();
    const qb = q.getBoundingClientRect();
    return { dot: { l:dr.left, t:dr.top, r:dr.right, b:dr.bottom, cx:(dr.left+dr.right)/2, cy:(dr.top+dr.bottom)/2, w:dr.width },
             q: { l:qb.left, t:qb.top, r:qb.right, b:qb.bottom } };
  });
  const pad = 8;
  const clip = { x: geo.dot.l - pad, y: geo.dot.t - pad, width: 70, height: (geo.dot.b - geo.dot.t) + 2*pad };
  await p.screenshot({ path: '/tmp/rev_ink.png', clip });
  console.log(JSON.stringify({geo, clip}));
  await b.close();
})();
