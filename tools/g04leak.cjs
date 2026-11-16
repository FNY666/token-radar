// Counts the drawer's REAL registered listeners, via CDP, after N open/close cycles.
// If the backdrop listener is registered on every open, the count grows with N.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
const OUT = '/home/muse-newapi/makefun-token-radar/work/out';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file://' + path.join(OUT, 'dashboard', 'index.html'), { waitUntil: 'load' });
  const cdp = await page.target().createCDPSession();

  async function listenerCounts() {
    const { result } = await cdp.send('Runtime.evaluate', {
      expression: 'document.getElementById("drawer")',
    });
    const objId = result.objectId;
    const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: objId });
    const byType = {};
    for (const l of listeners) byType[l.type] = (byType[l.type] || 0) + 1;
    await cdp.send('Runtime.releaseObject', { objectId: objId });
    return byType;
  }

  const before = await listenerCounts();
  await page.evaluate(async () => {
    for (let i = 0; i < 5; i++) {
      document.querySelector('tbody tr.row').click();
      await new Promise((r) => setTimeout(r, 25));
      document.querySelector('#drawer .close').click();
      await new Promise((r) => setTimeout(r, 25));
    }
  });
  const after = await listenerCounts();

  const docRes = await cdp.send('Runtime.evaluate', { expression: 'document' });
  const docListeners = await cdp.send('DOMDebugger.getEventListeners', { objectId: docRes.result.objectId });
  const docCount = {};
  for (const l of docListeners.listeners) docCount[l.type] = (docCount[l.type] || 0) + 1;

  console.log(JSON.stringify({ before, after, doc: docCount }, null, 1));
  await browser.close();
})();
