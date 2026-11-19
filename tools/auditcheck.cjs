// Verify the two audit findings that looked unfixed in the current tree:
//   A. the money() comment claims a property the displayed rounding does not have
//   B. clearing the last filter leaves the stale key in the URL
//
//   node tools/auditcheck.cjs <built-out-dir>
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
const outDir = path.resolve(process.argv[2] || 'out');
const url = 'file://' + path.join(outDir, 'dashboard', 'index.html');
const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--force-device-scale-factor=1', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');

  // ---- A. the money triple -------------------------------------------------
  const A = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    let bad = 0, worst = 0, worstRow = null, exactBad = 0;
    for (const r of rows) {
      const tds = r.querySelectorAll('td');
      if (tds.length < 6) continue;
      // find the three numeric cells by their class
      const cells = Array.from(tds).map((td) => ({ cls: td.className, txt: td.textContent.trim() }));
      // The three figures are the LAST three cells: Launch odds, If issued,
      // Implied value. (The earlier attempt took the last three .num cells,
      // which are the rank, TVL and 7d change -- the wrong three.)
      const [odds, cond, val] = cells.slice(-3).map((c) => c.txt);
      const pc = parseFloat(cond.replace(/[^0-9.]/g, ''));
      const po = parseFloat(odds.replace(/[^0-9.]/g, ''));
      const pv = parseFloat(val.replace(/[^0-9.]/g, ''));
      if (!isFinite(pc) || !isFinite(po) || !isFinite(pv)) continue;
      // undo the display rounding: $19.5M -> 19.5e6
      const scale = (s) => (/B/.test(s) ? 1e9 : /M/.test(s) ? 1e6 : /K/.test(s) ? 1e3 : 1);
      const cc = pc * scale(cond), oo = po / 100, vv = pv * scale(val);
      // The tolerance is the rounding the display itself does: three
      // significant figures is a relative error of up to 5e-4 on each of the
      // two factors. A row whose error is bigger than that is a real
      // contradiction, not a rounding artefact.
      const tol = 2 * 5e-4;
      const err = Math.abs(cc * oo - vv) / vv;
      if (err > tol) { bad++; if (err > worst) { worst = err; worstRow = { cond, odds, val, err: err.toFixed(5) }; } }
    }
    return { bad, worst, worstRow, rowCount: rows.length };
  });
  console.log('A. the money triple');
  console.log('   rows:', A.rowCount, '| rows whose displayed figures do not multiply:', A.bad);
  console.log('   worst relative error:', (A.worst * 100).toFixed(3) + '%', A.worstRow ? JSON.stringify(A.worstRow) : '');

  // ---- B. clearing the last filter ------------------------------------------
  const B = await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const results = [];
    // set a filter via the search box
    const search = document.querySelector('input[type=search], input#q, input[placeholder*=earch]');
    if (!search) return { err: 'no search box' };
    search.value = 'poly';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(120);
    results.push({ step: 'typed poly', hash: location.hash, rows: document.querySelectorAll('tbody tr').length });
    // clear it
    search.value = '';
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(120);
    results.push({ step: 'cleared it', hash: location.hash, rows: document.querySelectorAll('tbody tr').length });
    return { results };
  });
  console.log('B. clearing the last filter');
  if (B.err) console.log('  ', B.err);
  else for (const r of B.results) console.log('   ', r.step, '-> hash', JSON.stringify(r.hash), ',', r.rows, 'rows');

  console.log('console errors:', errors.length ? errors : 'none');
  await browser.close();
})();
