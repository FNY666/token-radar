// Test the README claim "Sortable on every column": for every board <th>, click it and see
// whether the row order changes.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const URL = 'file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html';
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const order = async (page) => page.evaluate(() => [...document.querySelectorAll('tbody tr.row .pname')].map((e) => e.textContent.trim()));
  for (let idx = 0; idx < 9; idx++) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
    await page.goto(URL, { waitUntil: 'networkidle0' });
    await page.waitForSelector('tbody tr');
    const before = await order(page);
    const label = await page.evaluate((i) => document.querySelectorAll('thead th')[i].textContent.trim(), idx);
    const hasBtn = await page.evaluate((i) => !!document.querySelectorAll('thead th')[i].querySelector('button'), idx);
    await page.evaluate((i) => {
      const th = document.querySelectorAll('thead th')[i];
      const b = th.querySelector('button');
      (b || th).click();
    }, idx);
    await new Promise((r) => setTimeout(r, 250));
    const after = await order(page);
    const changed = before.join('|') !== after.join('|');
    console.log(`th[${idx}] "${label}" button=${hasBtn} orderChanged=${changed}`);
    await page.close();
  }
  await browser.close();
})();
