// Load the built page in chrome-headless-shell and report, from the LIVE page:
//   - the FIT check the page computes (exact rows / worst gap)
//   - the rendered copy strings (the prose a reader actually sees)
//   - the board table's row count, sortability, filter behavior
//   - the plot's dots and whether they are clickable
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const fs = require('node:fs');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));

  const out = await page.evaluate(() => {
    const D = window.RADAR;
    const res = {};
    res.fitText = null;
    // find the model-tab note about reproduction
    const all = document.body.innerText;
    res.reproduceLines = all.split('\n').filter((l) => /reproduce|refit|refit/i.test(l)).slice(0, 10);
    res.copyKeys = Object.keys(D.copy);
    res.copy = D.copy;
    // table row count in the board
    const tables = [...document.querySelectorAll('table')];
    res.tableCount = tables.length;
    res.tableRows = tables.map((t) => t.querySelectorAll('tbody tr').length);
    // headers of first table
    res.headers = tables[0] ? [...tables[0].querySelectorAll('thead th')].map((t) => t.innerText.trim()) : [];
    // plot
    res.plotSvg = !!document.querySelector('svg');
    res.dots = document.querySelectorAll('svg circle').length;
    res.dotsWithCursor = [...document.querySelectorAll('svg circle')].filter((c) => getComputedStyle(c).cursor === 'pointer').length;
    // tabs
    res.tabs = [...document.querySelectorAll('[role=tab], .tab, nav button')].map((t) => t.innerText.trim()).slice(0, 12);
    return res;
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('ERRORS', errs);
  await browser.close();
})();
