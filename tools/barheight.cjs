// The top bar's real height at every width, so the table header's sticky offset can be set to
// the bar's actual height instead of a guess.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
const OUT = '/home/muse-newapi/makefun-token-radar/work/out';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.goto('file://' + path.join(OUT, 'dashboard', 'index.html'), { waitUntil: 'load' });
  await page.waitForSelector('tbody tr');
  for (const w of [320, 375, 480, 600, 768, 900, 1024, 1200, 1440]) {
    await page.setViewport({ width: w, height: 900 });
    await new Promise((r) => setTimeout(r, 60));
    const h = await page.evaluate(() => {
      const bar = document.querySelector('.bar');
      return {
        bar: Math.round(bar.getBoundingClientRect().height),
        brandTag: getComputedStyle(document.querySelector('.brand-tag')).display,
        metaRows: new Set(Array.from(document.querySelectorAll('.bar-meta div')).map((d) => d.getBoundingClientRect().top)).size,
      };
    });
    console.log(String(w).padStart(5), 'bar=' + String(h.bar).padStart(3), 'px  metaRows=' + h.metaRows, ' brandTag=' + h.brandTag);
  }
  await browser.close();
})();
