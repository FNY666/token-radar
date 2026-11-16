// G04's two claims, measured rather than asserted:
//   1. the drawer's backdrop listener no longer piles up across open/close cycles;
//   2. a row on the "Already trading" tab opens the same drawer, on the market's figures.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');

const OUT = '/home/muse-newapi/makefun-token-radar/work/out';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(OUT, 'dashboard', 'index.html'), { waitUntil: 'load' });

  // --- 1. the backdrop listener ---
  // Count how many times closeDetail's backdrop path fires for ONE backdrop click.
  // If the listener piled up, one backdrop click closes the drawer N times.
  const leak = await page.evaluate(async () => {
    const host = document.getElementById('drawer');
    const results = [];
    for (let cycle = 0; cycle < 5; cycle++) {
      // open a row
      document.querySelector('tbody tr.row').click();
      await new Promise((r) => setTimeout(r, 30));
      if (host.hidden) return { fail: 'the drawer did not open' };
      // close via the close button, then reopen: five cycles
      host.querySelector('.close').click();
      await new Promise((r) => setTimeout(r, 30));
    }
    // Now open once more and count how many hash writes a single backdrop click causes.
    document.querySelector('tbody tr.row').click();
    await new Promise((r) => setTimeout(r, 30));
    let writes = 0;
    const origWrite = history.replaceState;
    history.replaceState = function (...a) { writes++; return origWrite.apply(this, a); };
    // a backdrop click: dispatch on the host itself (target === host)
    host.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 30));
    history.replaceState = origWrite;
    return { writes, hidden: host.hidden, handlers: host.dataset.wired };
  });

  // --- 2. the live drawer ---
  await page.evaluate(() => { location.hash = '#view=live'; });
  await new Promise((r) => setTimeout(r, 120));
  const live = await page.evaluate(async () => {
    const rows = document.querySelectorAll('#view-live tbody tr');
    if (!rows.length) return { fail: 'no live rows' };
    rows[0].click();
    await new Promise((r) => setTimeout(r, 40));
    const host = document.getElementById('drawer');
    if (host.hidden) return { fail: 'the live drawer did not open' };
    const sheet = host.querySelector('.sheet');
    const title = sheet.querySelector('h2').textContent;
    const kpis = Array.from(sheet.querySelectorAll('.kpi')).map((k) => k.querySelector('.k').textContent + '=' + k.querySelector('.v').textContent);
    const lines = Array.from(sheet.querySelectorAll('.deriv .line')).map((l) => l.textContent);
    const warn = sheet.querySelector('.warn').textContent;
    const tag = sheet.querySelector('.tag').textContent;
    return { title, kpis, lines, warn, tag, hash: location.hash };
  });

  // --- 3. a keyboard-reachable live row ---
  const kb = await page.evaluate(() => {
    const row = document.querySelector('#view-live tbody tr');
    return { tabindex: row.getAttribute('tabindex'), cls: row.className };
  });

  // --- 4. a deep link to a live protocol opens the live drawer ---
  const slug = await page.evaluate(() => document.querySelector('#view-live tbody tr .slug').textContent);
  await page.evaluate((s) => { location.hash = '#p=' + s; }, slug);
  await new Promise((r) => setTimeout(r, 150));
  const deep = await page.evaluate(() => {
    const host = document.getElementById('drawer');
    const sheet = host.querySelector('.sheet');
    return {
      hidden: host.hidden,
      title: sheet ? sheet.querySelector('h2').textContent : null,
      sub: sheet ? sheet.querySelector('.slug').textContent : null,
      hash: location.hash,
    };
  });

  console.log(JSON.stringify({ leak, live, kb, deep, errors }, null, 1));
  await browser.close();
})();
