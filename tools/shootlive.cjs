// A review-only shot of the live-token drawer (not shipped: the dossier's image budget is full).
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path'), fs = require('node:fs');
const outDir = path.resolve(process.argv[2] || 'out');
const shotDir = path.resolve(process.argv[3] || '/tmp/liveshot');
fs.mkdirSync(shotDir, { recursive: true });
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--force-device-scale-factor=1', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await p.goto('file://' + path.join(outDir, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await p.evaluate(() => { location.hash = '#view=live'; });
  await new Promise(r => setTimeout(r, 200));
  await p.evaluate(() => { document.querySelector('#view-live tbody tr').click(); });
  await p.waitForSelector('.sheet', { visible: true });
  await new Promise(r => setTimeout(r, 250));
  const f = path.join(shotDir, 'live-drawer.png');
  await p.screenshot({ path: f });
  console.log('live-drawer.png', fs.statSync(f).size, errs.length ? 'ERRORS' : 'no errors');
  await b.close();
})();
