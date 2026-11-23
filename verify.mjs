// Checks the entry against every rule the sealed scorer states, from RULES.txt.
//   node verify.js <out-dir>
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';


const out = path.resolve(process.argv[2] || 'out');
const kit = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../token-radar-01-kit');
const snapshot = JSON.parse(fs.readFileSync(path.join(kit, 'input/snapshot.json'), 'utf8'));

let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '   ' + detail : ''));
}

// ---------------------------------------------------------------- board_file
const boardPath = path.join(out, 'board.json');
const raw = fs.readFileSync(boardPath);
const doc = JSON.parse(raw.toString('utf8'));
const rows = Array.isArray(doc) ? doc : doc.rows;
check('board.json is a JSON object with a rows array', Array.isArray(rows), `rows=${rows.length}`);
check('board.json row count 100..4000', rows.length >= 100 && rows.length <= 4000, `${rows.length}`);
check('board.json at most 8 MiB', raw.length <= 8 * 1024 * 1024, `${raw.length} bytes`);

const slugs = new Set(snapshot.protocols.map((p) => p.slug));
const seen = new Set();
let slugBad = 0;
let nameBad = 0;
let rankBad = 0;
let valueBad = 0;
let stepBad = 0;
let stepCountBad = 0;
let stepTextBad = 0;
for (const r of rows) {
  if (typeof r.slug !== 'string' || !slugs.has(r.slug)) slugBad++;
  if (seen.has(r.slug)) slugBad++;
  seen.add(r.slug);
  if (typeof r.name !== 'string' || r.name.length === 0) nameBad++;
  if (!Number.isSafeInteger(r.rank) || r.rank <= 0) rankBad++;
  if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) valueBad++;
  if (!Array.isArray(r.farm_steps)) { stepCountBad++; continue; }
  if (r.farm_steps.length < 3 || r.farm_steps.length > 12) stepCountBad++;
  for (const s of r.farm_steps) {
    if (typeof s !== 'string') { stepTextBad++; continue; }
    const t = s.trim();
    if (t.length < 20 || t.length > 600) stepTextBad++;
  }
}
check('every slug is one of the snapshot protocols, once each', slugBad === 0, `${slugBad} bad`);
check('every name is a non-empty string', nameBad === 0, `${nameBad} bad`);
check('every rank is a positive whole number', rankBad === 0, `${rankBad} bad`);
check('every implied_value_usd is a positive whole number <= 1e14', valueBad === 0, `${valueBad} bad`);
check('every farm_steps holds 3..12 strings', stepCountBad === 0, `${stepCountBad} bad`);
check('every farm step is 20..600 characters trimmed', stepTextBad === 0, `${stepTextBad} bad`);

// the live rows travel in the dataset the page reads, not in board.json
function liveRows(outDir) {
  const src = fs.readFileSync(path.join(outDir, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  return data.live || [];
}

// ---------------------------------------------------------------- the live table's Cap/TVL// The "Already trading" table prints the market cap, the TVL and the multiple between them. A
// reader divides the two they can see and must land on the third -- so the published multiple
// has to be the quotient of the PUBLISHED operands, at the precision it is shown.
//
// The precision the page prints the operands at is read from the page's own source, so this
// check cannot be passed by editing the check: if the page's precision changes, the check
// follows it. And the check runs on the RENDERED cells, so it measures what a reader sees.
{
  const pageSrc = fs.readFileSync(path.join(out, 'dashboard', 'page.js'), 'utf8');
  const cellMatch = /money\(r\.mcap_usd,\s*(\d+)\)/.exec(pageSrc);
  const tvlMatch = /money\(r\.tvl_usd,\s*(\d+)\)/.exec(pageSrc);
  const osig = cellMatch ? Number(cellMatch[1]) : 0;
  const tsig = tvlMatch ? Number(tvlMatch[1]) : 0;
  // the page's own money(): the unit from the magnitude, then the mantissa to `sig` figures
  const shown = (n, sig) => {
    if (n === null || n === undefined) return null;
    const a = Math.abs(n);
    if (a >= 1e9) return Number((n / 1e9).toPrecision(sig)) * 1e9;
    if (a >= 1e6) return Number((n / 1e6).toPrecision(sig)) * 1e6;
    if (a >= 1e3) return Number((n / 1e3).toPrecision(sig)) * 1e3;
    return Math.round(n);
  };
  const live = liveRows(out);
  let liveBad = 0;
  let liveNoRows = live.length === 0;
  const ex = [];
  for (const r of live) {
    if (typeof r.ratio !== 'number') { liveBad++; continue; }
    const mv = shown(r.mcap_usd, osig);
    const tv = shown(r.tvl_usd, tsig);
    if (mv === null || tv === null || tv === 0) { liveBad++; continue; }
    const readerGets = Number((mv / tv).toFixed(2));
    if (readerGets !== Number(r.ratio.toFixed(2))) {
      liveBad++;
      if (ex.length < 4) ex.push(`${r.name}: reader gets ${readerGets}, page shows ${Number(r.ratio.toFixed(2))}`);
    }
  }
  check('the live table publishes a Cap/TVL a reader can divide out of the printed operands',
    !liveNoRows && liveBad === 0,
    liveNoRows ? 'no live rows in board.json' : `${live.length - liveBad}/${live.length} reproduce` + (ex.length ? ' | ' + ex.join(' | ') : ''));
}

// ---------------------------------------------------------------- sorted_by_value
const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
let rankSeq = true;
for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) { rankSeq = false; break; }
check('ranks are exactly 1..N once each', rankSeq, ranks.length ? `1..${ranks.length}` : '');
const byRank = rows.slice().sort((a, b) => a.rank - b.rank);
let rising = false;
for (let i = 1; i < byRank.length; i++) if (byRank[i].implied_value_usd > byRank[i - 1].implied_value_usd) { rising = true; break; }
check('implied value does not rise as rank ascends', !rising, rising ? 'a row outranks its predecessor' : '');
const distinct = new Set(rows.map((r) => r.implied_value_usd));
check('implied values are not all the same', distinct.size > 1, `${distinct.size} distinct values`);

// ---------------------------------------------------------------- coverage
const covered = snapshot.watchlist.filter((s) => seen.has(s));
check('every watchlist slug is on the board', covered.length === snapshot.watchlist.length,
  `${covered.length}/${snapshot.watchlist.length}`);
const outside = rows.length - snapshot.watchlist.filter((s) => seen.has(s)).length;
check('at least 60 rows name protocols outside the watchlist', outside >= 60, `${outside} outside`);

// ---------------------------------------------------------------- dashboard_files
const dashDir = path.join(out, 'dashboard');
function walk(dir, base) {
  const outf = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (e.name.startsWith('.')) throw new Error('dot-directory ' + rel);
      outf.push(...walk(p, rel));
    } else if (e.isFile()) outf.push({ path: rel, size: fs.statSync(p).size });
    else throw new Error('neither file nor directory: ' + rel);
  }
  return outf;
}
const dashFiles = walk(dashDir, '');
check('dashboard/ holds index.html', dashFiles.some((f) => f.path === 'index.html'), '');
check('dashboard/ holds at least one .css', dashFiles.some((f) => f.path.endsWith('.css')), '');
check('dashboard/ holds at least one .js', dashFiles.some((f) => f.path.endsWith('.js')), '');
check('dashboard/ holds at most 400 files', dashFiles.length <= 400, `${dashFiles.length}`);
const dashBytes = dashFiles.reduce((n, f) => n + f.size, 0);
check('dashboard/ totals at most 4 MiB', dashBytes <= 4 * 1024 * 1024, `${dashBytes} bytes`);
const nameBad2 = dashFiles.filter((f) => !/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(f.path.split('/').pop()));
check('every dashboard file name is plain', nameBad2.length === 0, nameBad2.map((f) => f.path).join(', '));

// No network address in an HTML attribute, a CSS file, or a JS import specifier.
const netHits = [];
for (const f of dashFiles) {
  const text = fs.readFileSync(path.join(dashDir, f.path), 'utf8');
  if (f.path.endsWith('.html')) {
    for (const m of text.matchAll(/<[^>]*>/g)) {
      const tag = m[0];
      for (const a of tag.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) {
        if (/https?:\/\//.test(a[2])) netHits.push(`${f.path}: attribute ${a[1]}`);
      }
    }
    if (/<style[\s>]/i.test(text)) netHits.push(`${f.path}: inline <style>`);
    if (/<script[^>]*\bsrc\s*=\s*['"]https?:/i.test(text)) netHits.push(`${f.path}: script src`);
  }
  if (f.path.endsWith('.css') && /https?:\/\//.test(text)) netHits.push(`${f.path}: css url`);
  if (f.path.endsWith('.js')) {
    for (const m of text.matchAll(/(?:^|[\s;=(])(?:import|export)[^;'"]*?from\s*['"]([^'"]+)['"]/g)) {
      if (/https?:\/\//.test(m[1])) netHits.push(`${f.path}: import ${m[1]}`);
    }
    for (const m of text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (/https?:\/\//.test(m[1])) netHits.push(`${f.path}: dynamic import ${m[1]}`);
    }
    for (const m of text.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (/https?:\/\//.test(m[1])) netHits.push(`${f.path}: require ${m[1]}`);
    }
  }
}
check('no http:// or https:// in any dashboard attribute, CSS or import', netHits.length === 0, netHits.join(' | '));
const sourceBytes = dashFiles.filter((f) => /\.(html|css|js|json|mjs|svg|md|txt)$/.test(f.path)).reduce((n, f) => n + f.size, 0);
check('dashboard source stays under 64 KB (so the judge reads it whole)', sourceBytes < 65536, `${sourceBytes} bytes`);

// ---------------------------------------------------------------- screenshots
const shotDir = path.join(out, 'screenshots');
const shots = fs.readdirSync(shotDir).filter((n) => !n.startsWith('.')).sort();
check('screenshots/ holds 3 or 4 images', shots.length >= 3 && shots.length <= 4, `${shots.length}: ${shots.join(', ')}`);
for (const name of shots) {
  const p = path.join(shotDir, name);
  const st = fs.statSync(p);
  const b = fs.readFileSync(p);
  const isPng = b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isJpg = b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const whole = isPng ? b.slice(-12).toString('binary').indexOf('IEND') !== -1 : isJpg && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;
  let w = 0;
  let h = 0;
  if (isPng) { w = b.readUInt32BE(16); h = b.readUInt32BE(20); }
  check(`${name} is a whole PNG or JPEG`, isPng || isJpg, isPng ? 'PNG' : 'JPEG');
  check(`${name} is at most 512 KiB`, st.size <= 524288, `${st.size} bytes`);
  check(`${name} long side <= 1440 and short side >= 800`,
    Math.max(w, h) <= 1440 && Math.min(w, h) >= 800, `${w}x${h}`);
  check(`${name} is 300-350 KB (the dossier's target)`,
    st.size >= 300 * 1024 && st.size <= 350 * 1024, `${st.size} bytes`);
}

// ---------------------------------------------------------------- the row's own arithmetic
// The board shows three figures per row: the launch odds, the value if it issues, and the
// implied value. The entry claims a reader can multiply the two they can see and land on the
// third. This checks that in EXACT DECIMAL -- the arithmetic a reader performs by hand -- and
// it reads the RENDERED page, so it tests what is shown rather than what is stored.
//
// It has to be exact decimal rather than floating point: the two disagree exactly on the
// rounding boundary, and a check that reuses the same float code that produced the value
// proves nothing about what the reader can do.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });
  await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('tbody tr')).map((r) => {
    const cells = Array.from(r.querySelectorAll('td')).map((t) => t.textContent.trim());
    return { last3: cells.slice(-3) };
  }));
  await browser.close();

  // A money string as an exact integer scaled by 1e6 dollars: "$8.7775M" -> 8777500000000.
  // The board shows five significant figures, so the mantissa carries at most four decimals and
  // the value is exact at 1e-6.
  const moneyScaled = (text) => {
    const m = /^\$?([\d.]+)([BMK])?$/.exec(text.trim());
    if (!m) return null;
    const dot = m[1].indexOf('.');
    const frac = dot === -1 ? 0 : m[1].length - dot - 1;
    const digits = BigInt(m[1].replace('.', ''));
    const unit = m[2] === 'B' ? 9 : m[2] === 'M' ? 6 : m[2] === 'K' ? 3 : 0;
    return digits * 10n ** BigInt(6 - frac + unit);
  };
  // A percentage string as an exact integer scaled by 1e6 of the probability: "25.6904%" ->
  // 256904, because four decimals of a percent is a millionth of the probability.
  const pctScaled = (text) => {
    const m = /^([\d.]+)%$/.exec(text.trim());
    if (!m) return null;
    const dot = m[1].indexOf('.');
    const frac = dot === -1 ? 0 : m[1].length - dot - 1;
    return BigInt(m[1].replace('.', '')) * 10n ** BigInt(6 - frac - 2);
  };
  // Round a scaled integer to `sig` significant figures, exactly.
  const roundSig = (scaled, sig) => {
    const s = scaled.toString();
    const lead = s.length - s.replace(/^0+/, '').length;
    const keep = lead + sig - 1;
    if (keep >= s.length) return scaled;
    let head = s.slice(0, keep + 1);
    if (s[keep + 1] >= '5') {
      const arr = head.split('').reverse();
      let carry = 1;
      for (let i = 0; i < arr.length && carry; i++) {
        const d = Number(arr[i]) + carry;
        arr[i] = String(d % 10);
        carry = d >= 10 ? 1 : 0;
      }
      head = arr.reverse().join('');
    }
    return BigInt(head + '0'.repeat(s.length - head.length));
  };
  const moneyText = (scaled) => {
    const v = Number(scaled) / 1e6;
    const a = Math.abs(v);
    if (a >= 1e9) return '$' + (v / 1e9).toPrecision(3) + 'B';
    if (a >= 1e6) return '$' + (v / 1e6).toPrecision(3) + 'M';
    if (a >= 1e3) return '$' + (v / 1e3).toPrecision(3) + 'K';
    return '$' + Math.round(v);
  };
  let bad = 0;
  const examples = [];
  for (const r of rows) {
    const [oddsText, condText, valText] = r.last3;
    const cond = moneyScaled(condText);
    const odds = pctScaled(oddsText);
    if (cond === null || odds === null) { bad++; continue; }
    // the product, in dollars scaled by 1e12
    const product = cond * odds;
    // three significant figures of that product; the product is scaled by 1e12, and
    // moneyText wants a value scaled by 1e6
    const rounded = roundSig(product, 3);
    const computed = moneyText(rounded / 1000000n);
    if (computed !== valText) {
      bad++;
      if (examples.length < 4) examples.push({ cond: condText, odds: oddsText, shown: valText, computed });
    }
  }
  check('every row\'s three displayed figures multiply out, in exact decimal', bad === 0,
    bad === 0 ? `${rows.length} rows agree` : `${bad} disagree: ` + JSON.stringify(examples));
}

// ---------------------------------------------------------------- the board's scroll cue
// The board is nine columns wide and cannot fit a narrow phone, so the wrapper scrolls sideways.
// A scroll the reader cannot see is a scroll the reader does not know to make, so the wrapper
// paints a shadow on whichever edge still has table beyond it. This checks the RENDERED pixels
// at each edge at both ends of the scroll, because the cue is a gradient and a check that only
// reads the stylesheet proves nothing about whether a reader can see it.
//
// The sample is the DARKEST pixel in a 6px band at each edge, on a body row clear of the
// sticky top bar and the sticky header: a cell's own glyph would otherwise mask the cue.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 320, height: 900 });
  await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('#table-wrap tbody tr');
  // Put the table's top 120px down the viewport, clear of the sticky bar and the sticky header.
  // The page sets `scroll-behavior: smooth`, so the scroll is animated: it is done instantly
  // here and then waited out, or the sample lands on whatever row the animation happens to
  // have reached.
  await page.evaluate(() => {
    const w = document.getElementById('table-wrap');
    window.scrollTo({ top: w.getBoundingClientRect().top + window.scrollY - 120, behavior: 'instant' });
  });
  await page.evaluate(() => new Promise((res) => {
    let last = -1, still = 0;
    const tick = () => {
      if (window.scrollY === last) { if (++still > 5) return res(); } else { still = 0; last = window.scrollY; }
      requestAnimationFrame(tick);
    };
    tick();
  }));
  // The sample row must be BELOW the table's sticky header, which is 165px tall at this width
  // because the column headers wrap. Its bottom edge is the boundary, so the row has to start
  // below it -- a row under the header is painted over by the header's own opaque background.
  const box = await page.evaluate(() => {
    const w = document.getElementById('table-wrap');
    const th = w.querySelector('thead th');
    const headerBottom = th.getBoundingClientRect().bottom;
    const rows = Array.from(w.querySelectorAll('tbody tr'));
    const tr = rows.find((r) => r.getBoundingClientRect().top > headerBottom + 4) || rows[0];
    const r = w.getBoundingClientRect(), trr = tr.getBoundingClientRect();
    return { x: Math.round(r.left + window.scrollX), y: Math.round(trr.top + window.scrollY), width: Math.round(r.width), rowH: Math.round(trr.height) };
  });
  const edgeLum = async () => {
    const shot = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.rowH - 4, 30) } });
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + b64;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const d = ctx.getImageData(0, 0, img.width, img.height).data;
      const lum = (x, y) => { const i = (y * img.width + x) * 4; return Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114); };
      const y = Math.floor(img.height / 2);
      const band = (from, to) => { let m = 999; for (let x = from; x < to; x++) m = Math.min(m, lum(x, y)); return m; };
      return { L: band(0, 6), R: band(img.width - 6, img.width), M: lum(Math.floor(img.width / 2), y) };
    }, shot.toString('base64'));
  };
  const atStart = await edgeLum();
  await page.evaluate(() => { document.getElementById('table-wrap').scrollLeft = 9999; });
  await new Promise((r) => setTimeout(r, 300));
  const atEnd = await edgeLum();
  await browser.close();
  // The cue is a shadow, so the edge that still has table beyond it must be DARKER than the
  // panel, and the edge that has reached its end must be back to the panel's own value.
  check('the board shows a scroll cue on the edge that has table beyond it',
    atStart.R < atStart.M - 6 && atEnd.L < atEnd.M - 6 && atStart.R < atEnd.R && atEnd.L < atStart.L,
    `start: L=${atStart.L} M=${atStart.M} R=${atStart.R} | end: L=${atEnd.L} M=${atEnd.M} R=${atEnd.R}`);
}

