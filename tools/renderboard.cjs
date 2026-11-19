// Render a given built dashboard at 1440x1440 and diff it against a stored screenshot.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const url = process.argv[2];
const out = process.argv[3] || '/tmp/render.png';
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('tbody tr');
  await new Promise((r) => setTimeout(r, 700));
  await page.screenshot({ path: out });
  await browser.close();
  console.log('wrote', out);
})();
