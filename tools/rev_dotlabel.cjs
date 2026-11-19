// Measures the rank-1 dot and its label in the scatter, in SVG user units.
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
      const txt = q.textContent;
      // the dot with the max implied value
      const data = window.__DATA__ || null;
      let dots = [...svg.querySelectorAll('circle.dot')];
      // find dot nearest the label's anchor point
      const qb = q.getBoundingClientRect();
      const svgBox = svg.getBoundingClientRect();
      const scale = svgBox.width / svg.viewBox.baseVal.width;
      // find the circle whose cx,cy in user units is closest to the label baseline origin
      const labelX = parseFloat(q.getAttribute('x')), labelY = parseFloat(q.getAttribute('y'));
      const anchor = q.getAttribute('text-anchor');
      let best = null, bd = 1e9;
      for (const c of dots) {
        const cx = parseFloat(c.getAttribute('cx')), cy = parseFloat(c.getAttribute('cy'));
        const r = parseFloat(c.getAttribute('r'));
        const d = Math.hypot(cx - labelX, cy - (labelY - 3.5));
        if (d < bd) { bd = d; best = { cx, cy, r, cls: c.getAttribute('class') }; }
      }
      // Convert user-unit numbers to screen px for readability
      const u2s = (v) => +(v * scale).toFixed(2);
      return { txt, anchor, labelX, labelY, W: svg.viewBox.baseVal.width, H: svg.viewBox.baseVal.height,
        dot: best, dist: +bd.toFixed(2),
        scale: +scale.toFixed(4),
        // does the label's own text box overlap the dot's disc?
        // sample the label glyph pixels? later
        qb: { l: +qb.left.toFixed(2), r: +qb.right.toFixed(2), t: +qb.top.toFixed(2), b: +qb.bottom.toFixed(2) },
        svgBox: { l: +svgBox.left.toFixed(2), t: +svgBox.top.toFixed(2), w: +svgBox.width.toFixed(2), h: +svgBox.height.toFixed(2) },
        allDots: dots.length
      };
    });
    console.log(w, JSON.stringify(r, null, 1));
  }
  await b.close();
})();
