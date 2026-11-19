// Check, on a FRESH page each time:
//  A) the "Scope" and "Category" table columns are NOT sortable (README: "Sortable on every column")
//  B) the "7d" column sorts by RAW change_7d, not the clamped figure the copy says the formula reads
//  C) the plot dot SIZE is by TVL (README) -- check radius vs tvl
//  D) the scope chips work
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const fs = require('node:fs');
const URL = 'file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html';
const D = JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/out/data.js', 'utf8').replace(/^window\.RADAR=/, '').replace(/;\n$/, ''));

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

  // A) Scope / Category sortable?
  let page = await open();
  res.scopeCategorySortable = await page.$$eval('thead th', (ts) => ts.map((t) => ({ text: t.innerText.trim(), btn: !!t.querySelector('button') })));
  await page.close();

  // B) 7d sort uses raw change_7d: find rows whose displayed 7d is clamped but raw is beyond
  const clampedRows = D.rows.filter((r) => r.change_7d !== null && (r.change_7d < -60 || r.change_7d > 120));
  res.clampedRows = clampedRows.map((r) => ({ slug: r.slug, raw: r.change_7d, shown: r.growth_pct }));
  page = await open();
  await page.evaluate(() => document.querySelectorAll('thead th button')[3].click()); // 7d button index 3 (rank, name, tvl, 7d)
  await new Promise((r) => setTimeout(r, 200));
  res.sevenDayColumn = await page.$$eval('tbody tr', (rs) => rs.slice(0, 8).map((tr) => tr.children[5].innerText.trim()));
  await page.close();

  // check: does the row displayed for a clamped protocol show the raw or clamped figure?
  page = await open();
  const top = clampedRows.sort((a, b) => b.change_7d - a.change_7d)[0];
  res.clampedCheck = await page.evaluate((slug) => {
    const rows = [...document.querySelectorAll('tbody tr')];
    for (const tr of rows) { if (tr.children[1].innerText.includes(slug)) return null; }
    return null;
  }, top.slug);
  // find it by name
  res.clampedRowShown = await page.evaluate((name) => {
    const trs = [...document.querySelectorAll('tbody tr')];
    const tr = trs.find((t) => t.children[1].innerText.trim() === name);
    return tr ? { cells: [...tr.children].map((c) => c.innerText.trim()) } : 'not found';
  }, D.rows.find((r) => r.slug === top.slug).name);
  await page.close();

  // C) plot dot radius vs TVL
  page = await open();
  res.plot = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('svg circle')];
    const bySlug = {};
    cs.forEach((c) => { bySlug[c.getAttribute('data-slug')] = { r: +c.getAttribute('r'), cx: +c.getAttribute('cx'), cy: +c.getAttribute('cy') }; });
    const rows = window.RADAR.rows;
    const pairs = rows.map((r) => ({ slug: r.slug, tvl: r.tvl_usd, r: bySlug[r.slug] ? bySlug[r.slug].r : null, p: r.launch_probability, v: r.implied_value_usd }));
    // is r monotone in tvl?
    const s = pairs.filter((p) => p.r !== null).sort((a, b) => a.tvl - b.tvl);
    let mono = true;
    for (let i = 1; i < s.length; i++) if (s[i].r < s[i - 1].r - 1e-9) mono = false;
    // is cx monotone in launch probability?
    const byP = pairs.filter((p) => p.r !== null).sort((a, b) => a.p - b.p);
    let monoX = true;
    for (let i = 1; i < byP.length; i++) if (byP[i].cx < byP[i - 1].cx - 1e-9) monoX = false;
    // is cy monotone decreasing in implied value?
    const byV = pairs.filter((p) => p.r !== null).sort((a, b) => a.v - b.v);
    let monoY = true;
    for (let i = 1; i < byV.length; i++) if (byV[i].cy < byV[i - 1].cy - 1e-9) monoY = false;
    return { n: pairs.length, radiusMonotoneInTVL: mono, xMonotoneInOdds: monoX, yMonotoneInValue: monoY,
      rMin: Math.min(...s.map((x) => x.r)), rMax: Math.max(...s.map((x) => x.r)) };
  });
  await page.close();

  // D) scope chips
  page = await open();
  res.chips = await page.$$eval('#controls .chip', (cs) => cs.map((c) => c.innerText.trim()));
  await page.evaluate(() => { [...document.querySelectorAll('#controls .chip')].find((c) => /Watchlist/.test(c.innerText)).click(); });
  await new Promise((r) => setTimeout(r, 200));
  res.watchlistOnlyRows = await page.$$eval('tbody tr', (rs) => rs.length);
  res.watchlistOnlyAllWatch = await page.$$eval('tbody tr', (rs) => rs.every((r) => /watchlist/i.test(r.children[2].innerText)));
  await page.evaluate(() => { [...document.querySelectorAll('#controls .chip')].find((c) => /Off list/.test(c.innerText)).click(); });
  await new Promise((r) => setTimeout(r, 200));
  res.offListOnlyRows = await page.$$eval('tbody tr', (rs) => rs.length);
  await page.close();

  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
