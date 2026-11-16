// Does the table's header actually stick while the page scrolls? Measured with INSTANT scrolling
// (the page sets scroll-behavior: smooth, so an async scroll reads back the old position).
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
const OUT = '/home/muse-newapi/makefun-token-radar/work/out';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + path.join(OUT, 'dashboard', 'index.html'), { waitUntil: 'load' });
  await page.waitForSelector('tbody tr');

  const out = await page.evaluate(() => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    const th = document.querySelector('thead th');
    const wrap = document.querySelector('.table-wrap');
    const bar = document.querySelector('.bar');
    const barH = Math.round(bar.getBoundingClientRect().height);
    const samples = [];
    for (const y of [0, 500, 1200, 2000, 4000]) {
      window.scrollTo(0, y);
      const r = th.getBoundingClientRect();
      samples.push({ wanted: y, scrollY: Math.round(window.scrollY), thTop: Math.round(r.top), thBottom: Math.round(r.bottom) });
    }
    const docH = document.documentElement.scrollHeight;
    html.style.scrollBehavior = prev;
    return {
      barHeight: barH,
      thTopOffset: getComputedStyle(th).top,
      wrapOverflow: getComputedStyle(wrap).overflow,
      wrapScrollHeight: wrap.scrollHeight,
      wrapClientHeight: wrap.clientHeight,
      documentHeight: docH,
      samples,
    };
  });

  const s = out.samples;
  const at2000 = s.find((x) => x.scrollY > 1000);
  console.log(JSON.stringify(out, null, 1));
  console.log('\nVERDICT');
  if (at2000) {
    console.log('  at scroll ' + at2000.scrollY + ' the header sits at top=' + at2000.thTop);
    console.log('  the bar is ' + out.barHeight + 'px tall and the header offset is ' + out.thTopOffset);
    console.log(at2000.thTop >= 0 && at2000.thTop <= out.barHeight
      ? '  STICKS, just under the bar'
      : '  DOES NOT STICK (or sticks under the bar)');
  } else {
    console.log('  the page did not scroll');
  }
  await browser.close();
})();
