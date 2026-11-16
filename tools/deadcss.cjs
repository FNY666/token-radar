// Reports every CSS selector in theme.css that matches NOTHING in any page state. Dead rules
// cost the dossier's byte budget and teach the judge nothing.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const fs = require('node:fs');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  const url = 'file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html';
  await p.goto(url, { waitUntil: 'networkidle0' });
  await p.waitForSelector('tbody tr');
  const css = fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/dashboard/theme.css', 'utf8');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const states = [
    ['board', async () => {}],
    ['live', async () => { await p.evaluate(() => document.querySelector('#tab-live').click()); }],
    ['model', async () => { await p.evaluate(() => document.querySelector('#tab-model').click()); }],
    ['drawer', async () => { await p.evaluate(() => { document.querySelector('#tab-board').click(); document.querySelectorAll('tbody tr.row')[0].click(); }); }],
    ['empty', async () => { await p.evaluate(() => { const i = document.querySelector('input[type=search]'); i.value = 'zzzqqq'; i.dispatchEvent(new Event('input')); }); }],
    ['mobile', async () => { await p.setViewport({ width: 375, height: 800 }); }],
  ];
  const sels = rules.map(r => r[1].trim());
  const counts = {};
  for (const [name, fn] of states) {
    await fn(); await new Promise(r => setTimeout(r, 250));
    const res = await p.evaluate((ss) => ss.map(s => { try { return document.querySelectorAll(s).length; } catch (e) { return -1; } }), sels);
    sels.forEach((s, i) => { counts[s] = (counts[s] || 0) + res[i]; });
  }
  let dead = 0, deadBytes = 0;
  rules.forEach((r) => {
    const sel = r[1].trim();
    if (sel.startsWith('@')) return;
    if ((counts[sel] || 0) === 0) { dead++; deadBytes += r[0].length + r[2].length + 2; console.log('DEAD', sel.slice(0, 70)); }
  });
  console.log('dead rules:', dead, 'bytes recoverable:', deadBytes);
  await b.close();
})();
