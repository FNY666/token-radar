// Finds the rank-1 (max implied value) dot and measures the label's ink vs the dot's painted disc.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  for (const w of [1440, 1200, 1024, 900, 768]) {
    await p.setViewport({ width: w, height: 900 });
    await p.goto('file://' + path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'), { waitUntil: 'load' });
    await p.waitForSelector('tbody tr');
    const r = await p.evaluate(() => {
      const svg = document.querySelector('.plot svg');
      const q = svg.querySelector('text.q');
      const labelX = parseFloat(q.getAttribute('x')), labelY = parseFloat(q.getAttribute('y'));
      const anchor = q.getAttribute('text-anchor');
      const dx = anchor === 'end' ? -9 : 9;
      const tx = labelX - dx;            // the top dot's cx
      const ty = labelY - 3.5;          // the top dot's cy
      // the circle at that point
      let dot = null;
      for (const c of svg.querySelectorAll('circle.dot')) {
        const cx = parseFloat(c.getAttribute('cx')), cy = parseFloat(c.getAttribute('cy'));
        if (Math.abs(cx - tx) < 0.01 && Math.abs(cy - ty) < 0.01) {
          dot = { cx, cy, r: parseFloat(c.getAttribute('r')), cls: c.getAttribute('class') };
        }
      }
      const fill = dot ? getComputedStyle(svg.querySelector('circle.dot')).fill : null;
      const qcs = getComputedStyle(q);
      // ink extents of the label text in user units
      const qbb = q.getBBox();
      return {
        anchor, labelX, labelY, tx, ty, dot, dotFill: fill,
        labelFont: qcs.fontSize, labelFill: qcs.fill,
        labelBBoxUser: { x: +qbb.x.toFixed(2), y: +qbb.y.toFixed(2), w: +qbb.width.toFixed(2), h: +qbb.height.toFixed(2) },
        // the gap between the dot's RIGHT EDGE and the label's LEFT INK EDGE
        hGapUser: dot ? +((labelX) - (dot.cx + dot.r)).toFixed(2) : null,
        // vertical: dot's vertical span vs label ink span
        dotV: dot ? { top: +(dot.cy - dot.r).toFixed(2), bot: +(dot.cy + dot.r).toFixed(2) } : null,
        labelV: { top: +qbb.y.toFixed(2), bot: +(qbb.y + qbb.height).toFixed(2) }
      };
    });
    console.log(w, JSON.stringify(r));
  }
  await b.close();
})();
