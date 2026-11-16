// Measures the scatter plot's geometry: the viewBox against the rendered box, the dot aspect
// ratio, the axis type's stretch, and whether anything is letterboxed.
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
      const box = svg.getBoundingClientRect();
      const vb = svg.getAttribute('viewBox').split(' ').map(Number);
      const dots = [...svg.querySelectorAll('circle')].map(c => { const q = c.getBoundingClientRect(); return q.width / q.height; });
      const tick = svg.querySelector('text.tick');
      const natural = tick.getComputedTextLength();
      const onScreen = tick.getBoundingClientRect().width;
      // the drawn content's bounds vs the svg box: is anything letterboxed?
      const g = svg.getBoundingClientRect();
      return { vbW: vb[2], vbH: vb[3], boxW: Math.round(box.width), boxH: Math.round(box.height),
        dotAspect: Math.min(...dots).toFixed(4) + '-' + Math.max(...dots).toFixed(4),
        textStretch: (onScreen / natural).toFixed(4), nDots: dots.length };
    });
    console.log(String(w).padStart(5), JSON.stringify(r));
  }
  await b.close();
})();
