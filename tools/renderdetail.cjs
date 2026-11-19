// Render the CURRENT page's detail drawer, the way screenshots/2-detail.png was framed:
// the board page with the first row's drawer open.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const url = process.argv[2];
const out = process.argv[3] || '/tmp/detail.png';
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1220, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('tbody tr');
  await new Promise((r) => setTimeout(r, 500));
  await page.evaluate(() => document.querySelector('tbody tr.row, tbody tr').click());
  await page.waitForSelector('.sheet');
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: out });
  const txt = await page.evaluate(() => document.querySelector('#drawer').innerText);
  console.log('--- drawer text ---');
  console.log(txt.slice(0, 1500));
  await browser.close();
})();
