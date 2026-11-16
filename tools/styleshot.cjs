// Snapshots every element's computed style on every page of the dashboard, so a CSS change can be
// proved not to have changed a single rendered pixel's worth of style.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
const fs = require('node:fs');
const OUT = '/home/muse-newapi/makefun-token-radar/work/out';

const PROPS = [
  'color', 'background-color', 'font-size', 'font-weight', 'font-family', 'line-height',
  'letter-spacing', 'text-align', 'text-transform', 'text-wrap', 'white-space',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-style', 'border-bottom-style',
  'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius',
  'border-bottom-right-radius', 'display', 'position', 'top', 'left', 'z-index',
  'flex-direction', 'align-items', 'justify-content', 'gap', 'grid-template-columns',
  'opacity', 'overflow-x', 'overflow-y', 'text-decoration-line', 'cursor', 'visibility',
  'box-shadow', 'text-overflow', 'max-width', 'min-width', 'width', 'height', 'transform',
];

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const views = [
    ['board', ''],
    ['live', '#view=live'],
    ['model', '#view=model'],
  ];
  const out = {};
  for (const [name, hash] of views) {
    await page.goto('file://' + path.join(OUT, 'dashboard', 'index.html') + hash, { waitUntil: 'load' });
    await new Promise((r) => setTimeout(r, 150));
    if (name === 'board') {
      await page.waitForSelector('tbody tr');
      // open the drawer too
      await page.evaluate(() => document.querySelector('tbody tr.row').click());
      await page.waitForSelector('.sheet');
      await new Promise((r) => setTimeout(r, 120));
    }
    out[name] = await page.evaluate((props) => {
      const seen = new Map();
      let i = 0;
      const walk = (node, path) => {
        if (node.nodeType !== 1) return;
        const r = node.getBoundingClientRect();
        const s = getComputedStyle(node);
        const style = {};
        for (const p of props) style[p] = s[p];
        seen.set(path + '#' + i, { tag: node.tagName, cls: node.className && String(node.className), style });
        i++;
        for (const c of node.children) walk(c, path + '/' + c.tagName);
      };
      walk(document.body, 'body');
      return Array.from(seen.entries());
    }, PROPS);
  }
  await browser.close();
  fs.writeFileSync(process.argv[2] || '/tmp/style-before.json', JSON.stringify(out, null, 0));
  const counts = Object.entries(out).map(([k, v]) => k + '=' + v.length);
  console.log('snapshot written:', counts.join(' '));
})();