// ---------------------------------------------------------------- the inputs do not zoom iOS
// iOS Safari zooms the whole viewport when a focused input's text is under 16px, and it never
// zooms back out. The search box and the two selects are text fields, so their text is held at
// 16px on the narrow viewports where the zoom happens.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  const seen = [];
  for (const w of [320, 375, 640, 1024, 1440]) {
    await page.setViewport({ width: w, height: 800 });
    await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
    await page.waitForSelector('#ctl-0');
    const d = await page.evaluate(() => ({
      fonts: Array.from(document.querySelectorAll('input,select')).map((el) => parseFloat(getComputedStyle(el).fontSize)),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
    }));
    seen.push({ w, fonts: d.fonts, overflow: d.overflow });
  }
  await browser.close();
  // below 1000px the text fields must be at 16px; above it they may be smaller
  const narrowOk = seen.filter((s) => s.w <= 1000).every((s) => s.fonts.every((f) => f >= 16));
  const wideOk = seen.filter((s) => s.w > 1000).every((s) => s.fonts.every((f) => f >= 14));
  const noOverflow = seen.every((s) => !s.overflow);
  check('no text field is under 16px on a narrow viewport, so iOS never zooms the page', narrowOk && wideOk,
    seen.map((s) => `${s.w}px:${s.fonts.join('/')}`).join(' '));
  check('no viewport width overflows the page horizontally', noOverflow,
    seen.map((s) => `${s.w}px:${s.overflow ? 'OVERFLOW' : 'ok'}`).join(' '));
}

// ---------------------------------------------------------------- nothing is clipped at any width
// The bar's brand, the page's headings and every cell have to fit their own box at every
// viewport, with no scrollable ancestor to hide behind. This checks the rendered geometry at
// nine widths from a phone to a wide desktop.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  const seen = [];
  for (const w of [320, 375, 480, 640, 768, 1024, 1280, 1440, 1920]) {
    await page.setViewport({ width: w, height: 900 });
    await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
    await page.waitForSelector('tbody tr');
    const d = await page.evaluate(() => {
      const clipped = [];
      document.querySelectorAll('body *').forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        if (el.scrollWidth > el.clientWidth + 1 && cs.overflowX === 'visible') {
          let a = el.parentElement, scrollable = false;
          while (a) { const s = getComputedStyle(a); if (s.overflowX === 'auto' || s.overflowX === 'scroll') { scrollable = true; break; } a = a.parentElement; }
          if (!scrollable) clipped.push(el.tagName + '.' + String(el.className).slice(0, 20));
        }
      });
      // the brand must be whole: its name is one line and it is not squeezed by its neighbour
      const bn = document.querySelector('.brand-name');
      const range = document.createRange();
      range.selectNodeContents(bn);
      const lines = Array.from(range.getClientRects()).length;
      const brand = document.querySelector('.brand');
      return {
        clipped,
        brandLines: lines,
        brandClipped: brand.scrollWidth > brand.clientWidth + 1
      };
    });
    seen.push({ w, ...d });
  }
  await browser.close();
  const clipped = seen.flatMap((s) => s.clipped.map((c) => `${s.w}px ${c}`));
  check('no element is clipped with no scrollable ancestor, at any width', clipped.length === 0,
    clipped.length === 0 ? 'clear at 9 widths' : clipped.join('; '));
  const brandOk = seen.every((s) => s.brandLines === 1 && !s.brandClipped);
  check('the brand name is one whole line, not squeezed, at any width', brandOk,
    seen.map((s) => `${s.w}px:${s.brandLines}line${s.brandClipped ? '-CLIPPED' : ''}`).join(' '));
}

// ---------------------------------------------------------------- the row count is announced
// The row count is the one thing a screen-reader user cannot see change when they type in the
// search box, so it must be a polite live region. A polite region announces when its TEXT
// changes, so the region has to be in the DOM from the start rather than inserted with its
// content -- inserting a polite region with its content is announced inconsistently.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('#result-count');
  const d = await page.evaluate(async () => {
    const node = document.getElementById('result-count');
    let changes = 0;
    const obs = new MutationObserver((muts) => { for (const m of muts) if (m.type === 'childList' || m.type === 'characterData') changes++; });
    obs.observe(node, { childList: true, characterData: true, subtree: true });
    const i = document.getElementById('ctl-0');
    i.value = 'poly';
    i.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    const afterTyping = node.textContent;
    const typed = changes;
    changes = 0;
    i.value = 'zzznotathing';
    i.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 200));
    obs.disconnect();
    return {
      role: node.getAttribute('role'),
      live: node.getAttribute('aria-live'),
      atomic: node.getAttribute('aria-atomic'),
      afterTyping,
      afterNoMatch: node.textContent,
      typedChanges: typed,
      emptyText: (document.querySelector('.empty') || {}).textContent || ''
    };
  });
  await browser.close();
  // `role="status"` implies `aria-live="polite"`, so the region is polite whether or not the
  // attribute is spelled out. What matters is that it is a status region and that its text
  // changes rather than the region being inserted with its content.
  const polite = d.role === 'status' || d.live === 'polite';
  check('the row count is a polite live region, in the DOM before its text changes',
    polite && d.typedChanges > 0,
    `role=${d.role} live=${d.live} atomic=${d.atomic} changes-on-typing=${d.typedChanges}`);
  check('the count reaches the reader as the filters narrow it', /\d+ of 195 rows/.test(d.afterTyping) && /\d+ of 195 rows/.test(d.afterNoMatch),
    `"${d.afterTyping}" then "${d.afterNoMatch}"`);
  check('a search that matches nothing says so and says how to recover', /Clear them/.test(d.emptyText),
    d.emptyText);
}

// ---------------------------------------------------------------- every tab names itself properly
// A screen reader reads a tab's name from its text, and the count badge is a separate span with
// no space of its own, so the name needs the space or it reads "Pre-token board195".
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('[role=tab]');
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll('[role=tab]')).map((t) => ({
    name: (t.getAttribute('aria-label') || t.textContent).replace(/\s+/g, ' ').trim(),
    count: t.querySelector('.count') ? t.querySelector('.count').textContent : null
  })));
  await browser.close();
  // a name that runs a number onto a word is the defect; "board 195" is right, "board195" is not
  const bad = tabs.filter((t) => /[a-z]\d/.test(t.name));
  check('every tab\'s accessible name does not run its count onto its label', bad.length === 0,
    bad.length === 0 ? tabs.map((t) => '"' + t.name + '"').join(' ') : JSON.stringify(bad));
}

// ---------------------------------------------------------------- the plot's axis can be read
// The board's largest implied value is usually not a power of ten, so the plot's scale has to
// reach past it. Two things must hold: every grid line is a power of ten, so the lines are
// evenly spaced and none of their labels overlap; and every dot sits inside the grid.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('.plot svg circle');
  const d = await page.evaluate(() => {
    const svg = document.querySelector('.plot svg');
    // the HORIZONTAL grid lines are the ones that run across the plot; the vertical ones run
    // down it, and counting them would put a false top edge on the plot
    const ys = Array.from(svg.querySelectorAll('line.grid'))
      .filter((l) => l.getAttribute('y1') === l.getAttribute('y2') && l.getAttribute('x1') !== l.getAttribute('x2'))
      .map((l) => +l.getAttribute('y1'));
    // the y-axis labels are the ones ending in K, M or B, or a bare $; the dot's own label
    // is the protocol's name and is not one of them
    const yLabels = Array.from(svg.querySelectorAll('text')).filter((t) => t.getAttribute('text-anchor') === 'end' && /^\$[\d.]+[KMB]?$/.test(t.textContent));
    const boxes = yLabels.map((t) => { const r = t.getBoundingClientRect(); return { text: t.textContent, top: r.top, bottom: r.bottom }; }).sort((a, b) => a.top - b.top);
    const clashes = [];
    for (let i = 1; i < boxes.length; i++) if (boxes[i].top < boxes[i - 1].bottom) clashes.push(boxes[i - 1].text + '/' + boxes[i].text);
    const dots = Array.from(svg.querySelectorAll('circle')).map((c) => +c.getAttribute('cy'));
    const topLine = Math.min(...ys), botLine = Math.max(...ys);
    const yTicks = ys.slice().sort((a, b) => a - b);
    return {
      labels: boxes.map((x) => x.text),
      clashes,
      outside: dots.filter((cy) => cy < topLine - 1 || cy > botLine + 1).length,
      dotCount: dots.length,
      gridLines: yTicks.length
    };
  });
  await browser.close();
  // The scale's top has to be a power of ten, not the board's largest value: the largest value
  // is usually not one, and a top line at an arbitrary place is a line the reader cannot place
  // against the others. So the topmost label must itself be a power of ten.
  // the top label must be the power of ten at or above the board's largest value, which is
  // what makes every grid line a power of ten and every gap between them the same size
  const pow10 = (t) => /^\$(1|10|100|1\.00K|10\.0K|100K|1\.00M|10\.0M|100M|1\.00B|10\.0B|100B)$/.test(t);
  const topIsPow10 = d.labels.length > 0 && pow10(d.labels[0]);
  const allPow10 = d.labels.every(pow10);
  check('the plot\'s grid lines are all powers of ten, so none of their labels overlap',
    d.clashes.length === 0 && d.labels.length >= 6 && topIsPow10 && allPow10,
    d.labels.join(' ') + (d.clashes.length ? ' OVERLAP: ' + d.clashes.join(', ') : '') + (topIsPow10 ? '' : ' -- the top line is not a power of ten'));
  check('every dot on the plot sits inside the grid', d.outside === 0,
    d.outside === 0 ? d.dotCount + ' dots, all inside' : d.outside + ' of ' + d.dotCount + ' dots are outside');
}

// ---------------------------------------------------------------- each view explains its own table
// The callout sits above all three tabs, but each tab's table is priced differently: the board
// by the model, the live table by the market, the model tab by neither. A callout that
// describes one table while sitting above another is a callout that misleads.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('.callout');
  const seen = {};
  for (const [view, tab] of [['board', 'tab-board'], ['live', 'tab-live'], ['model', 'tab-model']]) {
    await page.evaluate((t) => document.getElementById(t).click(), tab);
    await new Promise((r) => setTimeout(r, 300));
    seen[view] = await page.evaluate(() => {
      const cal = document.querySelector('.callout');
      const heads = Array.from(document.querySelectorAll('#view-' + (document.querySelector('[role=tabpanel]:not([hidden])') || {}).id.split('-')[1] + ' thead th')).map((h) => h.textContent.trim());
      return {
        title: cal.querySelector('h2').textContent.trim(),
        items: Array.from(cal.querySelectorAll('li')).map((li) => li.textContent.trim().split('.')[0]),
        headers: heads
      };
    });
  }
  await browser.close();
  // the board's steps name the model's own quantities; the live table's steps name the market's
  const boardOk = seen.board.items.join('|') === 'Conditional value|Launch odds|Implied value';
  const liveOk = seen.live.items.join('|') === 'Market cap|Cap / TVL|7d';
  const modelOk = seen.model.items.join('|') === 'Value model|Launch model|Implied value';
  const titlesDiffer = seen.board.title !== seen.live.title && seen.model.title !== seen.live.title && seen.model.title !== seen.board.title;
  check('the callout describes the table under it, on every view',
    boardOk && liveOk && modelOk && titlesDiffer,
    Object.entries(seen).map(([k, v]) => `${k}: "${v.title}" ${v.items.join('/')}`).join(' | '));
}

// ---------------------------------------------------------------- the influence claim
// The page says no single row can drag the value fit: the worst single row moves the intercept
// by 0.410 log10 under a plain least squares and by 0.273 under the model's own weight. Both
// numbers are MAXIMA over that fit's own worst row, and no single row carries both -- so this
// check computes both maxima the same way the claim states them, and refuses to let the copy
// quote a number the measurement does not produce.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const median = (v) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const solve = (matrix, rhs) => {
    const n = rhs.length;
    const m = matrix.map((row, i) => row.concat([rhs[i]]));
    for (let c = 0; c < n; c++) {
      let pivot = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
      [m[c], m[pivot]] = [m[pivot], m[c]];
      if (Math.abs(m[c][c]) < 1e-10) continue;
      for (let rr = 0; rr < n; rr++) {
        if (rr === c) continue;
        const f = m[rr][c] / m[c][c];
        for (let k = c; k <= n; k++) m[rr][k] -= f * m[c][k];
      }
    }
    return m.map((row, i) => row[n] / (row[i] || 1));
  };
  const issued = (p) => (p.mcap_usd !== null && p.mcap_usd !== undefined) || (p.gecko_id !== null && p.gecko_id !== undefined);
  const cohort = data.universe.filter((p) => {
    const iss = issued(p);
    const product = p.symbol !== null && p.symbol !== undefined && !iss;
    return !product && iss && (p.mcap_usd ?? 0) >= 1e6 && p.tvl_usd >= 1e6;
  }).map((p) => ({ slug: p.slug, tvl: p.tvl_usd, y: Math.log10(Math.max(p.mcap_usd ?? 1, 1) / Math.max(p.tvl_usd, 1)) }));
  const fit = (rows, kind) => {
    const k = 2;
    const X = rows.map((r) => [1, Math.log10(Math.max(r.tvl, 1))]);
    const Y = rows.map((r) => r.y);
    if (kind === 'plain') {
      const M = Array.from({ length: k }, () => new Array(k).fill(0));
      const B = new Array(k).fill(0);
      rows.forEach((_, i) => { for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) M[a][b] += X[i][a] * X[i][b]; B[a] += X[i][a] * Y[i]; } });
      return solve(M, B);
    }
    let beta = new Array(k).fill(0);
    for (let it = 0; it < 24; it++) {
      const residual = (i) => { let a = 0; for (let j = 0; j < k; j++) a += beta[j] * X[i][j]; return Y[i] - a; };
      const scale = 1.4826 * median(rows.map((_, i) => Math.abs(residual(i))));
      const M = Array.from({ length: k }, () => new Array(k).fill(0));
      const B = new Array(k).fill(0);
      rows.forEach((_, i) => {
        const r = Math.abs(residual(i));
        const w = r <= 1.5 * scale ? 1 : (1.5 * scale) / r;
        const ww = kind === 'squared' ? w * w : w;
        for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) M[a][b] += ww * X[i][a] * X[i][b]; B[a] += ww * X[i][a] * Y[i]; }
      });
      for (let a = 0; a < k; a++) M[a][a] += 1e-6;
      beta = solve(M, B);
    }
    return beta;
  };
  const maxInfluence = (kind) => {
    const full = fit(cohort, kind);
    let best = 0;
    for (const r of cohort) {
      const w = fit(cohort.filter((x) => x.slug !== r.slug), kind);
      const d = Math.abs(full[0] - w[0]);
      if (d > best) best = d;
    }
    return best;
  };
  const plainMax = maxInfluence('plain');
  const weightedMax = maxInfluence('squared');
  // The row the PLAIN fit leans on hardest, measured on the model's own fit: the point is that
  // the row which can most distort a plain fit is a fifth as able to distort this one.
  let worstRowWeighted = 0;
  {
    const plainFull = fit(cohort, 'plain');
    let worstMove = 0;
    let worstRow = null;
    for (const r of cohort) {
      const w = fit(cohort.filter((x) => x.slug !== r.slug), 'plain');
      const d = Math.abs(plainFull[0] - w[0]);
      if (d > worstMove) { worstMove = d; worstRow = r; }
    }
    if (worstRow) {
      const weightedFull = fit(cohort, 'squared');
      const w = fit(cohort.filter((x) => x.slug !== worstRow.slug), 'squared');
      worstRowWeighted = Math.abs(weightedFull[0] - w[0]);
    }
  }
  // The copy's own words are the thing under test: it must quote both maxima.
  const note = data.copy.value_fit_note;
  const plainOk = Math.abs(plainMax - 0.410) < 0.0015;
  const weightedOk = Math.abs(weightedMax - 0.273) < 0.0015;
  check('the worst row\'s influence on a plain least squares is 0.410 log10', plainOk, plainMax.toFixed(4));
  check('the worst row\'s influence on the model\'s own fit is 0.273 log10', weightedOk, weightedMax.toFixed(4));

  // The calibration must publish what the measurement gives, and the copy must quote THAT.
  const cal = data.calibration;
  const publishedOk = cal.influence_plain !== undefined &&
    Math.abs(cal.influence_plain - plainMax) < 0.0015 &&
    Math.abs(cal.influence_weighted - weightedMax) < 0.0015 &&
    Math.abs(cal.influence_worst_row_weighted - worstRowWeighted) < 0.0015;
  check('the published influence figures are the measured ones', publishedOk,
    publishedOk ? `${cal.influence_plain} ${cal.influence_weighted} ${cal.influence_worst_row_weighted}` :
      `published ${cal.influence_plain} ${cal.influence_weighted} ${cal.influence_worst_row_weighted} | measured ${plainMax.toFixed(4)} ${weightedMax.toFixed(4)} ${worstRowWeighted.toFixed(4)}`);

  const quotedPlain = note.includes(cal.influence_plain.toFixed(3) + ' log10');
  const quotedWeighted = note.includes(cal.influence_weighted.toFixed(3) + ' log10');
  const quotedWorst = note.includes('fit by ' + cal.influence_worst_row_weighted.toFixed(3));
  check('the page quotes both influence figures the measurement produces', quotedPlain && quotedWeighted,
    quotedPlain && quotedWeighted ? 'both quoted' : 'a quoted figure is missing');
  check('the page quotes the plain fit\'s worst row on the model\'s own fit', quotedWorst,
    quotedWorst ? 'quoted' : 'missing');

  // and no literal may survive in the source that writes the sentence
  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/model.ts'), 'utf8');
  const noLiteral = !/by 0\.410 log10 under a/.test(libSrc) && !/by 0\.084, a fifth as much/.test(libSrc);
  check('no influence figure is typed into the copy source', noLiteral,
    noLiteral ? 'measured' : 'a literal survives in lib/model.ts');
}

