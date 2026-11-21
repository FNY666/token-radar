// Does the board's row ADD UP? The three figures the row shows -- Launch
// odds, If issued, Implied value -- must multiply out: the reader takes the
// second and the third and expects the fourth.
//
//   node tools/triplecheck.cjs <built-out-dir>
//
// This reads the RENDERED cell text, not the model, because the defect is
// one of displayed precision: the exact triple is self-consistent on every
// row, and the board rounds each figure before showing it.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
const dir = process.argv[2];
const url = 'file://' + path.join(dir, 'dashboard', 'index.html');
const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';

// Round a product of two decimals to 3 significant figures, in EXACT DECIMAL arithmetic.
//
// The operands are the decimals the reader sees -- "21.500" and "5.0000" percent -- so the
// multiplication is done on integers scaled by a power of ten, not on binary floats. It has to
// be: 21.500M x 5.0000% is exactly 1,075,000, which rounds to 1.08M, but the float product sits
// a hair under the boundary and toPrecision(3) says 1.07. That was an artifact of this check,
// not a defect in the page.
function roundToSigExact(c, o) {
  const cStr = c.toFixed(6);            // dollars, 6 decimals
  const oStr = (o * 100).toFixed(4);    // percent, 4 decimals
  // the operands arrive as scaled floats; make them exact INTEGERS first, or the
  // BigInt conversion carries the float's error into the decimal
  const ci = BigInt(Math.round(c * 1e6));
  const oi = BigInt(Math.round(o * 100 * 1e4));
  // ci is scaled by 1e6, oi by 1e4, and the percent divides by 100
  const prod = ci * oi;                 // scaled by 1e12
  const scaled = prod / 100000000n;     // /100 for the percent, /1e4 for the two scalings
  const intPart = scaled / 10000n;
  const frac = (scaled % 10000n).toString().padStart(4, '0');
  const all = intPart.toString() + frac;
  const lead = all.length - all.replace(/^0+/, '').length;
  const keep = lead + 3;
  if (keep >= all.length) return fmt(Number(all) / 1e4);
  let head = all.slice(0, keep);
  if (all[keep] >= '5') {
    const arr = head.split('').reverse();
    let carry = 1;
    for (let i = 0; i < arr.length && carry; i++) {
      const d = Number(arr[i]) + carry;
      arr[i] = String(d % 10);
      carry = d >= 10 ? 1 : 0;
    }
    head = arr.reverse().join('');
  }
  // the rounded digits keep their place: the zeros that were cut stay cut, so the number
  // scales by exactly the four decimals the fraction carried
  const v = Number(head.padEnd(all.length, '0')) / 1e4;
  return fmt(v);
}
function fmt(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return '$' + (v / 1e9).toPrecision(3) + 'B';
  if (a >= 1e6) return '$' + (v / 1e6).toPrecision(3) + 'M';
  if (a >= 1e3) return '$' + (v / 1e3).toPrecision(3) + 'K';
  return '$' + Math.round(v);
}
const pn = (s) => parseFloat(s.replace(/[^0-9.]/g, ''));
const sc = (s) => (/B/.test(s) ? 1e9 : /M/.test(s) ? 1e6 : /K/.test(s) ? 1e3 : 1);

(async () => {
  const browser = await puppeteer.launch({executablePath: CHROME, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--force-device-scale-factor=1','--hide-scrollbars','--allow-file-access-from-files']});
  const page = await browser.newPage();
  await page.setViewport({width:1440,height:1200});
  await page.goto(url,{waitUntil:'networkidle0'});
  await page.waitForSelector('tbody tr');
  // Read the RENDERED cell text; the arithmetic happens here, in Node, where the exact-decimal
  // helper is in scope.
  const rows = await page.evaluate(() => Array.from(document.querySelectorAll('tbody tr')).map((r) => {
    const cells = Array.from(r.querySelectorAll('td')).map((t) => t.textContent.trim());
    return { name: (r.querySelector('.pname') || {}).textContent || '', last3: cells.slice(-3) };
  }));
  let disagree = 0;
  const ex = [];
  let maxWidth = 0;
  for (const r of rows) {
    const [odds, cond, val] = r.last3;
    maxWidth = Math.max(maxWidth, cond.length);
    const c = pn(cond) * sc(cond);
    const o = pn(odds) / 100;
    const prod = roundToSigExact(c, o);
    if (prod !== val) {
      disagree++;
      if (ex.length < 4) ex.push({ name: r.name, cond, odds, shown: val, prod });
    }
  }
  console.log(dir);
  console.log('  rows:', rows.length, '| rows whose SHOWN triple disagrees:', disagree, '| widest "If issued":', maxWidth, 'chars');
  for (const e of ex) console.log('   ', JSON.stringify(e));
  await browser.close();
})();
