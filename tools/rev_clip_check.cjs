// Does the rank-1 dot ever get clipped by the SVG top edge, in any tab / width / filter?
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  for (const w of [1440, 1200, 1024, 900, 768]) {
    await p.setViewport({ width: w, height: 900 });
    await p.goto('file://' + path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'), { waitUntil: 'load' });
    await p.waitForSelector('tbody tr');
    for (const tab of ['board','live','model']) {
      const r = await p.evaluate((tab) => {
        const btn = [...document.querySelectorAll('[role=tab]')].find(b => (b.textContent||'').toLowerCase().includes(tab.slice(0,4)));
        if (btn) btn.click();
        const svg = document.querySelector('.plot svg');
        if (!svg) return { tab, noPlot: true };
        const H = svg.viewBox.baseVal.height;
        let minTop = 1e9, topDot = null, lab = null;
        for (const c of svg.querySelectorAll('circle.dot')) {
          const cy = parseFloat(c.getAttribute('cy')), r = parseFloat(c.getAttribute('r'));
          const t = cy - r; if (t < minTop) { minTop = t; topDot = { cx:parseFloat(c.getAttribute('cx')), cy, r, cls:c.getAttribute('class') }; }
        }
        const q = svg.querySelector('text.q');
        if (q) { const e=q.getExtentOfChar(0); lab = { x:parseFloat(q.getAttribute('x')), y:parseFloat(q.getAttribute('y')),
          inkLeft:+e.x.toFixed(2), inkW:+e.width.toFixed(2), inkTop:+e.y.toFixed(2), inkBot:+(e.y+e.height).toFixed(2) }; }
        return { tab, H, minTop:+minTop.toFixed(3), clipped: minTop < 0, topDot, lab };
      }, tab);
      console.log(String(w).padStart(5), JSON.stringify(r));
    }
  }
  await b.close();
})();
