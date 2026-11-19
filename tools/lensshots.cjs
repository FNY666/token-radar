// Re-render the CURRENT page the way the three stored screenshots were framed, and compare
// the visible text with what the stored screenshots show, so a stale shot is detected.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const fs = require('node:fs');
const URL = 'file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('tbody tr');
  await new Promise((r) => setTimeout(r, 600));
  const out = {};
  out.boardText = await page.evaluate(() => {
    const lines = document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    return lines.slice(0, 60);
  });
  // the first table row of the board
  out.firstRows = await page.$$eval('tbody tr', (rs) => rs.slice(0, 5).map((r) => [...r.children].map((c) => c.innerText.trim().replace(/\s+/g, ' '))));
  // the header bar meta
  out.barMeta = await page.$eval('#bar-meta', (e) => e.innerText.replace(/\n/g, ' | '));
  // hero
  out.hero = await page.$eval('#hero', (e) => e.innerText.replace(/\n/g, ' | ').slice(0, 1200));
  await page.screenshot({ path: '/tmp/current-board.png', fullPage: false });
  await browser.close();
  console.log(JSON.stringify(out, null, 1));
})();
