// Render the detail view exactly as tools/shootscreens.cjs frames screenshots/2-detail.png:
// the Gauntlet row's drawer open, 1440 wide, at a chosen height.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const url = process.argv[2];
const out = process.argv[3];
const height = Number(process.argv[4] || 1220);
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--force-device-scale-factor=1', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr.row'));
    const target = rows.find((r) => r.querySelector('.pname') && r.querySelector('.pname').textContent.indexOf('Gauntlet') !== -1) || rows[0];
    target.click();
  });
  await page.waitForSelector('.sheet', { visible: true });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: out });
  console.log('wrote', out);
  await browser.close();
})();
