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
(async () => {
  const browser = await puppeteer.launch({executablePath: CHROME, args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--force-device-scale-factor=1','--hide-scrollbars','--allow-file-access-from-files']});
  const page = await browser.newPage();
  await page.setViewport({width:1440,height:1200});
  await page.goto(url,{waitUntil:'networkidle0'});
  await page.waitForSelector('tbody tr');
  const d = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr'));
    let disagree=0, ex=[], widths=[];
    for (const r of rows) {
      const cells = Array.from(r.querySelectorAll('td')).map(t=>t.textContent.trim());
      const [odds, cond, val] = cells.slice(-3);
      const pn = (s)=>parseFloat(s.replace(/[^0-9.]/g,''));
      const sc = (s)=>/B/.test(s)?1e9:/M/.test(s)?1e6:/K/.test(s)?1e3:1;
      const c = pn(cond)*sc(cond), o = pn(odds)/100, v = pn(val)*sc(val);
      // round the product to 3 sig figs, the same way the page rounds
      const a=Math.abs(c*o);
      const m = a>=1e9 ? (a/1e9).toPrecision(3)*1e9 : a>=1e6 ? (a/1e6).toPrecision(3)*1e6 : a>=1e3 ? (a/1e3).toPrecision(3)*1e3 : Math.round(a);
      const shown = val;
      const prod = (m>=1e9?'$'+ (m/1e9).toPrecision(3)+'B': m>=1e6?'$'+ (m/1e6).toPrecision(3)+'M': m>=1e3?'$'+ (m/1e3).toPrecision(3)+'K':'$'+Math.round(m));
      if (prod !== shown) { disagree++; if(ex.length<4) ex.push({name:r.querySelector('.pname').textContent, cond, odds, shown, prod}); }
      widths.push(cond.length);
    }
    return { rows: rows.length, disagree, ex, maxWidth: Math.max(...widths) };
  });
  console.log(dir);
  console.log('  rows:', d.rows, '| rows whose SHOWN triple disagrees:', d.disagree, '| widest "If issued":', d.maxWidth, 'chars');
  for (const e of d.ex) console.log('   ', JSON.stringify(e));
  await browser.close();
})();
