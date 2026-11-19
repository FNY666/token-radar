// Fresh-page interaction test, one thing at a time, so a click on one control cannot
// contaminate the next measurement.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const URL = 'file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  });
  const res = {};
  const open = async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(URL, { waitUntil: 'load' });
    await page.waitForSelector('tbody tr');
    await new Promise((r) => setTimeout(r, 250));
    return page;
  };

  // ---- A. what the header row looks like (th vs sortable button)
  let page = await open();
  res.headerTh = await page.$$eval('thead th', (ts) => ts.map((t) => ({ text: t.innerText.trim(), hasButton: !!t.querySelector('button') })));
  res.rowCount = await page.$$eval('tbody tr', (r) => r.length);
  // ---- B. sort each SORTABLE column, check monotonicity of the actual column index
  const thIndex = await page.$$eval('thead th', (ts) => ts.map((t, i) => ({ i, sortable: !!t.querySelector('button'), text: t.innerText.trim() })));
  res.sortCheck = [];
  for (const h of thIndex) {
    if (!h.sortable) { res.sortCheck.push({ col: h.text, sortable: false }); continue; }
    const p = await open();
    const btns = await p.$$('thead th button');
    const btn = btns[h.i];
    if (!btn) { res.sortCheck.push({ col: h.text, idx: h.i, note: 'no button at index' }); await p.close(); continue; }
    // click once (desc) then check
    await btn.click();
    await new Promise((r) => setTimeout(r, 120));
    const d = await p.evaluate((idx) => {
      const vals = [...document.querySelectorAll('tbody tr')].map((tr) => tr.children[idx].innerText.trim());
      return vals;
    }, h.i);
    const asc = await p.evaluate((idx) => {
      const vals = [...document.querySelectorAll('tbody tr')].map((tr) => tr.children[idx].innerText.trim());
      const num = vals.map((v) => (v.replace(/[^0-9.-]/g, '') === '' ? null : Number(v.replace(/[^0-9.-]/g, ''))));
      if (num.some((v) => v === null)) return 'nonnumeric';
      let a = true, d = true;
      for (let i = 1; i < num.length; i++) { if (num[i] < num[i - 1]) a = false; if (num[i] > num[i - 1]) d = false; }
      return { asc: a, desc: d };
    }, h.i);
    res.sortCheck.push({ col: h.text, idx: h.i, first3: d.slice(0, 3), mono: asc });
    await p.close();
  }
  await page.close();

  // ---- C. name filter, on a fresh page
  page = await open();
  await page.type('#controls input[type=search]', 'aave');
  await new Promise((r) => setTimeout(r, 250));
  res.nameFilterRows = await page.$$eval('tbody tr', (r) => r.length);
  res.nameFilterNames = await page.$$eval('tbody tr', (r) => r.map((x) => x.children[1].innerText.trim()));
  await page.close();

  // ---- D. category filter
  page = await open();
  await page.select('#controls select:nth-of-type(1)', 'Lending');
  await new Promise((r) => setTimeout(r, 250));
  res.catFilterRows = await page.$$eval('tbody tr', (r) => r.length);
  await page.close();

  // ---- E. chain filter
  page = await open();
  const sels = await page.$$('#controls select');
  const opts = await sels[1].$$eval('option', (os) => os.map((o) => o.value));
  const eth = opts.indexOf('Ethereum');
  await sels[1].select(opts[eth]);
  await new Promise((r) => setTimeout(r, 250));
  res.chainFilterRows = await page.$$eval('tbody tr', (r) => r.length);
  await page.close();

  // ---- F. SCOPE filter: is there one?
  page = await open();
  res.controlsHtml = await page.$eval('#controls', (e) => e.innerHTML.replace(/\s+/g, ' ').slice(0, 1200));
  res.scopeWords = await page.evaluate(() => (document.querySelector('#controls').innerText || '').split('\n').map((s) => s.trim()).filter(Boolean));
  await page.close();

  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
