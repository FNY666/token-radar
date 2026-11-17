// Measure the LIVE page's refit check (the "Refitted in this page" card) and whether the judge's
// 30,144-byte view carries each dashboard file whole.
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
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 800));

  // click the "The model" tab
  const tabs = await page.$$('[role=tab], .tab, nav button');
  for (const t of tabs) {
    const txt = await page.evaluate((e) => e.innerText, t);
    if (/model/i.test(txt)) { await t.click(); break; }
  }
  await new Promise((r) => setTimeout(r, 500));

  const out = await page.evaluate(() => {
    const body = document.body.innerText;
    const lines = body.split('\n').map((s) => s.trim()).filter((s) => s.length);
    const i = lines.findIndex((l) => /Refitted in this page/i.test(l));
    return {
      refitCard: i >= 0 ? lines.slice(i, i + 8) : null,
      reproduce: lines.filter((l) => /reproduce|differ/i.test(l)),
      modelTabText: lines.filter((l) => /refit|195|AUC|median error|factor/i.test(l)).slice(0, 20),
    };
  });
  console.log(JSON.stringify(out, null, 1));
  console.log('ERRORS', errs);
  await browser.close();
})();
