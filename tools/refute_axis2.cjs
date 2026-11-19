const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args:['--no-sandbox','--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 3 });
  await page.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html', { waitUntil:'networkidle0' });
  await new Promise(r=>setTimeout(r,500));
  const el = await page.$('.plot svg');
  const box = await el.boundingBox();
  console.log('svg box', JSON.stringify(box));
  await page.screenshot({ path: '/tmp/refute_plot_3x.png', clip: { x: box.x, y: box.y, width: 200, height: 70 } });
  await browser.close();
})();
