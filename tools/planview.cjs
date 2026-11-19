// Opens a named protocol's detail drawer on the built page and prints the eight plan steps
// verbatim, so a reader's actual view of a row's plan can be checked.
//
//   node tools/planview.cjs <out-dir> <protocol name>
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');

const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const outDir = path.resolve(process.argv[2] || 'out');
const name = process.argv[3] || 'Swan DAO';

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
  const opened = await page.evaluate((needle) => {
    const rows = Array.from(document.querySelectorAll('tbody tr.row'));
    const target = rows.find((r) => {
      const n = r.querySelector('.pname');
      return n && n.textContent.trim() === needle;
    });
    if (!target) return false;
    target.click();
    return true;
  }, name);
  if (!opened) { console.log('row not on the first page of the board:', name); await browser.close(); return; }
  await page.waitForSelector('.sheet', { visible: true });
  await new Promise((r) => setTimeout(r, 300));
  const res = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const title = (sheet.querySelector('.pn') || {}).textContent || '(?)';
    const steps = Array.from(sheet.querySelectorAll('.steps li')).map((li) => {
      const act = li.querySelector('.act');
      const meta = li.querySelector('.meta');
      return (act ? act.textContent : '') + '  [' + (meta ? meta.textContent.replace(/\s+/g, ' ') : '') + ']';
    });
    const record = Array.from(sheet.querySelectorAll('.deriv .line, .deriv div')).map((d) => d.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean);
    return { title, steps, record };
  });
  console.log('drawer:', res.title);
  res.record.forEach((r) => console.log('  record:', r));
  res.steps.forEach((s, i) => console.log(`  step ${i + 1}: ${s}`));
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
