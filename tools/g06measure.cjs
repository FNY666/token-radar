// G06's claims, measured against the CURRENT tree (after the H1 pass), not its own.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
const OUT = '/home/muse-newapi/makefun-token-radar/work/out';

// WCAG relative luminance and contrast.
function srgb(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * srgb((n >> 16) & 255) + 0.7152 * srgb((n >> 8) & 255) + 0.0722 * srgb(n & 255);
}
function ratio(a, b) { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return (hi + 0.05) / (lo + 0.05); }
function over(fg, alpha, bg) {
  const f = parseInt(fg.slice(1), 16), b = parseInt(bg.slice(1), 16);
  const mix = (sh) => Math.round(f * alpha + b * (1 - alpha));
  const r = mix((f >> 16) & 255), g = mix((f >> 8) & 255), bl = mix(f & 255);
  return '#' + [r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('');
}

const PALETTE = {
  ink: '#e8edf4', 'ink-2': '#a8b6c8', 'ink-3': '#8493a8',
  bg: '#0b0f16', 'bg-2': '#111826', panel: '#151d2c', 'panel-2': '#1b2536',
  line: '#24304a', 'line-2': '#33425f',
  value: '#f2b544', odds: '#49c6e8', live: '#e06c9a', up: '#5fd0a0', down: '#e07a7a',
};

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + path.join(OUT, 'dashboard', 'index.html'), { waitUntil: 'load' });
  await page.waitForSelector('tbody tr');

  // --- 1. does the table header actually stick? ---
  const stick = await page.evaluate(() => {
    const th = document.querySelector('thead th');
    const wrap = document.querySelector('.table-wrap');
    const bar = document.querySelector('.bar');
    const at = (y) => {
      window.scrollTo(0, y);
      const r = th.getBoundingClientRect();
      return { thTop: Math.round(r.top), thBottom: Math.round(r.bottom), scrollY: Math.round(window.scrollY) };
    };
    const before = at(0);
    const after = at(2000);
    return {
      barHeight: Math.round(bar.getBoundingClientRect().height),
      wrapOverflow: getComputedStyle(wrap).overflow,
      thPosition: getComputedStyle(th).position,
      thTopOffset: getComputedStyle(th).top,
      atTop: before,
      atScroll2000: after,
      sticks: after.thTop >= 0 && after.thTop < after.scrollY,
    };
  });

  // --- 2. the implied value's visual weight vs the protocol name ---
  const hierarchy = await page.evaluate(() => {
    const row = document.querySelector('tbody tr.row');
    const name = row.querySelector('.pname');
    const val = row.querySelector('.val');
    const cs = (n) => { const s = getComputedStyle(n); return { size: s.fontSize, weight: s.fontWeight, color: s.color }; };
    return { name: cs(name), value: cs(val) };
  });

  // --- 3. reduced motion honoured? ---
  const rm = await page.evaluate(() => {
    const out = [];
    for (const sheet of document.styleSheets) {
      let rules; try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const r of rules) if (r.conditionText && r.conditionText.includes('prefers-reduced-motion')) out.push(r.cssText.slice(0, 120));
    }
    return { reducedMotionRules: out, transitionsOnButtons: getComputedStyle(document.querySelector('.tab')).transitionProperty };
  });

  // --- 4. focus ring on a row ---
  const focus = await page.evaluate(() => {
    const row = document.querySelector('tbody tr.row');
    row.focus();
    const s = getComputedStyle(row);
    return { outlineWidth: s.outlineWidth, outlineStyle: s.outlineStyle, tabindex: row.getAttribute('tabindex') };
  });

  console.log(JSON.stringify({ stick, hierarchy, rm, focus }, null, 1));

  // --- 5. CONTRAST, computed here (not in the page) ---
  console.log('\n=== CONTRAST ===');
  const checks = [
    ['thead th text (ink-2) on panel-2', PALETTE['ink-2'], PALETTE['panel-2'], 4.5],
    ['muted text (ink-3) on panel', PALETTE['ink-3'], PALETTE.panel, 4.5],
    ['muted text (ink-3) on bg', PALETTE['ink-3'], PALETTE.bg, 4.5],
    ['muted text (ink-3) on panel-2', PALETTE['ink-3'], PALETTE['panel-2'], 4.5],
    ['body text (ink) on bg', PALETTE.ink, PALETTE.bg, 4.5],
    ['secondary (ink-2) on bg', PALETTE['ink-2'], PALETTE.bg, 4.5],
    ['amber (value) on panel', PALETTE.value, PALETTE.panel, 4.5],
    ['cyan (odds) on panel', PALETTE.odds, PALETTE.panel, 4.5],
    ['rose (live) on panel', PALETTE.live, PALETTE.panel, 4.5],
    ['green (up) on panel', PALETTE.up, PALETTE.panel, 4.5],
    ['red (down) on panel', PALETTE.down, PALETTE.panel, 4.5],
    ['pill cyan text on odds-12 over panel', PALETTE.odds, over(PALETTE.odds, 0.12, PALETTE.panel), 4.5],
    ['pill rose text on live-13 over panel', PALETTE.live, over(PALETTE.live, 0.13, PALETTE.panel), 4.5],
    ['tag wl amber on value-45 over panel', PALETTE.value, over(PALETTE.value, 0.45, PALETTE.panel), 4.5],
    ['line (border) on panel', PALETTE.line, PALETTE.panel, 3.0],
    ['line-2 on panel', PALETTE['line-2'], PALETTE.panel, 3.0],
  ];
  let fails = 0;
  for (const [label, fg, bg, min] of checks) {
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) fails++;
    console.log((ok ? 'PASS ' : 'FAIL ') + r.toFixed(2).padStart(6) + ':1  (min ' + min + ')  ' + label + '  ' + fg + ' on ' + bg);
  }
  console.log(fails === 0 ? '\nALL CONTRAST CHECKS PASS' : '\n' + fails + ' CONTRAST CHECK(S) FAIL');

  await browser.close();
})();