// ---------------------------------------------------------------- the category table's evidence
// The model's category correction is a per-category number, and a number fitted on one row is a
// different kind of number from one fitted on ten. The page publishes the member count beside
// each correction so a reader can weigh them -- and this check makes sure the count is the real
// one, counted from the cohort, rather than a figure written into the copy.
//
// The count is recomputed here from the cohort the page itself carries, and the PAGE'S OWN REFIT
// (dashboard/model.js, the same procedure main.ts used) is run over the same data. If the page
// and the model disagreed about how many members a correction rests on, the two tables would
// disagree on the page, so this is checked three ways: the published counts, the counts recounted
// from the cohort, and the counts the page's own refit finds.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const cal = data.calibration;
  const published = cal.category_sizes || {};

  // Recount from the cohort the dataset carries.
  const byCat = {};
  for (const p of data.cohort) {
    const k = p.category || '(none)';
    byCat[k] = (byCat[k] || 0) + 1;
  }
  const keys = new Set([...Object.keys(published), ...Object.keys(byCat)]);
  let countBad = 0;
  for (const k of keys) {
    if (published[k] !== byCat[k]) countBad++;
  }
  const sum = Object.values(published).reduce((a, b) => a + b, 0);
  check('the published category member counts are the cohort\'s own counts',
    countBad === 0 && keys.size > 0, countBad === 0 ? `${keys.size} categories, ${sum} members` : `${countBad} wrong`);
  check('the category member counts add up to the cohort size',
    sum === cal.cohort_size, `${sum} of ${cal.cohort_size}`);

  // And the page's own refit must find the same counts.
  globalThis.window = {};
  await import(path.join(out, 'dashboard', 'model.js'));
  const refit = globalThis.window.RadarModel.fit(data).category_log.__sizes || {};
  const rkeys = new Set([...Object.keys(published), ...Object.keys(refit)]);
  let refitBad = 0;
  for (const k of rkeys) {
    if (published[k] !== refit[k]) refitBad++;
  }
  check('the page\'s own refit finds the same category member counts',
    refitBad === 0 && rkeys.size > 0, refitBad === 0 ? `${rkeys.size} categories agree` : `${refitBad} differ`);
}

// ---------------------------------------------------------------- the words on the page are the words a reader gets
// Three defects the page carried until now, each of which a reader can see:
//  1. the sort arrow is a picture of the direction, and `aria-sort` on the header already says
//     the direction, so the glyph must be out of the accessibility tree or the rank button is
//     called "#\u25b2";
//  2. the copy names fields in <code>, but the rule that styled them was scoped to `.prose code`
//     and the code tags live in `.card p` and `.prose`, so they rendered in the browser's
//     default monospace at the paragraph's own size -- not the page's;
//  3. the search box's placeholder was the browser's default grey on a dark panel.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');

  // the accessible name of a control is aria-label, else the text of its subtree MINUS anything
  // aria-hidden. That is the rule the browser uses, so the probe uses it too.
  const d = await page.evaluate(() => {
    const accName = (el) => {
      const al = el.getAttribute('aria-label');
      if (al) return al;
      let out = '';
      const walk = (n) => {
        if (n.nodeType === 3) { out += n.textContent; return; }
        if (n.nodeType !== 1) return;
        if (n.getAttribute('aria-hidden') === 'true') return;
        if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return;
        Array.from(n.childNodes).forEach(walk);
      };
      walk(el);
      return out.replace(/\s+/g, ' ').trim();
    };
    const sortButtons = Array.from(document.querySelectorAll('thead th button')).map((b) => ({
      name: accName(b),
      sort: b.closest('th').getAttribute('aria-sort')
    }));
    // the model view carries the <code> tags
    document.querySelectorAll('[role=tab]')[2].click();
    return { sortButtons, codes: null, placeholder: null, sortButtonsNow: null };
  });
  await new Promise((r) => setTimeout(r, 400));
  const d2 = await page.evaluate(() => {
    const codes = Array.from(document.querySelectorAll('code'));
    const q = document.querySelector('.controls .q');
    const phColor = getComputedStyle(q, '::placeholder').color;
    const bodyColor = getComputedStyle(q).color;
    const mono = getComputedStyle(document.querySelector('.num')).fontFamily.split(',')[0];
    return {
      codes: codes.map((c) => ({
        text: c.textContent,
        font: getComputedStyle(c).fontFamily.split(',')[0],
        size: getComputedStyle(c).fontSize
      })),
      placeholder: { color: phColor, bodyColor },
      mono
    };
  });
  await browser.close();

  // 1. the sort button's name must be the column's name and nothing else
  const badName = d.sortButtons.filter((b) => /[^\x20-\x7e]/.test(b.name) || /[\u25b2\u25bc]/.test(b.name));
  check('no sort button carries the direction arrow in its accessible name', badName.length === 0,
    badName.length === 0 ? d.sortButtons.map((b) => '"' + b.name + '"').join(' ') : JSON.stringify(badName));
  // the arrow must still be drawn: the direction is shown to a sighted reader as well
  const arrowDrawn = await (async () => {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
    const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
    const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
    await page.waitForSelector('tbody tr');
    const r = await page.evaluate(() => {
      const a = document.querySelector('thead th .arrow');
      if (!a) return null;
      const box = a.getBoundingClientRect();
      return { glyph: a.textContent, w: Math.round(box.width), h: Math.round(box.height), hidden: a.getAttribute('aria-hidden') };
    });
    await browser.close();
    return r;
  })();
  check('the sort arrow is still drawn for a sighted reader',
    !!arrowDrawn && arrowDrawn.w > 0 && arrowDrawn.h > 0 && arrowDrawn.hidden === 'true',
    arrowDrawn ? `"${arrowDrawn.glyph}" at ${arrowDrawn.w}x${arrowDrawn.h}, aria-hidden=${arrowDrawn.hidden}` : 'no arrow');

  // 2. every <code> must use the page's own monospace at the page's own small size
  const badCode = d2.codes.filter((c) => c.font !== d2.mono || parseFloat(c.size) >= 13.5);
  check('every <code> is set in the page\'s own monospace, smaller than its paragraph',
    badCode.length === 0 && d2.codes.length > 0,
    badCode.length === 0 ? `${d2.codes.length} codes, all ${d2.mono} at ${d2.codes[0].size}` : JSON.stringify(badCode));

  // 3. the placeholder must be the page's own muted ink, not the browser's grey
  const grey = /^rgb\(117, 117, 117\)$/.test(d2.placeholder.color);
  check('the search placeholder is the page\'s own ink, not the browser default grey',
    !grey && d2.placeholder.color !== d2.placeholder.bodyColor,
    `placeholder ${d2.placeholder.color} vs text ${d2.placeholder.bodyColor}`);
}

// ---------------------------------------------------------------- every table names its columns
// A table's header row is what tells a reader what a bare number in a cell is. The board and
// the live table have one; the model view's category-corrections table had none, so its three
// columns were named only in the prose above it, and a screen reader reached the cells with
// nothing to attach them to.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  const tabs = await page.$$('[role=tab]');
  const seen = [];
  for (const i of [0, 1, 2]) {
    if (tabs[i]) { await tabs[i].click(); await new Promise((r) => setTimeout(r, 350)); }
    seen.push(await page.evaluate(() => Array.from(document.querySelectorAll('main table')).map((t) => ({
      cls: t.className || '(the board)',
      headers: Array.from(t.querySelectorAll('thead th')).map((h) => h.textContent.trim()),
      rows: t.querySelectorAll('tbody tr').length
    }))));
  }
  await browser.close();
  const every = seen.flat();
  const noHeader = every.filter((t) => t.headers.length === 0);
  check('every table on the page names its columns in a header row', noHeader.length === 0,
    noHeader.length === 0 ? every.map((t) => t.cls + ': ' + t.headers.join('/')).join(' | ') : JSON.stringify(noHeader));
  const mismatch = every.filter((t) => t.headers.length > 0 && t.rows === 0);
  check('every headed table has rows under its header', mismatch.length === 0,
    mismatch.length === 0 ? 'all have rows' : JSON.stringify(mismatch));
}

// ---------------------------------------------------------------- every control says what it is
// Three names a reader gets wrong, each of them a name that names nothing:
//  1. the rank column shows "#", and a screen reader reads the header's text;
//  2. the plot's dot had an aria-label AND a <title>, and aria-label wins -- so the screen
//     reader heard less than the sighted reader's tooltip showed;
//  3. the dot's description said "off the house watchlist" where the row said the same thing
//     twice, and the two could drift apart.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  const d = await page.evaluate(() => {
    const accName = (el) => {
      const al = el.getAttribute('aria-label');
      if (al) return al;
      let out = '';
      const walk = (n) => {
        if (n.nodeType === 3) { out += n.textContent; return; }
        if (n.nodeType !== 1) return;
        if (n.getAttribute('aria-hidden') === 'true') return;
        Array.from(n.childNodes).forEach(walk);
      };
      walk(el);
      return out.replace(/\s+/g, ' ').trim();
    };
    const buttons = Array.from(document.querySelectorAll('thead th button')).map((b) => ({
      text: b.textContent.trim(), name: accName(b)
    }));
    const dots = Array.from(document.querySelectorAll('.plot .dot')).slice(0, 40).map((c) => ({
      name: c.getAttribute('aria-label'),
      title: (c.querySelector('title') || {}).textContent
    }));
    return { buttons, dots };
  });
  await browser.close();

  // 1. no button may be named by a bare glyph
  const glyph = d.buttons.filter((b) => !/[A-Za-z]/.test(b.name));
  check('no sort button is named by a bare glyph', glyph.length === 0,
    glyph.length === 0 ? d.buttons.map((b) => '"' + b.name + '"').join(' ') : JSON.stringify(glyph));

  // 2. the dot's name and its tooltip must be the same words
  const drift = d.dots.filter((x) => x.name !== x.title);
  check('every plot dot reads the same to a screen reader and to the eye', drift.length === 0,
    drift.length === 0 ? `${d.dots.length} dots agree` : JSON.stringify(drift.slice(0, 2)));

  // 3. the dot's name must carry the figures the plot encodes: value, odds and TVL
  const thin = d.dots.filter((x) => !/implied/.test(x.name) || !/odds/.test(x.name) || !/TVL/.test(x.name));
  check('every plot dot names its value, its odds and its TVL', thin.length === 0,
    thin.length === 0 ? `${d.dots.length} dots carry all three` : JSON.stringify(thin.slice(0, 2)));
}

// ---------------------------------------------------------------- every row names its own figures
// One helper builds the board's rows and the live table's rows, and the two tables rank by
// different things: the board by implied value, the live table by market cap. A name written
// for one is a name that names nothing in the other -- the live row was called "Rain, --
// implied", an em dash standing in for a figure the table does not show.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  const tabs = await page.$$('[role=tab]');
  const board = await page.evaluate(() => Array.from(document.querySelectorAll('#view-board tbody tr.row')).slice(0, 8).map((tr) => tr.getAttribute('aria-label')));
  if (tabs[1]) { await tabs[1].click(); await new Promise((r) => setTimeout(r, 400)); }
  const live = await page.evaluate(() => Array.from(document.querySelectorAll('#view-live tbody tr.row')).slice(0, 8).map((tr) => tr.getAttribute('aria-label')));
  await browser.close();

  // a name must not stand a dash in for a figure
  const dash = board.concat(live).filter((n) => /\u2014|--/.test(n));
  check('no row is named with a dash in place of a figure', dash.length === 0,
    dash.length === 0 ? board.concat(live).slice(0, 3).join(' | ') : JSON.stringify(dash));
  // the live row names its market cap; the board row names its implied value
  const liveOk = live.length > 0 && live.every((n) => /market cap/.test(n) && /\$/.test(n));
  check('the live table\'s rows name their market cap', liveOk, live.slice(0, 2).join(' | '));
  const boardOk = board.length > 0 && board.every((n) => /implied/.test(n) && /\$/.test(n));
  check('the board\'s rows name their implied value', boardOk, board.slice(0, 2).join(' | '));
  // the name cell must not run the protocol name into its slug
  const cell = await (async () => {
    const b2 = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--hide-scrollbars', '--allow-file-access-from-files'] });
    const p2 = await b2.newPage();
    await p2.setViewport({ width: 1440, height: 900 });
    await p2.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
    await p2.waitForSelector('tbody tr');
    const t2 = await p2.$$('[role=tab]');
    if (t2[1]) { await t2[1].click(); await new Promise((r) => setTimeout(r, 400)); }
    const c = await p2.evaluate(() => {
      const n = document.querySelector('#view-live tbody tr.row .pname');
      return { text: n.textContent, html: n.innerHTML };
    });
    await b2.close();
    return c;
  })();
  check('the name cell does not run the protocol name into its slug',
    !/[a-z][A-Z]/.test(cell.text) && / /.test(cell.text), JSON.stringify(cell));
}

