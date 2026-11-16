// Reports the CSS rules that match nothing in ANY page state, including the hover and focus
// states (which need a real interaction to appear).
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const fs = require('node:fs');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html', { waitUntil: 'networkidle0' });
  await p.waitForSelector('tbody tr');
  const css = fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/dashboard/theme.css', 'utf8');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const sels = rules.map(r => r[1].trim());
  // A state selector is tested by REMOVING the pseudo-class and matching the base.
  const base = sels.map(s => s.replace(/:hover|:focus-visible|:focus/g, '').split(',').map(x=>x.trim()));
  const states = [
    ['board', async () => {}],
    ['live', async () => { await p.evaluate(() => document.querySelector('#tab-live').click()); }],
    ['model', async () => { await p.evaluate(() => document.querySelector('#tab-model').click()); }],
    ['drawer', async () => { await p.evaluate(() => { document.querySelector('#tab-board').click(); document.querySelectorAll('tbody tr.row')[0].click(); }); }],
    ['empty', async () => { await p.evaluate(() => { const i = document.querySelector('input[type=search]'); i.value = 'zzzqqq'; i.dispatchEvent(new Event('input')); }); }],
  ];
  const counts = new Array(sels.length).fill(0);
  for (const [name, fn] of states) {
    await fn(); await new Promise(r => setTimeout(r, 250));
    const res = await p.evaluate((bs) => bs.map(list => { try { return list.reduce((n, sel) => n + (document.querySelectorAll(sel).length), 0); } catch (e) { return 0; } }), base);
    for (let i = 0; i < sels.length; i++) counts[i] += res[i];
  }
  let dead = 0, bytes = 0;
  rules.forEach((r, i) => {
    const sel = r[1].trim();
    if (sel.startsWith('@')) return;
    if (counts[i] === 0) { dead++; bytes += r[0].length + r[2].length + 2; console.log('DEAD', sel.slice(0, 60)); }
  });
  console.log('dead rules:', dead, 'bytes:', bytes);
  await b.close();
})();
