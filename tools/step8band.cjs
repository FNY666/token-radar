// Reproduces the committed detail screenshot's exact framing (height 1200, same scroll) and
// reports where step 8 lands on screen, so the PNG can be cropped at the right band.
//
//   node tools/step8band.cjs <out-dir>
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');

const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const outDir = path.resolve(process.argv[2] || 'out');

(async () => {
  const url = 'file://' + path.join(outDir, 'dashboard', 'index.html');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--force-device-scale-factor=1', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr.row'));
    const target = rows.find((r) => r.querySelector('.pname') && r.querySelector('.pname').textContent.indexOf('Gauntlet') !== -1) || rows[0];
    target.click();
  });
  await page.waitForSelector('.sheet', { visible: true });
  await new Promise((r) => setTimeout(r, 250));
  await page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const steps = sheet.querySelector('.steps');
    if (steps) sheet.scrollTop = Math.max(0, steps.offsetTop - 90);
  });
  await new Promise((r) => setTimeout(r, 200));
  const res = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const sr = sheet.getBoundingClientRect();
    const lis = Array.from(sheet.querySelectorAll('.steps li'));
    const li8 = lis[7];
    const r8 = li8.getBoundingClientRect();
    const act = li8.querySelector('.act');
    return {
      name: (document.querySelector('.sheet .pn') || {}).textContent || '(?)',
      sheetLeft: Math.round(sr.left),
      step8top: Math.round(r8.top), step8bottom: Math.round(r8.bottom),
      step8text: act.textContent,
      viewport: window.innerHeight,
      nsteps: lis.length,
    };
  });
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
