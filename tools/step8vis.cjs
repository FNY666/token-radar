// Measures which farm-plan steps are actually VISIBLE in the judge's screenshot 2 (the detail
// view), by reproducing the same click + scroll as tools/shootscreens.cjs and reporting each
// step's bounding box against the viewport.
//
//   node tools/step8vis.cjs <out-dir>
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
const fs = require('node:fs');

const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const outDir = path.resolve(process.argv[2] || 'out');

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
  await page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const steps = sheet.querySelector('.steps');
    if (steps) sheet.scrollTop = Math.max(0, steps.offsetTop - 90);
  });
  await new Promise((r) => setTimeout(r, 200));

  const res = await page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const sr = sheet.getBoundingClientRect();
    const items = Array.from(sheet.querySelectorAll('.steps li')).map((li) => {
      const r = li.getBoundingClientRect();
      const act = li.querySelector('.act');
      return {
        text: act ? act.textContent.slice(0, 90) : '(none)',
        top: Math.round(r.top), bottom: Math.round(r.bottom),
        visible: r.bottom > sr.top && r.top < sr.bottom,
      };
    });
    const row = document.querySelector('.sheet .pn, .sheet h2, .sheet .title');
    return {
      sheet: { top: Math.round(sr.top), bottom: Math.round(sr.bottom), height: Math.round(sr.height), left: Math.round(sr.left), right: Math.round(sr.right) },
      viewport: window.innerHeight,
      title: row ? row.textContent : '(unknown)',
      steps: items,
    };
  });
  console.log('title:', res.title);
  console.log('viewport height:', res.viewport, 'sheet rect:', JSON.stringify(res.sheet));
  res.steps.forEach((s, i) => {
    console.log(`step ${i + 1} visible=${s.visible} top=${s.top} bot=${s.bottom} :: ${s.text}`);
  });
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
