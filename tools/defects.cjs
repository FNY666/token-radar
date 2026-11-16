// Measures every defect under review against the CURRENT build, so each fix is aimed at a
// measured problem rather than a reported one.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
const OUT = '/home/muse-newapi/makefun-token-radar/work/out';
const URL = 'file://' + path.join(OUT, 'dashboard', 'index.html');

(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');

  // 1. the value bar under a non-value sort
  const bar = await p.evaluate(() => {
    const out = {};
    function measure(label) {
      const rows = [...document.querySelectorAll('tbody tr.row')];
      const widths = rows.map(r => { const f = r.querySelector('.bar-fill'); return f ? f.getBoundingClientRect().width : -1; });
      const tracks = rows.map(r => { const t = r.querySelector('.bar-track'); return t ? t.getBoundingClientRect().width : -1; });
      out[label] = { maxFill: Math.max(...widths), track: tracks[0], over: widths.filter(w => w > tracks[0] + 0.5).length };
    }
    measure('rank');
    // sort by Protocol (name)
    const th = [...document.querySelectorAll('thead th')].find(x => /Protocol/.test(x.textContent));
    th.querySelector('button').click();
    return new Promise(res => setTimeout(() => { measure('name'); res(out); }, 250));
  });
  console.log('1. VALUE BAR  ', JSON.stringify(bar));

  // 2. plot dot aspect ratio and tick distortion
  const plot = await p.evaluate(() => {
    const svg = document.querySelector('.plot svg');
    const dots = [...svg.querySelectorAll('circle')].map(c => { const r = c.getBoundingClientRect(); return [r.width, r.height]; });
    const tick = svg.querySelector('text.tick');
    const tb = tick.getBoundingClientRect();
    const box = svg.getBoundingClientRect();
    // natural text width measured in the SVG's own user units
    const nat = svg.querySelector('text.tick').getComputedTextLength();
    const scaleX = box.width / 1000, scaleY = box.height / 150;
    return { dot: dots[0], dots0: dots.length, tickOnScreen: tb.width, tickNatural: nat, scaleX, scaleY,
             ratio: dots[0][0] / dots[0][1], textStretch: (tb.width / nat) };
  });
  console.log('2. PLOT       ', JSON.stringify(plot));

  // 3. chip pressed state after clicking
  const chip = await p.evaluate(() => {
    const chips = [...document.querySelectorAll('.chip')];
    const before = chips.map(c => c.getAttribute('aria-pressed'));
    chips[0].click();
    return new Promise(res => setTimeout(() => {
      const after = [...document.querySelectorAll('.chip')].map(c => ({ pressed: c.getAttribute('aria-pressed'), border: getComputedStyle(c).borderTopColor, text: c.textContent }));
      res({ before, after, rows: document.querySelectorAll('tbody tr.row').length });
    }, 250));
  });
  console.log('3. CHIP STATE ', JSON.stringify(chip));

  // 4. clear filters leaves stale input
  const clear = await p.evaluate(() => {
    const inp = document.querySelector('input[type=search]');
    inp.value = 'dex';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    return new Promise(res => setTimeout(() => {
      const sel = document.querySelector('.controls select');
      const before = { input: inp.value, select: sel.value, rows: document.querySelectorAll('tbody tr.row').length, result: document.getElementById('result-count').textContent };
      [...document.querySelectorAll('button.ghost')].find(x => /Clear/.test(x.textContent)).click();
      setTimeout(() => {
        const inp2 = document.querySelector('input[type=search]');
        const sel2 = document.querySelector('.controls select');
        res({ before, after: { input: inp2.value, select: sel2.value, rows: document.querySelectorAll('tbody tr.row').length, result: document.getElementById('result-count').textContent } });
      }, 250);
    }, 250));
  });
  console.log('4. CLEAR      ', JSON.stringify(clear));

  // 5. hero headline on the live tab
  await p.goto(URL + '#view=live', { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 300));
  const hero = await p.evaluate(() => ({
    h1: document.querySelector('.hero h1').textContent,
    lede: document.querySelector('.hero p.lede').textContent.slice(0, 160),
    liveRows: document.querySelectorAll('#view-live tbody tr').length
  }));
  console.log('5. HERO/LIVE  ', JSON.stringify(hero));

  // 6. legend label vs the cyan dots' actual TVL
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');
  const legend = await p.evaluate(() => {
    const txt = [...document.querySelectorAll('.plot-legend span')].map(s => s.textContent);
    // cyan dots are off-watchlist rows; check their floor status via the table
    const rows = [...document.querySelectorAll('tbody tr.row')].map(r => ({
      name: r.querySelector('.pname').textContent,
      scope: r.querySelector('.tag').textContent.trim(),
      tvl: r.children[4].textContent.trim()
    }));
    const floor = 50000000;
    const above = rows.filter(r => r.scope.startsWith('Off') && parseFloat(r.tvl.replace(/[^0-9.]/g,'')) * (r.tvl.includes('B')?1e9:r.tvl.includes('M')?1e6:1) > floor);
    return { txt, offListAboveFloor: above.length, sample: above.slice(0,3).map(r=>r.name+' '+r.tvl) };
  });
  console.log('6. LEGEND     ', JSON.stringify(legend));

  // 7. input border contrast + 8. aria-sort + 9. dialog name + 10. focus restore + 11. reduced motion
  const misc = await p.evaluate(() => {
    const inp = document.querySelector('input[type=search]');
    const cs = getComputedStyle(inp);
    return {
      inputBorder: cs.borderTopColor, inputFill: cs.backgroundColor,
      ariaSort: [...document.querySelectorAll('thead th')].map(t => t.getAttribute('aria-sort')),
      tabRoles: [...document.querySelectorAll('.tab')].map(t => t.getAttribute('role')),
      tablist: document.getElementById('tabs').getAttribute('role'),
      tabpanels: ['view-board','view-live','view-model'].map(id => document.getElementById(id).getAttribute('role'))
    };
  });
  console.log('7. MISC       ', JSON.stringify(misc));

  const dlg = await p.evaluate(() => {
    document.querySelector('tbody tr.row').click();
    return new Promise(res => setTimeout(() => {
      const sheet = document.querySelector('.sheet');
      const res1 = { role: sheet.getAttribute('role'), modal: sheet.getAttribute('aria-modal'),
        label: sheet.getAttribute('aria-label'), labelledby: sheet.getAttribute('aria-labelledby'),
        active: document.activeElement.tagName + '.' + document.activeElement.className };
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      setTimeout(() => res({ opened: res1, afterClose: document.activeElement.tagName + '.' + document.activeElement.className }), 250);
    }, 250));
  });
  console.log('8. DIALOG/FOCUS', JSON.stringify(dlg));

  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const rm = await p.evaluate(() => ({
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    transitionRules: [...document.styleSheets].flatMap(s => { try { return [...s.cssRules] } catch { return [] } })
      .filter(r => r.conditionText && /reduced-motion/.test(r.conditionText)).length,
    animatedProps: [...document.querySelectorAll('*')].filter(e => { const t = getComputedStyle(e).transitionDuration; return t && t !== '0s'; }).length
  }));
  console.log('9. REDUCED    ', JSON.stringify(rm));

  // 12. table clipping at 320
  await p.setViewport({ width: 320, height: 640 });
  await p.goto(URL, { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');
  const clip = await p.evaluate(() => {
    const w = document.querySelector('.table-wrap');
    return { wrapScrollW: w.scrollWidth, wrapClientW: w.clientWidth, overflowX: getComputedStyle(w).overflowX,
      docScrollW: document.documentElement.scrollWidth, docClientW: document.documentElement.clientWidth };
  });
  console.log('10. CLIP320   ', JSON.stringify(clip));

  await b.close();
})();
