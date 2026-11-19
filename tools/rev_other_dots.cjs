// How much does the label's ink cover OTHER dots? If the design accepts that, a 2px
// overlap with its own dot is within the accepted idiom.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('file://' + path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'), { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');
  const r = await p.evaluate(() => {
    const svg = document.querySelector('.plot svg');
    const q = svg.querySelector('text.q');
    const labelX = parseFloat(q.getAttribute('x')), labelY = parseFloat(q.getAttribute('y'));
    const tx = labelX - 9, ty = labelY - 3.5;
    const labelRect = { x0: labelX, x1: labelX + 132.28, y0: 15.485, y1: 28.505 };
    const hits = [];
    for (const c of svg.querySelectorAll('circle.dot')) {
      const cx = parseFloat(c.getAttribute('cx')), cy = parseFloat(c.getAttribute('cy')), r = parseFloat(c.getAttribute('r'));
      const isTop = (Math.abs(cx-tx)<0.01 && Math.abs(cy-ty)<0.01);
      // does the disc overlap the label's ink box?
      const dx = Math.max(labelRect.x0 - cx, 0, cx - labelRect.x1);
      const dy = Math.max(labelRect.y0 - cy, 0, cy - labelRect.y1);
      if (Math.hypot(dx,dy) <= r) hits.push({ cx:+cx.toFixed(1), cy:+cy.toFixed(1), r:+r.toFixed(2), cls:c.getAttribute('class'), isTop,
        intrude: +(r - Math.hypot(dx,dy)).toFixed(2) });
    }
    hits.sort((a,b)=>a.intrude-b.intrude);
    return { total: hits.length, hits: hits.slice(0,12) };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
