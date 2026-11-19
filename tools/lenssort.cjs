// Correct sort test: map each <th> to its own button by DOM position, then click that button
// on a FRESH page and check the column's own values are monotonic.
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
    await new Promise((r) => setTimeout(r, 200));
    return page;
  };
  let page = await open();
  const ths = await page.$$eval('thead th', (ts) => ts.map((t, i) => ({
    i, text: t.innerText.trim(), btn: !!t.querySelector('button'),
  })));
  res.ths = ths;
  // the board table has 9 th; map to buttons by counting only those with buttons
  res.sortCheck = [];
  let btnIdx = 0;
  for (const h of ths) {
    if (!h.btn) { res.sortCheck.push({ col: h.text, sortable: false }); continue; }
    const myIdx = btnIdx++;
    const p = await open();
    const myIdxLocal = myIdx;
    await p.evaluate((idx) => {
      document.querySelectorAll('thead th button')[idx].click();
    }, myIdxLocal);
    await new Promise((r) => setTimeout(r, 200));
    const r1 = await p.evaluate((idx) => {
      const vals = [...document.querySelectorAll('tbody tr')].map((tr) => tr.children[idx].innerText.trim());
      const num = vals.map((v) => { const c = v.replace(/[^0-9.\-]/g, ''); return c === '' ? null : Number(c); });
      let asc = true, desc = true;
      for (let i = 1; i < num.length; i++) {
        if (num[i] === null || num[i - 1] === null) continue;
        if (num[i] < num[i - 1]) asc = false;
        if (num[i] > num[i - 1]) desc = false;
      }
      return { first3: vals.slice(0, 3), asc, desc, nulls: num.filter((v) => v === null).length };
    }, h.i);
    // click again -> reverse
    await p.evaluate((idx) => { document.querySelectorAll('thead th button')[idx].click(); }, myIdxLocal);
    await new Promise((r) => setTimeout(r, 200));
    const r2 = await p.evaluate((idx) => {
      const vals = [...document.querySelectorAll('tbody tr')].map((tr) => tr.children[idx].innerText.trim());
      const num = vals.map((v) => { const c = v.replace(/[^0-9.\-]/g, ''); return c === '' ? null : Number(c); });
      let asc = true, desc = true;
      for (let i = 1; i < num.length; i++) {
        if (num[i] === null || num[i - 1] === null) continue;
        if (num[i] < num[i - 1]) asc = false;
        if (num[i] > num[i - 1]) desc = false;
      }
      return { first3: vals.slice(0, 3), asc, desc };
    }, h.i);
    res.sortCheck.push({ col: h.text, thIdx: h.i, descFirst: r1, ascSecond: r2 });
    await p.close();
  }
  await page.close();

  // name filter with a term that must exist
  const D = JSON.parse(require('node:fs').readFileSync('/home/muse-newapi/makefun-token-radar/work/out/data.js', 'utf8').replace(/^window\.RADAR=/, '').replace(/;\n$/, ''));
  const term = D.rows[0].name.split(' ')[0];
  page = await open();
  await page.type('#controls input[type=search]', term);
  await new Promise((r) => setTimeout(r, 250));
  res.nameFilter = { term, rows: await page.$$eval('tbody tr', (r) => r.length),
    expected: D.rows.filter((r) => (r.name + ' ' + r.slug + ' ' + (r.category || '') + ' ' + r.chains.join(' ')).toLowerCase().includes(term.toLowerCase())).length };
  await page.close();

  // scope filter: is there a scope control anywhere?
  page = await open();
  res.scopeUI = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, select, input, [role=radio], [role=tab]').forEach((e) => {
      const t = (e.innerText || e.value || e.getAttribute('aria-label') || '').trim();
      if (/watchlist|off the list|early|scope/i.test(t)) out.push(e.tagName + ':' + t.slice(0, 60) + ' :' + (e.id || e.className || ''));
    });
    return out;
  });
  await page.close();
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