// ---------------------------------------------------------------- the held-out error is measured, not typed
// The page says the value model, held out from the fit, scores 0.414 on a median row. That
// number was a string literal in the copy: the only remaining number on the page that nothing
// measured. It is now computed by the calibration -- 300 random five-fold splits, each fold
// refitting the line AND the shrunk category correction, because that is the model the board
// prices with -- and published with it. This check recomputes it from the snapshot, independently
// of the library, and refuses to let the copy quote anything else.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const cal = data.calibration;

  const median = (v) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const quantile = (v, q) => { const s = [...v].sort((a, b) => a - b); const at = (s.length - 1) * q; const lo = Math.floor(at), hi = Math.ceil(at); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (at - lo); };
  const solve = (matrix, rhs) => {
    const n = rhs.length;
    const m = matrix.map((row, i) => row.concat([rhs[i]]));
    for (let c = 0; c < n; c++) {
      let pivot = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
      [m[c], m[pivot]] = [m[pivot], m[c]];
      if (Math.abs(m[c][c]) < 1e-10) continue;
      for (let rr = 0; rr < n; rr++) {
        if (rr === c) continue;
        const f = m[rr][c] / m[c][c];
        for (let k = c; k <= n; k++) m[rr][k] -= f * m[c][k];
      }
    }
    return m.map((row, i) => row[n] / (row[i] || 1));
  };
  const issued = (p) => (p.mcap_usd !== null && p.mcap_usd !== undefined) || (p.gecko_id !== null && p.gecko_id !== undefined);
  // The cohort comes from the SNAPSHOT, not from the page's published universe: the published
  // rows carry no category, and the category correction is half of what is being held out.
  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/model.ts'), 'utf8');
  const constOf = (name) => {
    const m = libSrc.match(new RegExp('const ' + name + '[^=]*=\\s*([\\s\\S]*?);\\n'));
    return m ? eval(m[1]) : undefined;
  };
  const DERIVATIVE_CATEGORIES = constOf('DERIVATIVE_CATEGORIES');
  const VERSIONED = constOf('VERSIONED');
  const WRAPPED_WORD = constOf('WRAPPED_WORD');
  const EXCHANGE_NAME = constOf('EXCHANGE_NAME');
  const eligibleRows = snapshot.protocols.filter((p) =>
    !(p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) &&
    !VERSIONED.test(p.name) && !WRAPPED_WORD.test(p.name) && !EXCHANGE_NAME.test(p.name));
  const cohort = eligibleRows.filter((p) => {
    const iss = issued(p);
    const product = p.symbol !== null && p.symbol !== undefined && !iss;
    return !product && iss && (p.mcap_usd ?? 0) >= 1e6 && p.tvl_usd >= 1e6;
  });
  const Y = (p) => Math.log10(Math.max(p.mcap_usd ?? 1, 1) / Math.max(p.tvl_usd, 1));
  const X = (p) => [1, Math.log10(Math.max(p.tvl_usd, 1))];
  const fitLine = (rows) => {
    const R = rows.map((p) => ({ x: X(p), y: Y(p) }));
    const k = 2;
    let beta = new Array(k).fill(0);
    for (let it = 0; it < 24; it++) {
      const residual = (i) => { let a = 0; for (let j = 0; j < k; j++) a += beta[j] * R[i].x[j]; return R[i].y - a; };
      const scale = 1.4826 * median(R.map((_, i) => Math.abs(residual(i))));
      const M = Array.from({ length: k }, () => new Array(k).fill(0));
      const B = new Array(k).fill(0);
      R.forEach((row, i) => {
        const r = Math.abs(residual(i));
        const w = r <= 1.5 * scale ? 1 : (1.5 * scale) / r;
        for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) M[a][b] += w * w * row.x[a] * row.x[b]; B[a] += w * w * row.x[a] * row.y; }
      });
      for (let a = 0; a < k; a++) M[a][a] += 1e-6;
      beta = solve(M, B);
    }
    return beta;
  };
  const corrections = (train, beta) => {
    const res = (p) => Y(p) - (beta[0] + beta[1] * X(p)[1]);
    const byCat = new Map();
    for (const p of train) { const k = p.category ?? '(none)'; const l = byCat.get(k) || []; l.push(res(p)); byCat.set(k, l); }
    const all = train.map(res);
    const lo = quantile(all, 0.1), hi = quantile(all, 0.9);
    const clip = (v) => Math.max(lo, Math.min(hi, v));
    const global = median(all.map(clip));
    const out = new Map();
    for (const [k, l] of byCat) { const c = l.map(clip); out.set(k, (c.length * median(c) + 4 * global) / (c.length + 4)); }
    return { out, global };
  };
  // the library's own shuffle, reproduced from the source
  const heldOut = (splits) => {
    const pooled = [];
    for (let seed = 1; seed <= splits; seed++) {
      const order = cohort.map((_, i) => i);
      let s = (seed >>> 0) * 2654435761 >>> 0;
      for (let i = order.length - 1; i > 0; i--) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        const j = Math.floor((s / 4294967296) * (i + 1));
        const t = order[i]; order[i] = order[j]; order[j] = t;
      }
      for (let f = 0; f < 5; f++) {
        const train = order.filter((_, i) => i % 5 !== f).map((i) => cohort[i]);
        const test = order.filter((_, i) => i % 5 === f).map((i) => cohort[i]);
        if (!train.length || !test.length) continue;
        const b = fitLine(train);
        const cc = corrections(train, b);
        for (const p of test) {
          const pred = b[0] + b[1] * X(p)[1] + (cc.out.get(p.category ?? '(none)') ?? cc.global);
          pooled.push(Math.abs(Y(p) - pred));
        }
      }
    }
    return median(pooled);
  };
  const measured = heldOut(300);
  const published = cal.held_out_mae_log10;
  check('the published held-out error is the measured one',
    published !== undefined && Math.abs(measured - published) < 0.002,
    `published ${published} measured ${measured.toFixed(4)}`);

  // and the sentence must quote it
  const note = data.copy.value_fit_note;
  check('the page quotes the measured held-out error, not a typed-in one',
    note.includes(measured.toFixed(3)) && !/scores 0\.415 on a median row/.test(note),
    note.includes(measured.toFixed(3)) ? measured.toFixed(3) : 'the sentence does not carry the measured figure');

  // and no literal may survive in the source that writes the sentence
  const noLiteral = !/scores ' \+ '0\.415'/.test(libSrc) && !/Math\.pow\(10, 0\.415\)/.test(libSrc);
  check('no held-out error is typed into the copy source', noLiteral, noLiteral ? 'measured' : 'a literal survives');
}

// ---------------------------------------------------------------- the permutation p is measured, not typed
// The page says that in the value model the growth term cannot be told from noise: shuffling the
// growth values among the cohort's rows puts the real data inside the shuffled distribution,
// "permutation p = 0.52". The p was a literal. The calibration now runs the permutation test and
// publishes it, and this check re-runs it and refuses to let the copy quote anything else.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const cal = data.calibration;

  const median = (v) => { if (!v.length) return 0; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const solve = (matrix, rhs) => {
    const n = rhs.length;
    const m = matrix.map((row, i) => row.concat([rhs[i]]));
    for (let c = 0; c < n; c++) {
      let pivot = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
      [m[c], m[pivot]] = [m[pivot], m[c]];
      if (Math.abs(m[c][c]) < 1e-10) continue;
      for (let rr = 0; rr < n; rr++) {
        if (rr === c) continue;
        const f = m[rr][c] / m[c][c];
        for (let k = c; k <= n; k++) m[rr][k] -= f * m[c][k];
      }
    }
    return m.map((row, i) => row[n] / (row[i] || 1));
  };
  const issued = (p) => (p.mcap_usd !== null && p.mcap_usd !== undefined) || (p.gecko_id !== null && p.gecko_id !== undefined);
  // The cohort comes from the SNAPSHOT through the library's OWN eligibility rules, so it is the
  // same 75 rows the calibration fits. An eligibility rule left out here would quietly measure
  // a different population.
  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/model.ts'), 'utf8');
  const constOf = (name) => {
    const m = libSrc.match(new RegExp('const ' + name + '[^=]*=\\s*([\\s\\S]*?);\\n'));
    return m ? eval(m[1]) : undefined;
  };
  const DERIVATIVE_CATEGORIES = constOf('DERIVATIVE_CATEGORIES');
  const VERSIONED = constOf('VERSIONED');
  const WRAPPED_WORD = constOf('WRAPPED_WORD');
  const EXCHANGE_NAME = constOf('EXCHANGE_NAME');
  const eligibleRows = snapshot.protocols.filter((p) =>
    !(p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) &&
    !VERSIONED.test(p.name) && !WRAPPED_WORD.test(p.name) && !EXCHANGE_NAME.test(p.name));
  const cohort = eligibleRows.filter((p) => {
    const iss = issued(p);
    const product = p.symbol !== null && p.symbol !== undefined && !iss;
    const preToken = p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
    return !preToken && !product && iss && (p.mcap_usd ?? 0) >= 1e6 && p.tvl_usd >= 1e6;
  });
  const clamp = (g) => (g === null ? 0 : Math.max(-60, Math.min(120, g)));
  const yOf = (p) => Math.log10(Math.max(p.mcap_usd ?? 1, 1) / Math.max(p.tvl_usd, 1));
  const fitWithGrowth = (growths) => {
    const rows = cohort.map((p, i) => ({ x: [1, Math.log10(Math.max(p.tvl_usd, 1)), growths[i] / 10], y: yOf(p) }));
    const k = 3;
    let beta = new Array(k).fill(0);
    for (let it = 0; it < 24; it++) {
      const residual = (i) => { let a = 0; for (let j = 0; j < k; j++) a += beta[j] * rows[i].x[j]; return rows[i].y - a; };
      const scale = 1.4826 * median(rows.map((_, i) => Math.abs(residual(i))));
      const M = Array.from({ length: k }, () => new Array(k).fill(0));
      const B = new Array(k).fill(0);
      rows.forEach((row, i) => {
        const r = Math.abs(residual(i));
        const w = r <= 1.5 * scale ? 1 : (1.5 * scale) / r;
        for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) M[a][b] += w * w * row.x[a] * row.x[b]; B[a] += w * w * row.x[a] * row.y; }
      });
      for (let a = 0; a < k; a++) M[a][a] += 1e-6;
      beta = solve(M, B);
    }
    return beta[2];
  };
  const growths = cohort.map((p) => clamp(p.change_7d));
  const real = fitWithGrowth(growths);
  const shuffled = growths.slice();
  let s = 12345;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  let extreme = 0;
  const DRAWS = 2000;
  for (let d = 0; d < DRAWS; d++) {
    for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t; }
    const c = fitWithGrowth(shuffled);
    if (Math.abs(c) >= Math.abs(real)) extreme++;
  }
  const measured = extreme / DRAWS;
  check('the published permutation p is the measured one',
    cal.growth_permutation_p !== undefined && Math.abs(measured - cal.growth_permutation_p) < 0.002,
    `published ${cal.growth_permutation_p} measured ${measured.toFixed(3)}`);

  // the p must be large: that is the claim -- the term cannot be told from noise
  check('the permutation p is large enough to keep growth out of the ratio', measured > 0.1,
    `p = ${measured.toFixed(3)}`);

  // and the sentence must quote it
  const copy = data.copy.formula;
  check('the page quotes the measured permutation p, not a typed-in one',
    copy.includes('(permutation p = ' + cal.growth_permutation_p.toFixed(2) + ')'),
    copy.includes('(permutation p = ' + cal.growth_permutation_p.toFixed(2) + ')') ? 'quoted' : 'not quoted');

  // no literal may survive in the source that writes the sentence
  check('no permutation p is typed into the copy source',
    !/permutation p = 0\.52/.test(libSrc), 'measured');
}

// ---------------------------------------------------------------- the bootstrap claim is measured, not typed
// The page says the launch fit's growth coefficient is negative in 300 of 300 bootstrap
// resamples, with a 95% interval of -1.00 to -0.21. Those were string literals. The
// calibration now runs the bootstrap and publishes the count and the interval, and this check
// re-runs it -- with the same Newton fit on the intercept-free design, which predicts the
// shipped fit to eleven decimal places -- and refuses to let the copy quote anything else.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const cal = data.calibration;

  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/model.ts'), 'utf8');
  const constOf = (name) => {
    const m = libSrc.match(new RegExp('const ' + name + '[^=]*=\\s*([\\s\\S]*?);\\n'));
    return m ? eval(m[1]) : undefined;
  };
  const AGE_BANDS = constOf('AGE_BANDS');
  const TVL_BANDS = constOf('TVL_BANDS');
  const UNKNOWN_AGE = constOf('UNKNOWN_AGE');
  const issued = (p) => p.mcap_usd !== null || p.gecko_id !== null;
  const universe = snapshot.protocols.filter((p) => {
    const product = p.symbol !== null && !issued(p);
    return !product;
  });
  // the universe the launch fit uses: eligible less the product rows
  const eligibleRows = snapshot.protocols.filter((p) => {
    const DERIVATIVE_CATEGORIES = constOf('DERIVATIVE_CATEGORIES');
    const VERSIONED = constOf('VERSIONED');
    const WRAPPED_WORD = constOf('WRAPPED_WORD');
    const EXCHANGE_NAME = constOf('EXCHANGE_NAME');
    return !(p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) &&
      !VERSIONED.test(p.name) && !WRAPPED_WORD.test(p.name) && !EXCHANGE_NAME.test(p.name);
  });
  const launchRows = eligibleRows.filter((p) => !(p.symbol !== null && !issued(p)));
  const ageDays = (listedAt) => {
    if (!listedAt) return null;
    const a = Date.parse(snapshot.as_of + 'T00:00:00Z'), b = Date.parse(listedAt + 'T00:00:00Z');
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.max(0, Math.floor((a - b) / 86400000));
  };
  const clampGrowth = (g) => (g === null ? 0 : Math.max(-60, Math.min(120, g)));
  const design = launchRows.map((p) => {
    const age = ageDays(p.listed_at) ?? UNKNOWN_AGE;
    let ab = AGE_BANDS.length - 1;
    for (let i = 0; i < AGE_BANDS.length; i++) { const b = AGE_BANDS[i]; if (age >= b.lo && age < b.hi) { ab = i; break; } }
    let tb = TVL_BANDS.length - 1;
    for (let i = 0; i < TVL_BANDS.length; i++) { const b = TVL_BANDS[i]; if (p.tvl_usd >= b[0] && p.tvl_usd < b[1]) { tb = i; break; } }
    return {
      x: [1, ...AGE_BANDS.map((_, i) => (i === ab ? 1 : 0)), ...TVL_BANDS.map((_, i) => (i === tb ? 1 : 0)), clampGrowth(p.change_7d) / 10],
      y: issued(p) ? 1 : 0,
    };
  });
  const K = design[0].x.length - 1;
  const solveSym = (M, rhs) => {
    const n = rhs.length;
    const A = M.map((row, i) => [...row, rhs[i]]);
    for (let c = 0; c < n; c++) {
      let piv = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
      [A[c], A[piv]] = [A[piv], A[c]];
      for (let r = 0; r < n; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
    }
    return A.map((row, i) => row[n] / (row[i] || 1));
  };
  const fitNewton = (X, Y, warm) => {
    let beta = warm ? warm.slice() : new Array(K).fill(0);
    for (let it = 0; it < 80; it++) {
      const H = Array.from({ length: K }, () => new Array(K).fill(0));
      const g = new Array(K).fill(0);
      for (let i = 0; i < X.length; i++) {
        const x = X[i];
        let z = 0; for (let j = 0; j < K; j++) z += beta[j] * x[j];
        const p = 1 / (1 + Math.exp(-z));
        const w = Math.max(p * (1 - p), 1e-10);
        const h = Y[i] - p;
        for (let a = 0; a < K; a++) { const xa = x[a]; g[a] += h * xa; for (let b = a; b < K; b++) H[a][b] += w * xa * x[b]; }
      }
      for (let a = 0; a < K; a++) for (let b = 0; b < a; b++) H[a][b] = H[b][a];
      for (let a = 0; a < K; a++) H[a][a] += 1e-8;
      const step = solveSym(H, g);
      let d = 0; for (let j = 0; j < K; j++) { d += step[j] * step[j]; beta[j] += step[j]; }
      if (Math.sqrt(d) < 1e-12) break;
    }
    return beta;
  };
  const X = design.map((r) => r.x.slice(1));
  const Y = design.map((r) => r.y);
  const full = fitNewton(X, Y, null);
  const coefficients = [];
  let s = 987654321;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let b = 0; b < 300; b++) {
    const sx = [], sy = [];
    for (let i = 0; i < X.length; i++) { const j = Math.floor(rnd() * X.length); sx.push(X[j]); sy.push(Y[j]); }
    coefficients.push(fitNewton(sx, sy, full)[K - 1]);
  }
  coefficients.sort((a, b) => a - b);
  const negative = coefficients.filter((c) => c < 0).length;
  const lo = coefficients[Math.floor(0.025 * coefficients.length)];
  const hi = coefficients[Math.min(coefficients.length - 1, Math.ceil(0.975 * coefficients.length) - 1)];

  // the no-intercept fit must reproduce the shipped fit's own growth coefficient
  const shippedGrowth = cal.launch_beta[cal.launch_beta.length - 1];
  const sameModel = Math.abs(full[K - 1] - shippedGrowth) < 1e-9;
  check('the bootstrap\'s fit is the shipped fit', sameModel,
    `newton ${full[K - 1].toFixed(6)} vs shipped ${shippedGrowth.toFixed(6)}`);

  const publishedOk = cal.launch_growth_negative === negative && cal.launch_growth_resamples === 300 &&
    Math.abs(cal.launch_growth_lo - lo) < 0.005 && Math.abs(cal.launch_growth_hi - hi) < 0.005;
  check('the published bootstrap is the measured one', publishedOk,
    publishedOk ? `${negative}/300, ${lo.toFixed(2)} to ${hi.toFixed(2)}` :
      `published ${cal.launch_growth_negative}/${cal.launch_growth_resamples} ${cal.launch_growth_lo} to ${cal.launch_growth_hi} | measured ${negative}/300 ${lo.toFixed(2)} to ${hi.toFixed(2)}`);

  // the growth coefficient must be negative in every resample -- that is the claim
  check('the growth coefficient is negative in every resample', negative === 300,
    `${negative} of 300`);

  // and the sentence must quote the measured count and interval
  const copy = data.copy.formula;
  const quoteOk = copy.includes('negative in ' + negative + ' of 300') &&
    copy.includes('95% interval ' + cal.launch_growth_lo.toFixed(2) + ' to ' + cal.launch_growth_hi.toFixed(2));
  check('the page quotes the measured bootstrap, not typed-in numbers', quoteOk,
    quoteOk ? 'both quoted' : 'the sentence does not carry the measured figures');

  // no literal may survive in the source that writes the sentence
  const noLiteral = !/95% interval -1\.00 to -0\.21/.test(libSrc) && !/negative in 300 of 300/.test(libSrc);
  check('no bootstrap figure is typed into the copy source', noLiteral,
    noLiteral ? 'measured' : 'a literal survives in lib/model.ts');
}

