// Renders the dashboard's three views and writes the screenshots the entry hands in.
//
//   node tools/shootscreens.cjs <out-dir> <shots-dir>
//
// The kit's rules for a screenshot: a whole PNG or JPEG, its long side at most 1440 and its
// short side at least 800, and the entry's own target is 300 to 350 KB per image.
//
// The framing is 1440 wide with the device scale at 1, which fills the judge's 1024x640 cover
// box without letterboxing. The HEIGHT is tuned per shot until the PNG lands inside the band:
// a screenshot's size in bytes is a function of how much ink it carries, and the page changed
// since the last shoot, so the height is measured rather than assumed.
//
// The PNG is then re-encoded losslessly (tools/pngopt.cjs) with per-scanline filter selection
// and deflate level 9, which makes the file smaller without changing a pixel.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const LO = 300 * 1024, HI = 350 * 1024;
const WIDTH = 1440;

(async () => {
  const outDir = path.resolve(process.argv[2] || 'out');
  const shotDir = path.resolve(process.argv[3] || 'screenshots');
  fs.mkdirSync(shotDir, { recursive: true });
  const url = 'file://' + path.join(outDir, 'dashboard', 'index.html');

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--force-device-scale-factor=1', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();

  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

  // Take the shot at a given height, optimise it, and report the size.
  async function take(name, height) {
    await page.setViewport({ width: WIDTH, height, deviceScaleFactor: 1 });
    await new Promise((r) => setTimeout(r, 200));
    const raw = path.join('/tmp', 'raw-' + name);
    await page.screenshot({ path: raw });
    const opt = path.join(shotDir, name);
    execFileSync(process.execPath, [path.join(__dirname, 'pngopt.cjs'), raw, opt]);
    fs.unlinkSync(raw);
    return fs.statSync(opt).size;
  }

  // Tune the height until the PNG lands in the band. The page is scrollable, so a shorter
  // frame still shows the same top of the page, just less of it.
  async function shot(name, startHeight) {
    let h = startHeight;
    let size = await take(name, h);
    for (let i = 0; i < 24 && (size < LO || size > HI); i++) {
      h += size > HI ? -20 : 20;
      if (h < 900) { h = 900; }
      if (h > 1440) { h = 1440; }
      const next = await take(name, h);
      if ((size >= LO && size <= HI)) break;
      if (Math.abs(next - size) < 512 && (next < LO || next > HI)) { size = next; break; }
      size = next;
    }
    const band = size >= LO && size <= HI ? 'in band' : 'OUT OF BAND';
    console.log(name, size + ' bytes', band, 'at ' + h + 'px');
    return size;
  }

  // 1: the board
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  await shot('1-board.png', 1360);

  // 2: a protocol's detail view, with the board still visible behind the drawer.
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr.row'));
    const target = rows.find((r) => r.querySelector('.pname') && r.querySelector('.pname').textContent.indexOf('Gauntlet') !== -1) || rows[0];
    target.click();
  });
  await page.waitForSelector('.sheet', { visible: true });
  await new Promise((r) => setTimeout(r, 250));
  // The judge has to SEE the farm plan, with its costs and its times: scroll the plan into the
  // drawer before the shot, so the frame shows the steps rather than the header above them.
  await page.evaluate(() => {
    const sheet = document.querySelector('.sheet');
    const steps = sheet.querySelector('.steps');
    if (steps) sheet.scrollTop = Math.max(0, steps.offsetTop - 90);
  });
  await new Promise((r) => setTimeout(r, 200));
  await shot('2-detail.png', 1030);
  await page.evaluate(() => document.querySelector('.drawer .close').click());
  await new Promise((r) => setTimeout(r, 150));

  // 3: a filtered view -- a category filter, a chain filter and a text search together, so the
  //    screenshot shows every kind of filter doing its work at once, and the board re-sorts.
  await page.evaluate(() => {
    const cat = document.querySelectorAll('.controls select')[0];
    for (const o of cat.options) if (o.value === 'Risk Curators') { cat.value = 'Risk Curators'; break; }
    cat.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => {
    const chain = document.querySelectorAll('.controls select')[1];
    for (const o of chain.options) if (o.value === 'Ethereum') { chain.value = 'Ethereum'; break; }
    chain.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => {
    const search = document.querySelector('input[type=search]');
    search.value = 'a';
    search.dispatchEvent(new Event('input'));
  });
  await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('thead th button'));
    const tvl = headers.find((h) => h.textContent.indexOf('TVL') === 0);
    if (tvl) tvl.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  await shot('3-filtered.png', 1380);

  if (errors.length) {
    console.log('CONSOLE ERRORS:');
    errors.forEach((e) => console.log('  ' + e));
  } else {
    console.log('no console errors');
  }
  await browser.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
