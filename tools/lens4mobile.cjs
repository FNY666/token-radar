// Reproducer for the mobile horizontal-scroll finding.
// Usage: node tools/lens4mobile.cjs
// Measures, at 320 / 390 / 1440 css px, what of the board table is inside the
// .table-wrap viewport, whether any overflow cue is painted, and whether the
// implied value is reachable another way on the same page.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
const OUT = '/home/muse-newapi/makefun-token-radar/work/out';
const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';

(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  for (const W of [320, 390, 768, 1440]) {
    const p = await b.newPage();
    await p.setViewport({ width: W, height: 844 });
    await p.goto('file://' + path.join(OUT, 'dashboard', 'index.html'), { waitUntil: 'load' });
    await p.waitForSelector('tbody tr');
    const r = await p.evaluate(() => {
      const w = document.querySelector('.table-wrap');
      const wr = w.getBoundingClientRect();
      const cs = getComputedStyle(w);
      // text of the header cell straddling the right edge: cut or fully inside?
      const straddle = [];
      document.querySelectorAll('thead th').forEach(th => {
        const b = th.getBoundingClientRect();
        if (b.right > wr.right + 0.5 && b.left < wr.right) {
          const rg = document.createRange(); rg.selectNodeContents(th);
          const tb = rg.getBoundingClientRect();
          straddle.push({ th: th.textContent.trim(), textRight: Math.round(tb.right), wrapRight: Math.round(wr.right) });
        }
      });
      const fully = [...document.querySelectorAll('thead th')].filter(th => {
        const b = th.getBoundingClientRect(); return b.left >= wr.left && b.right <= wr.right;
      }).map(th => th.textContent.trim());
      return {
        scrollWidth: w.scrollWidth, clientWidth: w.clientWidth,
        overflowX: cs.overflowX, boxShadow: cs.boxShadow, backgroundImage: cs.backgroundImage,
        scrollbarPx: w.offsetWidth - w.clientWidth,
        fullyVisible: fully, straddlingHeader: straddle,
        docScrollW: document.documentElement.scrollWidth, docClientW: document.documentElement.clientWidth,
      };
    });
    console.log(`W=${W} wrap scrollWidth=${r.scrollWidth} clientWidth=${r.clientWidth} scrollbar=${r.scrollbarPx}px ofx=${r.overflowX} shadow=${r.boxShadow} bgImage=${r.backgroundImage}`);
    console.log(`   fully visible headers: [${r.fullyVisible.join(' | ')}]`);
    console.log(`   header cut by the right edge: ${JSON.stringify(r.straddlingHeader)}`);
    console.log(`   page scrollWidth=${r.docScrollW} clientWidth=${r.docClientW} (page itself does not overflow)`);
    await p.close();
  }
  await b.close();
})();
