// Writes the judge-visible farm-plan region (the drawer's step list) out as a PNG so its text can
// be read directly, instead of guessing crop coordinates in a 1440-wide PNG.
//
//   node tools/step8shot.cjs <out-dir> <png-out>
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');

const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const outDir = path.resolve(process.argv[2] || 'out');
const pngOut = process.argv[3] || '/tmp/steps.png';

(async () => {
  const url = 'file://' + path.join(outDir, 'dashboard', 'index.html');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--force-device-scale-factor=1', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1300, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr.row'));
    const target = rows.find((r) => r.querySelector('.pname') && r.querySelector('.pname').textContent.indexOf('Gauntlet') !== -1) || rows[0];
    target.click();
  });
  await page.waitForSelector('.sheet', { visible: true });
  await new Promise((r) => setTimeout(r, 250));
  const el = await page.$('.sheet .steps');
  if (!el) throw new Error('no .steps');
  await el.screenshot({ path: pngOut });
  console.log('wrote', pngOut);
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