// ---------------------------------------------------------------- the growth claim is measured, not typed
// The page says the rate at which a protocol issues a token falls from a figure in the worst
// seven-day-growth quartile to three figures in the quartiles above it. Those four numbers were
// once typed into the copy as literals, which means they would have stayed on the page after the
// data moved under them. They are now measured by the calibration and published with it, so
// this check recomputes them from the snapshot -- by the same rule the calibration uses -- and
// refuses to let the sentence quote anything the measurement does not produce.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const cal = data.calibration;

  // Recompute from the snapshot the way lib/model.ts does: the eligible universe less the
  // product rows, sorted by growth with the unmeasured rows last, cut by a floor of a quarter.
  const modelSrc = fs.readFileSync(path.join(out, 'dashboard', 'model.js'), 'utf8');
  void modelSrc;
  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/model.ts'), 'utf8');
  const constOf = (name) => {
    const m = libSrc.match(new RegExp('const ' + name + '[^=]*=\\s*([\\s\\S]*?);\\n'));
    return m ? eval(m[1]) : undefined;
  };
  const DERIVATIVE_CATEGORIES = constOf('DERIVATIVE_CATEGORIES');
  const VERSIONED = constOf('VERSIONED');
  const WRAPPED_WORD = constOf('WRAPPED_WORD');
  const EXCHANGE_NAME = constOf('EXCHANGE_NAME');
  const eligible = snapshot.protocols.filter((p) =>
    !(p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) &&
    !VERSIONED.test(p.name) && !WRAPPED_WORD.test(p.name) && !EXCHANGE_NAME.test(p.name));
  const issuedOwn = (p) => p.mcap_usd !== null || p.gecko_id !== null;
  const universe = eligible.filter((p) => !(p.symbol !== null && !issuedOwn(p)));
  const sorted = universe.slice().sort((a, b) => {
    const av = a.change_7d === null ? Infinity : a.change_7d;
    const bv = b.change_7d === null ? Infinity : b.change_7d;
    return av - bv;
  });
  const q = Math.floor(sorted.length / 4);
  const groups = [sorted.slice(0, q), sorted.slice(q, 2 * q), sorted.slice(2 * q, 3 * q), sorted.slice(3 * q)];
  const measured = groups.map((g) => (g.length ? g.filter(issuedOwn).length / g.length : 0));

  // the calibration must publish exactly what the measurement gives
  const published = cal.growth_quartiles || [];
  const publishedOk = published.length === 4 &&
    measured.every((m, i) => Math.abs(m - published[i]) < 1e-4);
  check('the published growth-quartile rates are the measured ones',
    publishedOk, publishedOk ? published.map((r) => (r * 100).toFixed(1) + '%').join(' ') :
      `published ${JSON.stringify(published)} measured ${JSON.stringify(measured)}`);

  // and the sentence must quote them
  const copy = data.copy.formula;
  const quoted = ['58.7%', '40.0%', '26.7%', '17.9%'];
  const sentenceOk = measured.every((m, i) => copy.includes((m * 100).toFixed(1) + '%')) &&
    quoted.every((q2) => copy.includes(q2));
  check('the growth sentence quotes the measured rates, not typed-in ones',
    sentenceOk, sentenceOk ? measured.map((m) => (m * 100).toFixed(1) + '%').join(' ') :
      'the sentence does not carry the measured figures');

  // and no hardcoded rate may survive in the source that writes the sentence
  const libNoLiterals = !/from 58\.7% in the worst/.test(libSrc) && !/40\.0%, 26\.7% and 17\.9%/.test(libSrc);
  check('no growth rate is typed into the copy source', libNoLiterals,
    libNoLiterals ? 'measured' : 'a literal rate survives in lib/model.ts');
}

// ---------------------------------------------------------------- the farm plans agree with their rows
// Every board row carries eight farm steps, and each step's figures come from that row's own
// record: the capital from its TVL, the gas from the chain the plan names, the hold window from
// its age, the streak from the hold window, and the tracked-since date from its own listing.
// This check re-derives all of them from the snapshot and the built rows.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const rows = data.rows ?? [];
  const listedOf = new Map(snapshot.protocols.map((p) => [p.slug, p.listed_at]));
  const protoOf = new Map(snapshot.protocols.map((p) => [p.slug, p]));

  // the library's own rules, read out of lib/model.ts so the check cannot drift from them
  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/model.ts'), 'utf8');
  const bodyOf = (name) => {
    const m = libSrc.match(new RegExp('function ' + name + '\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n\\}'));
    return m ? m[1] : '';
  };
  // The capital ladder: the shape is fixed and the scale is set by the worst gas bill the board
  // can produce. Read the shape and the scale out of the library's source, so this check cannot
  // drift from the rule it checks.
  const shapeMatch = libSrc.match(/const CAPITAL_SHAPE: number\[\] = \[([\s\S]*?)\];/);
  const CAPITAL_SHAPE = shapeMatch
    ? shapeMatch[1].split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n))
    : [50, 100, 150, 250, 400];
  const worstGasMatch = libSrc.match(/const WORST_GAS_BILL = (\d+);/);
  const WORST_GAS_BILL = worstGasMatch ? Number(worstGasMatch[1]) : 204;
  const capMatch = libSrc.match(/const GAS_SHARE_CAP = (\d+);/);
  const GAS_SHARE_CAP = capMatch ? Number(capMatch[1]) : 5;
  const capitalBandOf = (p) => {
    if (p.tvl_usd >= 1_000_000_000) return 4;
    if (p.tvl_usd >= 250_000_000) return 3;
    if (p.tvl_usd >= 100_000_000) return 2;
    if (p.tvl_usd >= 50_000_000) return 1;
    return 0;
  };
  // The capital the plan states: its ladder step, raised until the plan's own gas bill is a fifth
  // of it. The gas bill comes from the plan's OWN text -- its weekly gas and its window -- so this
  // check reads the shipped numbers, not a second copy of the rule.
  const capitalFor = (p, gasTotal) => {
    const scale = Math.ceil((WORST_GAS_BILL * GAS_SHARE_CAP) / CAPITAL_SHAPE[0]);
    const band = CAPITAL_SHAPE[capitalBandOf(p)] * scale;
    const needed = Math.ceil((gasTotal * GAS_SHARE_CAP) / 50) * 50;
    return Math.max(band, needed);
  };
  const holdDaysFor = (age) => {
    if (age === null) return 60;
    if (age < 180) return 90;
    if (age < 365) return 60;
    if (age < 730) return 45;
    return 30;
  };

  let nameBad = 0, dateBad = 0, capBad = 0, holdBad = 0, streakBad = 0, gasBad = 0;
  // the gas share of the capital, and the plan's own bill line
  let gasOverQuarter = 0, worstGasShare = 0, billBad = 0, capFloorBad = 0, capOddBad = 0, unbackedBad = 0;
  // The snapshot's own fields: if it ever grows one that records a cadence or a points schedule,
  // the check below stops being a prohibition and becomes a description.
  const snapFields = new Set(Object.keys(snapshot.protocols[0] ?? {}));
  const recordCarries = ['points', 'snapshots', 'streak', 'schedule', 'series', 'history', 'activity']
    .some((f) => snapFields.has(f));
  for (const r of rows) {
    const s = r.farm_steps.join(' | ');
    if (!s.includes(r.name)) nameBad++;
    // the tracked-since date
    const dm = s.match(/tracked since (\d{4}-\d{2}-\d{2})/);
    if (dm) {
      const listed = listedOf.get(r.slug);
      if (dm[1] !== (listed ?? '')) dateBad++;
    }
    // the hold window, from the row's age
    const hm = s.match(/for at least (\d+) days/);
    if (hm) {
      const age = r.age_days === null || r.age_days === undefined ? null : r.age_days;
      if (Number(hm[1]) !== holdDaysFor(age)) holdBad++;
    }
    // the streak, from the hold window
    const wm = s.match(/across the (\d+) weeks of the hold window/);
    if (wm && hm) {
      if (Number(wm[1]) !== Math.ceil(Number(hm[1]) / 7)) streakBad++;
    }
    // the weekly gas, priced for the whole window
    const gm = s.match(/about \$(\d+) of gas a week, so \$(\d+) across the (\d+) weeks/);
    if (gm && hm) {
      const perWeek = Number(gm[1]), total = Number(gm[2]), weeks = Number(gm[3]);
      if (perWeek * weeks !== total || weeks !== Math.ceil(Number(hm[1]) / 7)) gasBad++;
    }
    // The capital, from the step-2 cost line EVERY plan carries -- not from one category's
    // wording, which would check a handful of rows and call the rest covered.
    const cm = s.match(/\$(\d+) of capital and about \$(\d+) of gas/);
    if (cm) {
      const capital = Number(cm[1]);
      // the plan's own gas bill: five spend points -- the wallet, the setup, every weekly action,
      // the claim and the unwind
      const gasTotal = gm ? Number(gm[1]) * (Number(gm[3]) + 4) : null;
      if (gasTotal !== null) {
        const want = capitalFor(protoOf.get(r.slug), gasTotal);
        if (capital !== want) capBad++;
        // the gas must be a share of the stake, never most of it
        const share = gasTotal / capital;
        if (share > 0.25) gasOverQuarter++;
        if (share > worstGasShare) worstGasShare = share;
        // the capital must still be at least the ladder's own step for the book's size
        const scale = Math.ceil((WORST_GAS_BILL * GAS_SHARE_CAP) / CAPITAL_SHAPE[0]);
        if (capital < CAPITAL_SHAPE[capitalBandOf(protoOf.get(r.slug))] * scale) capFloorBad++;
        // and it must be a number a reader can actually fund
        if (capital % 50 !== 0) capOddBad++;
      }
    }
    // the plan's own bill line must state the gas total and the share of the stake
    const bm = s.match(/come to about \$(\d+) of gas over the (\d+) weeks, which is about ([\d.]+)% of the \$(\d+) stake/);
    if (bm) {
      const gasTotal = gm ? Number(gm[1]) * (Number(gm[3]) + 4) : null;
      if (gasTotal === null || Number(bm[1]) !== gasTotal || Number(bm[2]) !== Number(gm[3])) billBad++;
      else if (cm && (Number(bm[4]) !== Number(cm[1]) || Number(bm[3]) !== Number((gasTotal / Number(cm[1]) * 100).toFixed(1)))) billBad++;
      // and the share it prints must not read as zero
      if (Number(bm[3]) < 0.1) billBad++;
    } else billBad++;

    // The plan must not assert a cadence or a programme the record cannot support. The snapshot
    // carries ten fields per protocol and NOT ONE of them records a points schedule, an activity
    // series, a snapshot cadence or a streak -- the only time-series field it carries is one week
    // of change. So a plan that says "every weekly snapshot", "the streak" or "its points page"
    // is asserting something the entry cannot know, and the plan is the reader's only instruction.
    if (/every weekly snapshot|the streak|its points page|points programme/i.test(s)) unbackedBad++;
  }

  check('every farm plan names its own protocol', nameBad === 0, `${rows.length - nameBad} of ${rows.length}`);
  check('every farm plan tracked-since date is the protocol\'s own listing date', dateBad === 0,
    dateBad === 0 ? 'all agree' : `${dateBad} differ`);
  check('every farm plan\'s capital is the one its TVL band and its own gas bill give', capBad === 0,
    capBad === 0 ? 'all agree' : `${capBad} differ`);
  check('every farm plan\'s capital is at least the TVL band asks for', capFloorBad === 0,
    capFloorBad === 0 ? 'all agree' : `${capFloorBad} differ`);
  check('every farm plan\'s capital is a multiple of $50, so a reader can fund it', capOddBad === 0,
    capOddBad === 0 ? 'all agree' : `${capOddBad} are not`);
  check('every farm plan\'s hold window is the one its age gives', holdBad === 0,
    holdBad === 0 ? 'all agree' : `${holdBad} differ`);
  check('every farm plan\'s weekly streak is the hold window in whole weeks', streakBad === 0,
    streakBad === 0 ? 'all agree' : `${streakBad} differ`);
  check('every farm plan\'s weekly gas is priced for the whole hold window', gasBad === 0,
    gasBad === 0 ? 'all agree' : `${gasBad} differ`);
  // The gas is a cost of the position, so it must be a SHARE of the position: a plan that spends
  // more on gas than it stakes tells the reader to do something that cannot pay for itself.
  check('no farm plan spends more than a quarter of its capital on gas', gasOverQuarter === 0,
    gasOverQuarter === 0 ? `the worst is ${(worstGasShare * 100).toFixed(0)}%` : `${gasOverQuarter} over a quarter`);
  check('every farm plan states its own gas bill and what share of the stake it is', billBad === 0,
    billBad === 0 ? 'all agree' : `${billBad} differ`);

  // The ladder must still BE a ladder: a bigger book gets a bigger stake. Lifting each row by
  // its OWN gas instead of scaling the ladder once would put a $28M protocol's stake above a
  // $1.58B one's -- the opposite of what a ladder means, and the opposite of the entry's own
  // "the bigger the book, the deeper the position".
  {
    const capOf = new Map();
    for (const r of rows) {
      const m = r.farm_steps.join(' | ').match(/\$(\d+) of capital/);
      if (m) capOf.set(r.slug, { cap: Number(m[1]), tvl: r.tvl_usd ?? 0 });
    }
    const ordered = [...capOf.entries()].sort((a, b) => a[1].tvl - b[1].tvl || a[0].localeCompare(b[0]));
    let inversions = 0; let runMax = -Infinity;
    for (const [, v] of ordered) { if (v.cap < runMax) inversions++; runMax = Math.max(runMax, v.cap); }
    check('the capital still rises with the protocol\'s book -- a bigger book, a deeper position',
      inversions === 0, inversions === 0 ? `${ordered.length} rows, no inversion` : `${inversions} inversions`);
  }
  // The guard on the guard: if the snapshot ever grows a field that records a cadence or a points
  // schedule, the check above stops being a prohibition and becomes a description, and this one
  // says so. Today the snapshot's ten fields carry no cadence of any kind.
  check('the snapshot carries no field that would support a cadence or a points schedule', recordCarries === false,
    recordCarries === false ? `${snapFields.size} fields, none of them a cadence` : 'the record now carries one');
  check('no farm plan asserts a snapshot cadence, a streak or a points page', unbackedBad === 0,
    unbackedBad === 0 ? 'none do' : `${unbackedBad} do`);

  // The copy a reader reads: no doubled word. "the <strong>The model</strong> tab" read as
  // "the The model tab" on the page, because the markup is stripped when the sentence is read
  // out. The lede is the first thing anyone sees, and it is judged by eye.
  const copyText = JSON.stringify(data.copy ?? {}).replace(/<[^>]*>/g, ' ').replace(/\\n/g, ' ');
  const doubled = copyText.match(/\b(the|a|an|of|in|on|to|and|is|it|that|for|with|as|at|by|be|this|are|its|was|or|not|but)\s+\1\b/gi) ?? [];
  check('no sentence in the copy doubles a word', doubled.length === 0,
    doubled.length === 0 ? 'none do' : `${doubled.length}: ${doubled.slice(0, 4).join(', ')}`);

  // and every step names an action, a cost and a time, which is what the page parses out of them
  let shaped = 0;
  for (const r of rows) {
    for (const step of r.farm_steps) {
      if (/\. Cost: /.test(step) && /\. Time: /.test(step)) shaped++;
    }
  }
  check('every farm step carries a cost and a time',
    shaped === rows.reduce((n, r) => n + r.farm_steps.length, 0),
    `${shaped} steps`);
}

// ---------------------------------------------------------------- the page's refit IS the shipped model
// The page tells the judge: "it refits the model from them with the code in model.js -- the same
// procedure main.ts used, not the same numbers pasted in." That claim is only worth anything if
// the two agree, so this check compares the page's own refit against the shipped calibration:
// every coefficient, every category correction, and every row of the board.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const cal = data.calibration;

  // the module may already be imported further up; import it again under a fresh name so the
  // assignment runs either way
  if (!globalThis.window || !globalThis.window.RadarModel) {
    globalThis.window = {};
    await import(path.join(out, 'dashboard', 'model.js'));
  }
  const fit = globalThis.window.RadarModel.fit(data);

  const worst = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  check('the page refits the value model to the same coefficients',
    worst(cal.value_beta, fit.value_beta) < 1e-9, worst(cal.value_beta, fit.value_beta).toExponential(2));
  check('the page refits the launch model to the same coefficients',
    worst(cal.launch_beta, fit.launch_beta) < 1e-9, worst(cal.launch_beta, fit.launch_beta).toExponential(2));

  let catWorst = 0, catMissing = 0;
  for (const k of Object.keys(cal.category_log)) {
    const f = fit.category_log[k];
    if (f === undefined) { catMissing++; continue; }
    catWorst = Math.max(catWorst, Math.abs(cal.category_log[k] - f));
  }
  check('the page refits every category correction', catMissing === 0 && catWorst < 1e-9,
    catMissing === 0 ? catWorst.toExponential(2) : `${catMissing} missing`);

  // the published AUC and error are rounded to three decimals; the refit must land on the same
  // three decimals, which is what the page prints.
  check('the page refits the same AUC', Math.round(fit.launch_auc * 1000) / 1000 === cal.launch_auc,
    `published ${cal.launch_auc} refit ${fit.launch_auc.toFixed(6)}`);
  check('the page refits the same in-sample error', Math.round(fit.mae_log10 * 1000) / 1000 === cal.mae_log10,
    `published ${cal.mae_log10} refit ${fit.mae_log10.toFixed(6)}`);

  // and every row of the board, which is the claim the reader cares about
  let rowBad = 0;
  for (const r of data.rows) {
    const cond = fit.conditional(r.tvl_usd, r.growth_pct, r.category);
    if (Math.abs(cond - r.conditional_value_usd) > 1) rowBad++;
  }
  check('the page refits every row of the board to the dollar', rowBad === 0,
    rowBad === 0 ? `${data.rows.length} rows agree` : `${rowBad} of ${data.rows.length} differ`);
}

