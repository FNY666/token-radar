// Check the page's checkable interactive claims from the README:
//   "Sortable on every column, filterable by name, category, chain and scope."
//   "The plot — implied value against launch odds, dot size by TVL; click a dot for its detail."
//   "The detail view — the model's own arithmetic..., the snapshot record it read,
//    an eight-step farm plan..., and the peer protocols of the same category."
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errs = [];
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html', { waitUntil: 'load' });
  await page.waitForSelector('tbody tr');
  await new Promise((r) => setTimeout(r, 300));

  const res = {};

  // ---- 1. SORT every column
  const headers = await page.$$eval('thead th button', (bs) => bs.map((b) => b.innerText.trim()));
  res.headers = headers;
  const firstRow = async () => page.$eval('tbody tr', (tr) => [...tr.children].map((td) => td.innerText.trim().replace(/\s+/g, ' ')));
  res.beforeSort = await firstRow();
  const sorted = [];
  for (let i = 0; i < headers.length; i++) {
    const btns = await page.$$('thead th button');
    await btns[i].click();
    await new Promise((r) => setTimeout(r, 90));
    const row = await firstRow();
    // check the whole column is monotonic
    const mono = await page.evaluate((idx) => {
      const vals = [...document.querySelectorAll('tbody tr')].map((tr) => tr.children[idx].innerText.trim().replace(/[^0-9.-]/g, ''));
      const nums = vals.map(Number);
      const asc = nums.every((v, j) => j === 0 || nums[j - 1] <= v);
      const desc = nums.every((v, j) => j === 0 || nums[j - 1] >= v);
      return { asc, desc, sample: vals.slice(0, 4) };
    }, i);
    sorted.push({ col: headers[i], row0: row[i], mono });
  }
  res.sort = sorted;

  // ---- 2. FILTERS
  const controls = await page.$$eval('#controls *', (els) => els.map((e) => e.tagName + ':' + (e.type || '') + ':' + (e.innerText || e.placeholder || '').trim().slice(0, 40)).filter((s) => !/^SPAN:$/.test(s)));
  res.controls = controls.slice(0, 40);
  const inputs = await page.$$eval('#controls input, #controls select', (els) => els.map((e) => ({ tag: e.tagName, type: e.type, name: e.name || e.id || '', ph: e.placeholder || '', opts: e.tagName === 'SELECT' ? [...e.options].map((o) => o.value) : undefined })));
  res.inputs = inputs;
  // filter by name
  const q = await page.$('#controls input[type=search], #controls input[type=text]');
  if (q) {
    await q.type('aave');
    await new Promise((r) => setTimeout(r, 200));
    res.filterNameRows = await page.$$eval('tbody tr', (rs) => rs.length);
    await q.click({ clickCount: 3 });
    await q.press('Backspace');
    await new Promise((r) => setTimeout(r, 200));
    res.filterNameRowsAfterClear = await page.$$eval('tbody tr', (rs) => rs.length);
  }
  // filter by scope
  const scopeSel = await page.$$('#controls select');
  res.selectCount = scopeSel.length;
  if (scopeSel.length) {
    const opts = await scopeSel[0].$$eval('option', (os) => os.map((o) => o.value + '|' + o.textContent.trim()));
    res.scopeOptions = opts;
    for (const o of opts) {
      const val = o.split('|')[0];
      await scopeSel[0].select(val);
      await new Promise((r) => setTimeout(r, 150));
      const n = await page.$$eval('tbody tr', (rs) => rs.length);
      const scopeCells = await page.$$eval('tbody tr', (rs) => [...new Set(rs.map((r) => r.children[2].innerText.trim()))]);
      res['scope_' + val] = { rows: n, scopeCells };
    }
  }

  // ---- 3. PLOT geometry and click
  res.plot = await page.evaluate(() => {
    const svg = document.querySelector('svg');
    if (!svg) return null;
    const cs = [...svg.querySelectorAll('circle')];
    const radii = cs.map((c) => parseFloat(c.getAttribute('r') || '0'));
    const dots = cs.map((c) => ({ cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy'), r: +c.getAttribute('r') }));
    const labels = [...svg.querySelectorAll('text')].map((t) => t.textContent.trim()).filter((t) => t.length < 60);
    return { count: cs.length, rMin: Math.min(...radii), rMax: Math.max(...radii), labels: labels.slice(0, 20) };
  });
  // click a dot -> drawer opens
  const dot = await page.$('svg circle');
  if (dot) {
    await dot.click();
    await new Promise((r) => setTimeout(r, 300));
    res.dotClickOpensDrawer = await page.evaluate(() => {
      const d = document.querySelector('#drawer');
      return { visible: d && !d.hidden, title: d ? d.querySelector('#sheet-title')?.innerText : null };
    });
  }

  // ---- 4. DETAIL view content
  res.detail = await page.evaluate(() => {
    const d = document.querySelector('#drawer');
    if (!d || d.hidden) return null;
    const lines = d.innerText.split('\n').map((s) => s.trim()).filter((s) => s.length);
    return {
      steps: d.querySelectorAll('.steps li').length,
      derivLines: [...d.querySelectorAll('.deriv .row, .deriv > *')].length,
      hasPeers: /peer/i.test(d.innerText),
      peerSample: lines.filter((l) => /peer/i.test(l)).slice(0, 4),
      costCount: (d.innerText.match(/Cost:/g) || []).length,
      timeCount: (d.innerText.match(/Time:/g) || []).length,
      snapshotRecord: lines.filter((l) => /tracked|tvl|change|chain|categor/i.test(l)).slice(0, 12),
    };
  });

  console.log(JSON.stringify(res, null, 1));
  console.log('ERRORS', errs);
  await browser.close();
})();