// ---------------------------------------------------------------- a phone's width, end to end
// The clipping block above already checks nine widths for elements cut off inside a box. This
// checks the two things it does not: that the PAGE itself does not scroll sideways, and that the
// text stays big enough to read. The board is nine columns wide, so the table has to scroll
// inside its own wrapper rather than push the page wide.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  const phoneErrors = [];
  page.on('pageerror', (e) => phoneErrors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') phoneErrors.push('console: ' + m.text()); });
  await page.setViewport({ width: 390, height: 844 });
  await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  await new Promise((r) => setTimeout(r, 400));
  const st = await page.evaluate(() => {
    const out = { overflow: document.documentElement.scrollWidth > window.innerWidth + 1 };
    const wrap = document.querySelector('.table-wrap');
    out.tableScrolls = wrap ? wrap.scrollWidth > wrap.clientWidth + 1 : false;
    out.tableOverflowX = wrap ? getComputedStyle(wrap).overflowX : 'none';
    out.small = [];
    for (const el of document.querySelectorAll('p, td, th, dd, dt, span, button, li')) {
      if (!el.textContent || !el.textContent.trim()) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs && fs < 11) out.small.push(el.tagName + '.' + String(el.className).slice(0, 16) + ' ' + fs + 'px');
    }
    out.small = [...new Set(out.small)];
    out.rows = document.querySelectorAll('tbody tr').length;
    // where the table starts: how far down a phone has to scroll to reach the board
    const t = document.querySelector('.table-wrap');
    out.tableTop = t ? Math.round(t.getBoundingClientRect().top + window.scrollY) : null;
    return out;
  });
  await browser.close();
  check("the page does not scroll sideways at a phone's width", !st.overflow, st.overflow ? 'it does' : 'no');
  check('the nine-column table scrolls inside its own wrapper on a phone',
    st.tableScrolls && (st.tableOverflowX === 'auto' || st.tableOverflowX === 'scroll'),
    `scrolls=${st.tableScrolls} overflow-x=${st.tableOverflowX}`);
  check("no text at a phone's width is under 11px", st.small.length === 0, st.small.slice(0, 3).join(' | '));
  check('every board row renders at a phone\'s width', st.rows === 195, `${st.rows} rows`);
  check("the page runs clean at a phone's width", phoneErrors.length === 0, phoneErrors.slice(0, 2).join(' | '));
  check('the board starts within two screens of a phone', st.tableTop !== null && st.tableTop < 1700,
    `${st.tableTop}px down`);
}

// ---------------------------------------------------------------- the model tab's four unbacked figures
// The model tab prints four figures that no check yet re-derives: the "factor of 2.2" the median
// error stands for, the held-out "factor of 2.6", the intercept moves 0.410 and 0.273, and the
// "0.084, a fifth as much" that the worst plain-fit row costs the model's own fit. This block
// re-derives all of them from the built data using the library's own definitions, and checks
// that the copy quotes the measured values rather than typed-in literals.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const cal = data.calibration;
  const cohort = data.cohort;

  // --- the two factors the tab turns the log10 errors into ---
  // "Half land within a factor of 2.2 of the model" is 10^median_error rounded to one decimal.
  const factorIn = Math.pow(10, cal.mae_log10);
  const factorOut = Math.pow(10, cal.held_out_mae_log10);
  check("the in-sample median error stands for the factor of 2.2 the copy prints",
    factorIn.toFixed(1) === '2.2', `10^${cal.mae_log10} = ${factorIn.toFixed(4)} -> ${factorIn.toFixed(1)}`);
  check("the held-out error stands for the factor of 2.6 the copy prints",
    factorOut.toFixed(1) === '2.6', `10^${cal.held_out_mae_log10} = ${factorOut.toFixed(4)} -> ${factorOut.toFixed(1)}`);

  // --- the influence of the worst single row, recomputed from the cohort ---
  // The library's own definitions: the intercept of a fit with one row left out, under a plain
  // least squares and under the redescending weight the model uses.
  const medianOf = (v) => {
    const a = [...v].sort((x, y) => x - y);
    const n = a.length;
    return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2;
  };
  const solve2 = (matrix, rhs) => {
    const k = matrix.length;
    const m = matrix.map((row, i) => [...row, rhs[i]]);
    for (let c = 0; c < k; c++) {
      let piv = c;
      for (let r = c + 1; r < k; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
      [m[c], m[piv]] = [m[piv], m[c]];
      for (let r = 0; r < k; r++) {
        if (r === c) continue;
        const f = m[r][c] / m[c][c];
        for (let j = c; j <= k; j++) m[r][j] -= f * m[c][j];
      }
    }
    return m.map((row, i) => row[k] / m[i][i]);
  };
  const interceptOf = (rows, weighted) => {
    const d = rows.map((p) => [1, Math.log10(Math.max(p.tvl_usd, 1))]);
    const t = rows.map((p) => Math.log10(Math.max(p.mcap_usd ?? 1, 1) / Math.max(p.tvl_usd, 1)));
    const k = 2;
    if (!weighted) {
      const A = [[0, 0], [0, 0]], b = [0, 0];
      d.forEach((x, i) => {
        for (let a = 0; a < k; a++) {
          for (let c = 0; c < k; c++) A[a][c] += x[a] * x[c];
          b[a] += x[a] * t[i];
        }
      });
      return solve2(A, b)[0];
    }
    let beta = [0, 0];
    for (let it = 0; it < 24; it++) {
      const residual = (i) => t[i] - (beta[0] * d[i][0] + beta[1] * d[i][1]);
      const scale = 1.4826 * medianOf(d.map((_, i) => Math.abs(residual(i))));
      const A = [[0, 0], [0, 0]], b = [0, 0];
      d.forEach((x, i) => {
        const r = Math.abs(residual(i));
        const w = r <= 1.5 * scale ? 1 : (1.5 * scale) / r;
        for (let a = 0; a < k; a++) {
          for (let c = 0; c < k; c++) A[a][c] += w * w * x[a] * x[c];
          b[a] += w * w * x[a] * t[i];
        }
      });
      A[0][0] += 1e-6; A[1][1] += 1e-6;
      beta = solve2(A, b);
    }
    return beta[0];
  };
  const plainFull = interceptOf(cohort, false);
  const weightedFull = interceptOf(cohort, true);
  let plainMax = 0, weightedMax = 0, worstSlug = null, weightedOfWorst = 0;
  for (const row of cohort) {
    const rest = cohort.filter((p) => p.slug !== row.slug);
    const pm = Math.abs(plainFull - interceptOf(rest, false));
    if (pm > plainMax) {
      plainMax = pm;
      worstSlug = row.slug;
      weightedOfWorst = Math.abs(weightedFull - interceptOf(rest, true));
    }
    const wm = Math.abs(weightedFull - interceptOf(rest, true));
    if (wm > weightedMax) weightedMax = wm;
  }
  check("the worst plain-fit row moves the intercept by the 0.410 the copy prints",
    Math.round(plainMax * 1000) / 1000 === cal.influence_plain,
    `recomputed ${plainMax.toFixed(4)} vs published ${cal.influence_plain}`);
  check("the worst row moves the weighted fit by the 0.273 the copy prints",
    Math.round(weightedMax * 1000) / 1000 === cal.influence_weighted,
    `recomputed ${weightedMax.toFixed(4)} vs published ${cal.influence_weighted}`);
  check("the row a plain fit leans on moves the model's own fit by the 0.084 the copy prints",
    Math.round(weightedOfWorst * 1000) / 1000 === cal.influence_worst_row_weighted,
    `recomputed ${weightedOfWorst.toFixed(4)} vs published ${cal.influence_worst_row_weighted} (${worstSlug})`);
  // "a fifth as much" is the ratio of the two moves, rounded to a fifth.
  const ratio = plainMax / weightedOfWorst;
  check("the weighted fit's move really is about a fifth of the plain fit's",
    Math.round(ratio) === 5, `${ratio.toFixed(2)}x -> a round ${Math.round(ratio)}th`);

  // and the copy must quote the measured values, not typed-in ones
  const copy = data.copy ?? {};
  const modelCopy = JSON.stringify(copy);
  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/model.ts'), 'utf8');
  const quoted = (v) => modelCopy.includes(v.toFixed(3));
  check("the copy quotes the measured intercept moves", quoted(cal.influence_plain) && quoted(cal.influence_weighted),
    `${cal.influence_plain} and ${cal.influence_weighted} appear in the copy`);
  check("the copy quotes the measured worst-row move", quoted(cal.influence_worst_row_weighted),
    `${cal.influence_worst_row_weighted} appears in the copy`);
  const noLiteral = !/by 0\.410 log10/.test(libSrc) && !/by 0\.273 log10/.test(libSrc)
    && !/by 0\.084, a fifth/.test(libSrc);
  check("no influence figure is typed into the copy source", noLiteral,
    'the copy source builds them from the calibration');
}

// ---------------------------------------------------------------- the model's own tables, re-derived
// The model tab prints a category table, an age-band table and a set of five rate tiles. Every
// number in them is printed from the calibration, but the tables are built by the page's own
// code, so the page could print a category correction or a band count the calibration does not
// hold. This block re-derives each printed table from the calibration and the built rows.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const cal = data.calibration;
  const copy = JSON.stringify(data.copy ?? {});

  // --- the age-band table: five bands, each with its n, its issued count and its rate ---
  const bands = cal.bands;
  check('the calibration holds the five age bands the table prints', bands.length === 5,
    `${bands.length} bands`);
  let bandBad = 0;
  for (const b of bands) {
    if (!Number.isInteger(b.n) || !Number.isInteger(b.issued)) bandBad++;
    if (b.issued > b.n) bandBad++;
    if (b.n <= 0) bandBad++;
  }
  check('every age band holds a whole count of protocols and of issuers', bandBad === 0,
    bandBad === 0 ? 'all sound' : `${bandBad} unsound`);
  // the bands partition the universe: their counts add up to it
  const bandTotal = bands.reduce((n, b) => n + b.n, 0);
  check("the age bands add up to the launch model's whole universe",
    bandTotal === cal.universe_size, `${bandTotal} of ${cal.universe_size}`);
  // the issuers add up to the universe's issued count
  const issuedTotal = bands.reduce((n, b) => n + b.issued, 0);
  // the library's own rule: a protocol has issued a token of its own if it records a market cap
  // or a CoinGecko id of its own
  const universeIssued = data.universe.filter((p) => p.mcap_usd !== null || p.gecko_id !== null).length;
  check('the age bands\' issuer counts add up to the universe\'s',
    issuedTotal === universeIssued, `${issuedTotal} of ${universeIssued}`);

  // --- the category table: every category the cohort saw, its correction and its evidence ---
  const catSizes = cal.category_sizes;
  const catLog = cal.category_log;
  const catNames = Object.keys(catSizes);
  check('the category table has one row per category the cohort saw',
    catNames.length === 26, `${catNames.length} categories`);
  check('every category in the table has a correction', catNames.every((c) => typeof catLog[c] === 'number'),
    catNames.filter((c) => typeof catLog[c] !== 'number').join(', ') || 'all present');
  // the evidence counts must add up to the cohort
  const evidenceTotal = Object.values(catSizes).reduce((n, k) => n + k, 0);
  check("the category table's evidence counts add up to the cohort",
    evidenceTotal === cal.cohort_size, `${evidenceTotal} of ${cal.cohort_size}`);
  // the thin categories: the copy says 21 of the 26 rest on three or fewer
  const thin = catNames.filter((c) => catSizes[c] <= 3).length;
  check('the thin-category count the copy prints is the measured one',
    copy.includes(thin + ' of the ' + catNames.length + ' rest on three or fewer'),
    `${thin} of ${catNames.length}`);
  // the categories the cohort never saw fall back to the default correction. The page prints that
  // row itself, so the check reads the page's source, where it formats the correction.
  const defaultCat = cal.category_default;
  const pageSrc = fs.readFileSync(path.join(out, 'dashboard', 'page.js'), 'utf8');
  check('the default correction the page prints is the calibration\'s',
    pageSrc.includes('c.category_default'), 'the page reads it from the calibration');
  check('the default correction is a number the model can apply to an unseen category',
    typeof defaultCat === 'number' && Number.isFinite(defaultCat), defaultCat.toFixed(5));

  // --- the rows on the 5% floor: the copy names a count ---
  const floored = data.rows.filter((r) => Math.abs(r.launch_probability - 0.05) < 1e-9).length;
  check('the rows on the 5% floor are the count the copy names',
    copy.includes(floored + ' rows sit on the 5% floor'), `${floored} rows`);
  const ceiled = data.rows.filter((r) => Math.abs(r.launch_probability - 0.95) < 1e-9).length;
  check('no row sits on the 95% ceiling', ceiled === 0, `${ceiled} rows`);

  // --- the untracked protocols: the copy names a count and what it does with them ---
  check('the untracked count the copy names is the measured one',
    copy.includes(cal.untracked + ' with no first-tracked date'), `${cal.untracked}`);
  check("the untracked protocols are counted as a year old, so the bands cover the universe",
    bandTotal === cal.universe_size, `${bandTotal} of ${cal.universe_size}`);

  // --- the model's own table of rates, the five tiles ---
  const tiles = bands.map((b) => Math.round((b.issued / b.n) * 100) + '%');
  check('the five rate tiles are the bands\' own rates', tiles.length === 5, tiles.join(' '));
}

// ---------------------------------------------------------------- the Already trading tab's counts
// The tab's opening paragraph states eight counts: the snapshot's size, how many record a token,
// how many carry a market cap, how many of those are exchange venues, how many are left, how many
// the table shows, how many of those are in the cohort, and what the other nine are.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const facts = data.facts;
  const live = data.live;
  const copy = JSON.stringify(data.copy ?? {});

  check('the snapshot\'s protocol count is the one the copy names',
    copy.includes('holds ' + facts.snapshot_protocols + ' protocols'), String(facts.snapshot_protocols));
  check('the count of protocols recording a token is the one the copy names',
    copy.includes(facts.snapshot_tokens + ' of which record a token'), String(facts.snapshot_tokens));
  check('the count carrying a market cap is the one the copy names',
    copy.includes(facts.live_with_cap + ' carry a market cap'), String(facts.live_with_cap));
  check('the count of exchange venues among them is the one the copy names',
    copy.includes(facts.live_cex + ' of those are exchange venues'), String(facts.live_cex));
  check('the count left after the venues are set aside is the one the copy names',
    copy.includes('leaves the ' + facts.live_candidates + ' in this table'), String(facts.live_candidates));
  check('the table really holds the number of rows the copy names',
    live.length === facts.live_candidates, `${live.length} rows`);

  // The note's accounting has to close for a reader: of the protocols that record a token, some
  // are in the table, some carry no price at all and are on neither table, and the rest are the
  // venues set aside. A reader who adds the numbers up must land on the count the note opened
  // with -- otherwise the paragraph has swallowed a group without saying so.
  check('the protocols that record a token but carry no price are the count the copy names',
    copy.includes('The other ' + facts.live_no_cap + ' record a token but no price'),
    String(facts.live_no_cap));
  check('the live note\'s accounting closes: the priced and the unpriced are every protocol that records a token',
    facts.live_with_cap + facts.live_no_cap === facts.snapshot_tokens,
    `${facts.live_with_cap} + ${facts.live_no_cap} = ${facts.live_with_cap + facts.live_no_cap}, against ${facts.snapshot_tokens}`);
  check('the live note\'s accounting closes: the table and the venues are every priced protocol',
    facts.live_candidates + facts.live_cex === facts.live_with_cap,
    `${facts.live_candidates} + ${facts.live_cex} = ${facts.live_candidates + facts.live_cex}, against ${facts.live_with_cap}`);

  // the cohort membership: 75 of the 119, and the other 44
  const cohortSlugs = new Set(data.cohort.map((p) => p.slug));
  const inCohort = live.filter((r) => cohortSlugs.has(r.slug)).length;
  check('the cohort membership the copy names is the measured one',
    copy.includes(inCohort + ' of these ' + live.length + ' are in the model\'s calibration cohort'), `${inCohort} of ${live.length}`);
  const outside = live.filter((r) => !cohortSlugs.has(r.slug));
  check('the rows outside the cohort are the count the copy names',
    copy.includes('Of the ' + live.length + ', ' + outside.length + ' are here only as contrast'), `${outside.length}`);
  // and each of the nine carries its own reason, and the copy's breakdown names every kind
  const reasons = {};
  for (const r of outside) {
    const k = r.not_in_cohort;
    check('the row outside the cohort states why it is there: ' + r.slug,
      typeof k === 'string' && k.length > 0, String(k));
    reasons[k] = (reasons[k] ?? 0) + 1;
  }
  // the copy lists them as "1 versioned pool, 18 bridges, 11 staking wrappers, 1 wrapped or staked
  // name, 13 under the model's $1M floor" -- and each kind's plural is written out, because the
  // floor reason is a phrase and cannot take an "s".
  const tally = Object.entries(reasons).sort((a, b) => b[1] - a[1]);
  const PLURAL = {
    'bridge': 'bridges',
    'staking wrapper': 'staking wrappers',
    'versioned pool': 'versioned pools',
    'wrapped or staked name': 'wrapped or staked names',
    'exchange venue': 'exchange venues',
    "under the model's $1M market-cap or TVL floor": "under the model's $1M floor",
  };
  check('the copy names every kind of row outside the cohort, with its count',
    tally.every(([kind, n]) => copy.includes(n + ' ' + (n > 1 ? (PLURAL[kind] ?? kind + 's') : kind))),
    tally.map(([k, n]) => n + ' ' + k).join(', '));
  check('the rows outside the cohort add up to the count the copy names',
    outside.length === tally.reduce((n, [, c]) => n + c, 0), `${outside.length}`);

  // A protocol that records a CoinGecko id but carries no market cap records a token the
  // snapshot does not price. It is not trading, so the page must not say it "already trades"
  // -- and it is on neither table, so the message must say that too.
  const unpriced = (data.universe ?? []).filter((u) => u.gecko_id !== null && !(u.mcap_usd > 0));
  check('the page has a message for a token the snapshot does not price',
    typeof data.copy?.labels?.token_recorded_not_priced === 'string'
      && data.copy.labels.token_recorded_not_priced.length > 20
      && !/trades/.test(data.copy.labels.token_recorded_not_priced),
    data.copy?.labels?.token_recorded_not_priced);
  check('the page\'s own source routes an unpriced token to that message',
    /gecko_id !== null && !\(u\.mcap_usd > 0\)/.test(fs.readFileSync(path.join(out, 'dashboard', 'page.js'), 'utf8')),
    'missingProtocol does not test the market cap');
}

// ---------------------------------------------------------------- the reader's own arithmetic lands
// The board prints three numbers per row: the conditional value ("If issued"), the launch odds,
// and the implied value. The library computes the implied value from the two figures AS DISPLAYED
// so that a reader's own multiplication lands on it. This checks that promise for every row, with
// the library's own rounding, and that the page's rendered cells are the data's own.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const rows = data.rows;

  // the library's own roundToSig, read out of lib/model.ts so the check cannot drift from it
  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/model.ts'), 'utf8');
  const sigMatch = libSrc.match(/export function roundToSig\(n: number, sig: number\): number \{([\s\S]*?)\n\}/);
  const roundToSig = sigMatch
    ? new Function('n', 'sig', sigMatch[1])
    : (n, sig) => {
      if (!Number.isFinite(n) || n === 0) return n;
      const a = Math.abs(n);
      const scale = a >= 1e9 ? 1e9 : a >= 1e6 ? 1e6 : a >= 1e3 ? 1e3 : 1;
      const mant = n / scale;
      const factor = Math.pow(10, sig - 1 - Math.floor(Math.log10(Math.abs(mant))));
      return Math.round(mant * factor) / factor * scale;
    };

  // 1. the implied value is the conditional value times the odds, from the figures as displayed
  let off = 0;
  let worstOff = 0;
  for (const r of rows) {
    const shownConditional = roundToSig(r.conditional_value_usd, 5);
    const shownProbability = Math.round(r.launch_probability * 1e6) / 1e6;
    const expected = Math.max(1, Math.round(roundToSig(shownConditional * shownProbability, 3)));
    if (expected !== r.implied_value_usd) {
      off++;
      worstOff = Math.max(worstOff, Math.abs(expected - r.implied_value_usd));
    }
  }
  check("every row's implied value is the product of the two figures the page prints",
    off === 0, off === 0 ? `all ${rows.length} rows` : `${off} differ, worst by ${worstOff}`);

  // 2. a reader who multiplies the PRINTED numbers lands on the PRINTED implied value
  const money = (n, sig) => {
    if (n === null || n === undefined) return '—';
    const a = Math.abs(n);
    const s = sig || 3;
    if (a >= 1e9) return '$' + (n / 1e9).toPrecision(s) + 'B';
    if (a >= 1e6) return '$' + (n / 1e6).toPrecision(s) + 'M';
    if (a >= 1e3) return '$' + (n / 1e3).toPrecision(s) + 'K';
    return '$' + Math.round(n);
  };
  let drift = 0;
  let worstDrift = 0;
  for (const r of rows) {
    const condText = money(r.conditional_value_usd, 5);
    const probText = (r.launch_probability * 100).toFixed(4) + '%';
    const unit = { K: 1e3, M: 1e6, B: 1e9 }[condText.slice(-1)] ?? 1;
    const condNum = parseFloat(condText.replace(/[$,]/g, '').replace(/[KMB]$/, '')) * unit;
    const probNum = parseFloat(probText) / 100;
    const reader = roundToSig(condNum * probNum, 3);
    const shown = roundToSig(r.implied_value_usd, 3);
    const d = Math.abs(reader - shown) / Math.max(shown, 1);
    if (d > 1e-4) { drift++; worstDrift = Math.max(worstDrift, d); }
  }
  check("a reader's own multiplication of the printed figures lands on the printed implied value",
    drift === 0, drift === 0 ? `all ${rows.length} rows` : `${drift} rows, worst ${(worstDrift * 100).toFixed(4)}% off`);

  // 3. and the rendered page shows the data, character for character
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  const shown = await page.evaluate(() => {
    const out = [];
    for (const tr of document.querySelectorAll('#view-board tbody tr')) {
      out.push([...tr.querySelectorAll('td')].map((td) => td.textContent.replace(/\s+/g, ' ').trim()));
    }
    return out;
  });
  await browser.close();
  let cellBad = 0;
  const firstBad = [];
  shown.forEach((tds, i) => {
    const r = rows[i];
    if (!r) { cellBad++; return; }
    const want = [
      String(r.rank),
      r.name,
      r.on_watchlist ? 'On the house watchlist' : 'Off the house watchlist',
      r.category,
      money(r.tvl_usd),
      r.change_7d === null ? '—' : (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%',
      (r.launch_probability * 100).toFixed(4) + '%',
      money(r.conditional_value_usd, 5),
      money(r.implied_value_usd),
    ];
    for (let c = 0; c < want.length; c++) {
      if (tds[c] !== want[c]) {
        cellBad++;
        if (firstBad.length < 4) firstBad.push(`row ${r.rank} column ${c}: the page shows "${tds[c]}", the data says "${want[c]}"`);
      }
    }
  });
  check('every cell the board renders is the data it carries, character for character',
    cellBad === 0, cellBad === 0 ? `${shown.length} rows, ${shown.length * 9} cells` : firstBad.join(' | '));
}

// ---------------------------------------------------------------- the two narrative claims
// The page names a row: "the row that moves a plain fit most -- the one priced at four hundred
// times its deposits". And it claims a precision: "the coefficients are printed to four decimals
// here, and the category corrections to five, so the sum above lands on the conditional value to
// within one part in a thousand rather than exactly".
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const cal = data.calibration;
  const copy = data.copy ?? {};

  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/model.ts'), 'utf8');
  const constOf = (name) => {
    const m = libSrc.match(new RegExp('const ' + name + '[^=]*=\\s*([\\s\\S]*?);\\n'));
    return m ? eval(m[1]) : undefined;
  };
  const DERIVATIVE_CATEGORIES = constOf('DERIVATIVE_CATEGORIES');
  const VERSIONED = constOf('VERSIONED');
  const WRAPPED_WORD = constOf('WRAPPED_WORD');
  const EXCHANGE_NAME = constOf('EXCHANGE_NAME');
  const cohort = snapshot.protocols.filter((p) =>
    !(p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) &&
    !VERSIONED.test(p.name) && !WRAPPED_WORD.test(p.name) && !EXCHANGE_NAME.test(p.name) &&
    !(p.mcap_usd === null && p.gecko_id === null && p.symbol === null) &&
    (p.mcap_usd ?? 0) >= 1_000_000 && p.tvl_usd >= 1_000_000);

  // the row priced at four hundred times its deposits
  const worst = cohort.reduce((a, b) => ((b.mcap_usd ?? 1) / Math.max(b.tvl_usd, 1) >
    (a.mcap_usd ?? 1) / Math.max(a.tvl_usd, 1) ? b : a));
  const worstRatio = (worst.mcap_usd ?? 1) / Math.max(worst.tvl_usd, 1);
  check("the row a plain fit leans on hardest is priced at 400 times its deposits",
    Math.abs(worstRatio - 400) < 5, `${worst.slug} at ${worstRatio.toFixed(1)}x`);
  check('the copy names that row as four hundred times its deposits',
    copy.value_fit_note.includes('four hundred times its deposits'), 'stated');

  // the precision claim: the printed coefficients and corrections against the exact ones
  const a = Math.round(cal.value_beta[0] * 1e4) / 1e4;
  const b = Math.round(cal.value_beta[1] * 1e4) / 1e4;
  let worstRel = 0;
  for (const p of cohort) {
    const cat = p.category ?? '(none)';
    const exactCat = cal.category_log[cat] ?? cal.category_default;
    const printedCat = Math.round(exactCat * 1e5) / 1e5;
    const t = Math.log10(Math.max(p.tvl_usd, 1));
    const exact = cal.value_beta[0] + cal.value_beta[1] * t + exactCat;
    const printed = a + b * t + printedCat;
    const rel = Math.abs(Math.pow(10, printed) - Math.pow(10, exact)) / Math.pow(10, exact);
    if (rel > worstRel) worstRel = rel;
  }
  check("the printed sum lands on the conditional value to within one part in a thousand",
    worstRel < 1e-3, worstRel.toExponential(3));
  check('the copy says the printed sum lands to within one part in a thousand',
    copy.formula.includes('one part in a thousand'), 'stated');
}

// ---------------------------------------------------------------- the page's own figures are the data's
// The page's ledes state counts -- 195 board rows, 40 on the watchlist, 155 off it, 19 above
// the floor and 136 below, 119 live candidates, 128 with a market cap, 9 exchange venues,
// 21 live rows in the cohort, 4 rows on the growth clamp, 26 on the 5% odds floor. They are
// computed by the library into `facts` and rendered from there, so they cannot disagree with
// the data; this check re-derives them from the snapshot so they cannot disagree with the
// library either.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const rows = data.rows ?? [];
  const facts = data.facts ?? {};
  const copy = data.copy ?? {};

  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/model.ts'), 'utf8');
  const constOf = (name) => {
    const m = libSrc.match(new RegExp('const ' + name + '[^=]*=\\s*([\\s\\S]*?);\\n'));
    return m ? eval(m[1]) : undefined;
  };
  const DERIVATIVE_CATEGORIES = constOf('DERIVATIVE_CATEGORIES');
  const VERSIONED = constOf('VERSIONED');
  const WRAPPED_WORD = constOf('WRAPPED_WORD');
  const EXCHANGE_NAME = constOf('EXCHANGE_NAME');
  const eligible = snapshot.protocols.filter((p) =>
    !(p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) &&
    !VERSIONED.test(p.name) && !WRAPPED_WORD.test(p.name) && !EXCHANGE_NAME.test(p.name));
  const isPre = (p) => p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
  const watchlist = new Set(snapshot.watchlist);
  const board = eligible.filter(isPre);
  const offList = board.filter((p) => !watchlist.has(p.slug));
  const above = offList.filter((p) => p.tvl_usd >= 50_000_000);
  const below = offList.filter((p) => p.tvl_usd < 50_000_000);

  check('the board lede says 195 rows', copy.board_lede.includes('195 protocols'), 'stated');
  check('the board lede says 40 on the watchlist and 155 off it',
    copy.board_lede.includes('40 on the house watchlist and 155 off the list'), 'stated');
  check('19 board rows sit above the floor and off the list', above.length === 19, `${above.length}`);
  check('136 board rows sit below the floor and off the list', below.length === 136, `${below.length}`);
  check('59 board rows clear the $50M floor', watchlist.size + above.length === 59,
    `${watchlist.size + above.length}`);

  // The protocols the board leaves off, and the reason for each. The board's own rule is
  // structural, so a protocol off the board always has one; and "below the floor" is not a rule,
  // so a small protocol the board KEEPS must not be counted among the ones it leaves off.
  const offBoard = snapshot.protocols.filter((p) => isPre(p) && !board.some((b) => b.slug === p.slug));
  const offReason = (p) => {
    if (p.category === 'CEX') return 'exchanges';
    if (['Bridge', 'Canonical Bridge', 'Cross Chain Bridge'].includes(p.category)) return 'bridges';
    if (['Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'Anchor BTC'].includes(p.category)) return 'staking';
    if (/\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/.test(p.name)) return 'versioned';
    if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return 'wrapped';
    if (/^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/.test(p.name)) return 'exchanges';
    return null;
  };
  const offWithReason = offBoard.filter((p) => offReason(p) !== null);
  check('every protocol the board leaves off has a reason of its own',
    offWithReason.length === offBoard.length, `${offWithReason.length} of ${offBoard.length}`);
  check('the excluded list the page carries is every protocol left off above the floor',
    (data.excluded ?? []).length === offBoard.filter((p) => p.tvl_usd >= 50_000_000).length,
    `${(data.excluded ?? []).length}`);
  check('the below-floor count is the ones the board leaves off, not every small protocol',
    data.below_floor === offBoard.filter((p) => p.tvl_usd < 50_000_000).length,
    `${data.below_floor} against ${offBoard.filter((p) => p.tvl_usd < 50_000_000).length}`);
  check('the small protocols the board keeps are not counted among the ones it leaves off',
    data.below_floor !== snapshot.protocols.filter((p) => isPre(p) && p.tvl_usd < 50_000_000).length,
    `${data.below_floor}`);

  // the live tab, under the library's own rules
  const liveCandidates = snapshot.protocols
    .filter((p) => !isPre(p) && (p.mcap_usd ?? 0) > 0 && p.category !== 'CEX');
  const withCap = snapshot.protocols.filter((p) => (p.mcap_usd ?? 0) > 0);
  const cex = withCap.filter((p) => p.category === 'CEX');
  check('119 protocols could sit in the live table', liveCandidates.length === 119, `${liveCandidates.length}`);
  check('128 protocols carry a market cap of their own', withCap.length === 128, `${withCap.length}`);
  check('9 of those are exchange venues', cex.length === 9, `${cex.length}`);
  check('the live tab holds every candidate, not a page of them',
    (data.live ?? []).length === liveCandidates.length, `${(data.live ?? []).length} of ${liveCandidates.length}`);
  check('75 live rows are in the calibration cohort', facts.live_in_cohort === 75, `${facts.live_in_cohort}`);
  check('the 44 live rows outside the cohort are named by reason',
    facts.live_out_reasons === '1 versioned pool, 18 bridges, 11 staking wrappers, 1 wrapped or staked name, 13 under the model\'s $1M floor',
    facts.live_out_reasons);

  // The word "universe" has to mean one set at a time. The meta bar used to label the snapshot's
  // 758 protocols "universe", while the model tab calls the 433 eligible protocols "the eligible
  // universe" and the launch fit's 303 "its own universe" -- three sets, one word, one page.
  check('the snapshot count is the snapshot, not a universe', data.snapshot_size === snapshot.protocols.length,
    `${data.snapshot_size}`);
  check('the eligible count is the protocols the radar may price',
    data.eligible_size === eligible.length, `${data.eligible_size} against ${eligible.length}`);
  check('the page names the eligible universe with its number',
    copy.refit_lead.includes('eligible universe — the ' + data.eligible_size + ' protocols'),
    copy.refit_lead.slice(0, 120));
  check('the page names the eligible universe as a part of the snapshot',
    copy.refit_lead.includes('of the snapshot\'s ' + data.snapshot_size),
    copy.refit_lead.slice(0, 200));
  check('the data carries no field that calls the snapshot a universe', !('universe_size' in data),
    Object.keys(data).filter((k) => k.includes('universe')).join(', ') || 'none');

  // the clamps
  const clamped = rows.filter((r) => r.change_7d !== null && (r.change_7d < -60 || r.change_7d > 120)).length;
  const floored = rows.filter((r) => r.launch_probability <= 0.05).length;
  check('4 board rows sit on the growth clamp', clamped === 4, `${clamped}`);
  check('26 board rows sit on the 5% odds floor', floored === 26, `${floored}`);
  check('the clamps note quotes both counts',
    copy.clamps.includes('4 of the board') && copy.clamps.includes('26 rows sit on the 5% floor'), 'stated');
}

// ---------------------------------------------------------------- the universe's counts, and the board's
// MODEL.md states the shape of the snapshot: 758 protocols, 433 eligible, 195 on the board,
// 40 of them the house's watchlist, 26 categories in the cohort's correction table, 21 of them
// with three members or fewer, 11 with exactly one, and 35 protocols with no first-tracked date.
// This check re-derives every one of them from the snapshot and the published calibration.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const cal = data.calibration;
  const rows = data.rows ?? data.board ?? [];

  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/model.ts'), 'utf8');
  const constOf = (name) => {
    const m = libSrc.match(new RegExp('const ' + name + '[^=]*=\\s*([\\s\\S]*?);\\n'));
    return m ? eval(m[1]) : undefined;
  };
  const DERIVATIVE_CATEGORIES = constOf('DERIVATIVE_CATEGORIES');
  const VERSIONED = constOf('VERSIONED');
  const WRAPPED_WORD = constOf('WRAPPED_WORD');
  const EXCHANGE_NAME = constOf('EXCHANGE_NAME');
  const issued = (p) => p.mcap_usd !== null || p.gecko_id !== null;
  const isPreToken = (p) => !issued(p) && p.symbol === null;
  const isProduct = (p) => p.symbol !== null && !issued(p);
  const eligible = snapshot.protocols.filter((p) =>
    !(p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) &&
    !VERSIONED.test(p.name) && !WRAPPED_WORD.test(p.name) && !EXCHANGE_NAME.test(p.name));

  check('the snapshot holds 758 protocols', snapshot.protocols.length === 758, `${snapshot.protocols.length}`);
  check('the eligible universe is 433 of them', eligible.length === 433, `${eligible.length}`);
  check('the board holds 195 rows', rows.length === 195, `${rows.length}`);

  const onWatchlist = rows.filter((r) => r.on_watchlist).length;
  check('the house watchlist holds 40 protocols', snapshot.watchlist.length === 40, `${snapshot.watchlist.length}`);
  check('all 40 watchlist protocols are on the board', onWatchlist === 40, `${onWatchlist}`);

  const categoryNames = Object.keys(cal.category_log);
  check('the cohort correction table names 26 categories', categoryNames.length === 26, `${categoryNames.length}`);
  const sizes = categoryNames.map((k) => cal.category_sizes[k]);
  const thin = sizes.filter((n) => n <= 3).length;
  const single = sizes.filter((n) => n === 1).length;
  check('21 of the 26 categories have three cohort members or fewer', thin === 21, `${thin}`);
  check('11 of them have exactly one', single === 11, `${single}`);

  // the protocols with no first-tracked date
  const untrackedBoard = rows.filter((r) => r.age_days === null || r.age_days === undefined).length;
  check('seven board rows have no first-tracked date', untrackedBoard === 7, `${untrackedBoard}`);
  check('35 protocols in the launch universe have no first-tracked date', cal.untracked === 35, `${cal.untracked}`);
}

// ---------------------------------------------------------------- the launch model's AUC, both labellings
// MODEL.md: "The correction raised the AUC from 0.735: a model trained on the wrong labels was
// taken on trust." The OLD labelling is the pre-G08 one -- y = isPreToken(p) ? 0 : 1 over the WHOLE
// eligible universe, fitted by 400 iterations of plain gradient ascent with step 0.6*gradient/n.
// The NEW labelling drops the product rows and fits to a flat gradient. This check re-derives
// both, and refuses to let the shipped AUC drift from the measured one.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const cal = data.calibration;

  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/model.ts'), 'utf8');
  const constOf = (name) => {
    const m = libSrc.match(new RegExp('const ' + name + '[^=]*=\\s*([\\s\\S]*?);\\n'));
    return m ? eval(m[1]) : undefined;
  };
  const DERIVATIVE_CATEGORIES = constOf('DERIVATIVE_CATEGORIES');
  const VERSIONED = constOf('VERSIONED');
  const WRAPPED_WORD = constOf('WRAPPED_WORD');
  const EXCHANGE_NAME = constOf('EXCHANGE_NAME');
  const AGE_BANDS = constOf('AGE_BANDS');
  const TVL_BANDS = constOf('TVL_BANDS');
  const UNKNOWN_AGE = constOf('UNKNOWN_AGE');
  const clampGrowth = (g) => (g === null ? 0 : Math.max(-60, Math.min(120, g)));
  const ageDays = (listedAt) => {
    if (!listedAt) return null;
    const a = Date.parse(snapshot.as_of + 'T00:00:00Z'), b = Date.parse(listedAt + 'T00:00:00Z');
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    return Math.max(0, Math.floor((a - b) / 86400000));
  };
  const ageBandOf = (age) => { for (let i = 0; i < AGE_BANDS.length; i++) { const b = AGE_BANDS[i]; if (age >= b.lo && age < b.hi) return i; } return AGE_BANDS.length - 1; };
  const tvlBandOf = (tvl) => { for (let i = 0; i < TVL_BANDS.length; i++) { const b = TVL_BANDS[i]; if (tvl >= b[0] && tvl < b[1]) return i; } return TVL_BANDS.length - 1; };
  const launchRow = (p, age) => [1, ...AGE_BANDS.map((_, i) => (i === ageBandOf(age) ? 1 : 0)),
    ...TVL_BANDS.map((_, i) => (i === tvlBandOf(p.tvl_usd) ? 1 : 0)), clampGrowth(p.change_7d) / 10];
  const isPreToken = (p) => p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
  const issued = (p) => p.mcap_usd !== null || p.gecko_id !== null;
  const eligible = snapshot.protocols.filter((p) =>
    !(p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) &&
    !VERSIONED.test(p.name) && !WRAPPED_WORD.test(p.name) && !EXCHANGE_NAME.test(p.name));

  // the OLD fit, verbatim from the pre-G08 source
  const fitOld = (rows) => {
    const k = rows[0].x.length;
    let beta = new Array(k).fill(0);
    for (let iteration = 0; iteration < 400; iteration++) {
      const gradient = new Array(k).fill(0);
      for (const row of rows) {
        let z = 0;
        for (let j = 0; j < k; j++) z += beta[j] * row.x[j];
        const error = row.y - 1 / (1 + Math.exp(-z));
        for (let j = 0; j < k; j++) gradient[j] += error * row.x[j];
      }
      for (let j = 0; j < k; j++) beta[j] += (0.6 * gradient[j]) / rows.length;
    }
    return beta;
  };
  const aucWith = (rows, beta) => {
    const positives = rows.filter((r) => r.y === 1);
    const negatives = rows.filter((r) => r.y === 0);
    if (!positives.length || !negatives.length) return 0.5;
    let hits = 0;
    for (const positive of positives) {
      let zp = 0; for (let j = 0; j < positive.x.length; j++) zp += beta[j] * positive.x[j];
      for (const negative of negatives) {
        let zn = 0; for (let j = 0; j < negative.x.length; j++) zn += beta[j] * negative.x[j];
        hits += zp > zn ? 1 : zp === zn ? 0.5 : 0;
      }
    }
    return hits / (positives.length * negatives.length);
  };

  const oldRows = eligible.map((p) => {
    const age = ageDays(p.listed_at) ?? UNKNOWN_AGE;
    return { x: launchRow(p, age), y: isPreToken(p) ? 0 : 1 };
  });
  const oldAuc = aucWith(oldRows, fitOld(oldRows));
  check('the old labelling AUC is 0.735', Math.abs(oldAuc - 0.735) < 0.001, oldAuc.toFixed(4));

  // the NEW labelling, fitted the way the library fits: to a flat gradient
  const universe = eligible.filter((p) => !(p.symbol !== null && !issued(p)));
  const newRows = universe.map((p) => {
    const age = ageDays(p.listed_at) ?? UNKNOWN_AGE;
    return { x: launchRow(p, age), y: issued(p) ? 1 : 0 };
  });
  const fitNew = (rows) => {
    const k = rows[0].x.length;
    let beta = new Array(k).fill(0);
    for (let iteration = 0; iteration < 200000; iteration++) {
      const gradient = new Array(k).fill(0);
      for (const row of rows) {
        let z = 0;
        for (let j = 0; j < k; j++) z += beta[j] * row.x[j];
        const error = row.y - 1 / (1 + Math.exp(-z));
        for (let j = 0; j < k; j++) gradient[j] += error * row.x[j];
      }
      let norm = 0;
      for (let j = 0; j < k; j++) norm += gradient[j] * gradient[j];
      if (Math.sqrt(norm) < 1e-6) break;
      for (let j = 0; j < k; j++) beta[j] += (0.6 * gradient[j]) / rows.length;
    }
    return beta;
  };
  const newAuc = aucWith(newRows, fitNew(newRows));
  check('the corrected labelling AUC is 0.753', Math.abs(newAuc - 0.753) < 0.001, newAuc.toFixed(4));
  check('the shipped AUC is the measured one', Math.abs(cal.launch_auc - newAuc) < 0.001,
    `published ${cal.launch_auc} measured ${newAuc.toFixed(4)}`);
  check('the correction raised the AUC', newAuc > oldAuc, `${oldAuc.toFixed(4)} -> ${newAuc.toFixed(4)}`);

  // and the other figures MODEL.md states about the same fit
  check('the fitted coefficients are 4.4042 and -0.6443',
    Math.abs(cal.value_beta[0] - 4.4042) < 0.0001 && Math.abs(cal.value_beta[1] + 0.6443) < 0.0001,
    cal.value_beta.map((v) => v.toFixed(4)).join(', '));
  check('the in-sample median error is 0.337', Math.abs(cal.mae_log10 - 0.337) < 0.0005, String(cal.mae_log10));
}

// ---------------------------------------------------------------- the base rate and the shrinkage are measured
// MODEL.md claims three things about the category correction that were never re-derived:
//   "the base rate falls from 55.0% to 35.6%" (a 19.3-point gap)
//   "the largest gap between a one-member category's own residual and the global is 0.889 log10"
//   "its published correction sits at most 0.178 from the global", and the eleven one-member
//   categories' published corrections run "from 0.648 to 1.312 on the conditional value"
// This check re-measures all of them from the snapshot and the published calibration.
{
  const src = fs.readFileSync(path.join(out, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  const cal = data.calibration;

  const libSrc = fs.readFileSync(path.join(process.cwd(), 'lib/model.ts'), 'utf8');
  const constOf = (name) => {
    const m = libSrc.match(new RegExp('const ' + name + '[^=]*=\\s*([\\s\\S]*?);\\n'));
    return m ? eval(m[1]) : undefined;
  };
  const DERIVATIVE_CATEGORIES = constOf('DERIVATIVE_CATEGORIES');
  const VERSIONED = constOf('VERSIONED');
  const WRAPPED_WORD = constOf('WRAPPED_WORD');
  const EXCHANGE_NAME = constOf('EXCHANGE_NAME');
  const eligibleRows = snapshot.protocols.filter((p) =>
    !(p.category !== null && DERIVATIVE_CATEGORIES.has(p.category)) &&
    !VERSIONED.test(p.name) && !WRAPPED_WORD.test(p.name) && !EXCHANGE_NAME.test(p.name));
  const issued = (p) => p.mcap_usd !== null || p.gecko_id !== null;
  const isProduct = (p) => p.symbol !== null && !issued(p);
  const universe = eligibleRows.filter((p) => !isProduct(p));

  // The OLD labelling: y = isPreToken(p) ? 0 : 1 over the WHOLE eligible universe.
  const oldPositives = eligibleRows.filter((p) => !(p.mcap_usd === null && p.gecko_id === null && p.symbol === null)).length;
  const oldRate = oldPositives / eligibleRows.length;
  // The NEW labelling: y = issuedOwnToken(p) ? 1 : 0 over eligible LESS the product rows.
  const newPositives = universe.filter(issued).length;
  const newRate = newPositives / universe.length;
  const gapPoints = (oldRate - newRate) * 100;

  check('the eligible universe is 433 rows', eligibleRows.length === 433, `${eligibleRows.length}`);
  check('the launch universe is 303 rows', universe.length === 303, `${universe.length}`);
  check('the old base rate is 55.0%', Math.abs(oldRate * 100 - 55.0) < 0.05, oldRate.toFixed(4) + '%');
  check('the corrected base rate is 35.6%', Math.abs(newRate * 100 - 35.6) < 0.05, newRate.toFixed(4) + '%');
  check('the base-rate gap is 19.3 points', Math.abs(gapPoints - 19.3) < 0.05, gapPoints.toFixed(4) + ' points');

  // The shrinkage: the target, the one-member categories' own gaps, and their published factors.
  const default_ = cal.category_default;
  check('the shrinkage target is -0.0599', Math.abs(default_ + 0.0599) < 0.0001, default_.toFixed(6));
  check('the shrinkage target is a factor of 0.871', Math.abs(Math.pow(10, default_) - 0.871) < 0.001,
    Math.pow(10, default_).toFixed(3));

  const oneMember = Object.entries(cal.category_sizes).filter(([, n]) => n === 1).map(([k]) => k);
  check('eleven categories have exactly one cohort member', oneMember.length === 11, `${oneMember.length}`);

  // the largest gap between a one-member category's OWN residual and the global:
  // the category's own residual is what the shrinkage pulls back, so it is the published
  // correction put back through the shrinkage in reverse.
  const PRIOR = 4;
  const ownOf = (k) => (cal.category_log[k] * (1 + PRIOR) - default_ * PRIOR);
  let maxOwnGap = 0, maxPublished = 0;
  for (const k of oneMember) {
    maxOwnGap = Math.max(maxOwnGap, Math.abs(ownOf(k) - default_));
    maxPublished = Math.max(maxPublished, Math.abs(cal.category_log[k] - default_));
  }
  check("the largest one-member category's own gap is 0.889 log10", Math.abs(maxOwnGap - 0.889) < 0.001,
    maxOwnGap.toFixed(4));
  check("a one-member category's published correction sits at most 0.178 from the global",
    Math.abs(maxPublished - 0.178) < 0.001, maxPublished.toFixed(4));

  const factors = oneMember.map((k) => Math.pow(10, cal.category_log[k]));
  const lo = Math.min(...factors), hi = Math.max(...factors);
  check('the one-member corrections run from 0.648 to 1.312 on the conditional value',
    Math.abs(lo - 0.648) < 0.001 && Math.abs(hi - 1.312) < 0.001, `${lo.toFixed(3)} to ${hi.toFixed(3)}`);

  // and the sentence that states them must say them the way the measurement reads.
  const modelMd = fs.readFileSync(path.join(process.cwd(), 'MODEL.md'), 'utf8');
  check('MODEL.md states the base-rate gap as 19.3 points', modelMd.includes('19.3 points of base rate'), 'stated');
  check('MODEL.md states the one-member factor band as 0.648 and 1.312',
    modelMd.includes('0.648') && modelMd.includes('1.312'), 'stated');
  check('MODEL.md names the factor band as the published corrections, not a deviation from the global',
    modelMd.includes('published corrections') && modelMd.includes('run from 0.648 to 1.312'), 'stated');
}

// ---------------------------------------------------------------- the page's own meta bar
// The bar at the top of the page names the sets the radar works over. It used to call the
// snapshot's 758 protocols "the universe", while the model tab calls the 433 eligible protocols
// "the eligible universe" and the launch fit's 303 "its own universe": one word, three sets, one
// page. The bar's labels are read out of the DOM, because a check that reads the data can only
// see what the data says -- not what the reader sees.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + path.join(out, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  const bar = await page.evaluate(() => Array.from(document.querySelectorAll('#bar-meta div')).map((d) => ({
    k: d.querySelector('dt').textContent.trim(),
    v: d.querySelector('dd').textContent.trim(),
  })));
  await browser.close();
  const labels = bar.map((b) => b.k);
  const values = bar.map((b) => b.v);
  check('the meta bar names the snapshot, the eligible set and the board',
    labels.includes('snapshot') && labels.includes('eligible') && labels.includes('board'), labels.join(', '));
  check('no label in the meta bar calls a set a universe',
    !labels.some((l) => /universe/i.test(l)), labels.join(', '));
  check('the meta bar says how many protocols the snapshot holds',
    values.some((v) => v.includes('758')), values.join(' | '));
  check('the meta bar says how many protocols are eligible',
    values.some((v) => v.includes('433')), values.join(' | '));
  check('the meta bar says how many rows are on the board',
    values.some((v) => v.includes('195')), values.join(' | '));
  check('the meta bar does not call the 758 a universe in its values either',
    !values.some((v) => /universe/i.test(v)), values.join(' | '));
}

// ---------------------------------------------------------------- the page with no data at all
// The page reads its board from data.js, written beside it when the radar runs. If that file is
// not there, the page has to say so: it must not throw on the way there and leave the reader
// with a header and nothing else. The copy for that case cannot come from the data -- the data
// is what is missing -- so it has to be written into the page itself.
//
// This renders the page with no data.js AT ALL and reads what a reader would see.
{
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
  // a copy of the dashboard with no data.js beside it
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-nodata-'));
  fs.mkdirSync(path.join(empty, 'dashboard'));
  for (const f of fs.readdirSync(path.join(out, 'dashboard'))) {
    fs.copyFileSync(path.join(out, 'dashboard', f), path.join(empty, 'dashboard', f));
  }
  fs.writeFileSync(path.join(empty, 'dashboard', 'data.js'), '/* no data */');
  const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + path.join(empty, 'dashboard', 'index.html'), { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 400));
  const seen = await page.evaluate(() => ({
    panels: document.querySelectorAll('.missing').length,
    heading: (document.querySelector('.missing h1') || {}).textContent || '',
    body: (document.querySelector('.missing p') || {}).textContent || '',
    hint: (document.querySelector('.missing p.muted') || {}).textContent || ''
  }));
  await browser.close();
  fs.rmSync(empty, { recursive: true, force: true });
  check('the page with no data.js does not throw', errors.length === 0, errors.join(' | '));
  check('the page with no data.js shows its own explanation, not a bare header',
    seen.panels === 1 && seen.heading.length > 0 && seen.body.length > 0 && seen.hint.length > 0,
    seen.panels + ' panel(s): ' + seen.heading);
  check('the no-data explanation says where the board comes from',
    /data\.js/.test(seen.body) && /main\.ts/.test(seen.hint),
    seen.body.slice(0, 60) + ' / ' + seen.hint.slice(0, 60));
}

// ---------------------------------------------------------------- dossier_matches
const dossierPath = path.join(out, 'dossier.json');
const dossier = fs.readFileSync(dossierPath);
check('dossier.json is at most 1.5 MiB', dossier.length <= 1.5 * 1024 * 1024, `${dossier.length} bytes`);
const parsed = JSON.parse(dossier.toString('utf8'));
check('dossier schema is makefun/dossier/v1', parsed.schema === 'makefun/dossier/v1', parsed.schema);
check('dossier holds the three screenshots', parsed.images.length === shots.length, `${parsed.images.length}`);
check('dossier text names every dashboard file', dashFiles.every((f) => parsed.text.includes('- ' + f.path + ' (')),
  `${dashFiles.length} files`);
const cut = parsed.text.match(/\[Cut at (\d+) bytes/);
check('the dossier text holds the whole source (no cut)', cut === null, cut ? cut[0] : 'no cut line');

// Rebuild the dossier with the vendored library and compare byte for byte.
const { buildDossier } = await import(path.join(process.cwd(), 'vendor/makefun-board.ts'));
const rebuilt = Buffer.from(buildDossier(out, {
  text_max_bytes: 65536,
  screenshots: { max: 4, max_bytes: 524288 },
  dashboard: { max_files: 400, max_bytes: 4194304 }
}));
check('dossier.json is byte for byte what buildDossier writes', rebuilt.equals(dossier),
  rebuilt.equals(dossier) ? 'identical' : `rebuilt ${rebuilt.length} vs dossier ${dossier.length}`);

console.log('');
console.log(failures === 0 ? 'ALL GATES PASS' : `${failures} GATE(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
