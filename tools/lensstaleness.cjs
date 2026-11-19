// For each stored screenshot, render the SAME view from the CURRENT build and from the commit
// that last touched the screenshot (3f202b4), and report which one the stored file matches.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const CUR = 'file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html';
const OLD = 'file:///tmp/oldsrc/out/dashboard/index.html';

async function shoot(browser, url, kind, out) {
  const page = await browser.newPage();
  const h = kind === 'detail' ? 1220 : 1440;
  await page.setViewport({ width: 1440, height: h, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  if (kind === 'detail') {
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr.row'));
      const t = rows.find((r) => r.querySelector('.pname') && r.querySelector('.pname').textContent.indexOf('Gauntlet') !== -1) || rows[0];
      t.click();
    });
    await page.waitForSelector('.sheet', { visible: true });
  } else if (kind === 'filtered') {
    await page.evaluate(() => {
      const cat = document.querySelectorAll('.controls select')[0];
      for (const o of cat.options) if (o.value === 'Risk Curators') { cat.value = 'Risk Curators'; break; }
      cat.dispatchEvent(new Event('change'));
      const chain = document.querySelectorAll('.controls select')[1];
      for (const o of chain.options) if (o.value === 'Ethereum') { chain.value = 'Ethereum'; break; }
      chain.dispatchEvent(new Event('change'));
      const s = document.querySelector('input[type=search]'); s.value = 'a'; s.dispatchEvent(new Event('input'));
      const headers = Array.from(document.querySelectorAll('thead th button'));
      const tvl = headers.find((x) => x.textContent.indexOf('TVL') === 0); if (tvl) tvl.click();
    });
  }
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: out });
  await page.close();
}
function diff(a, b) {
  const r = execFileSync(process.execPath, ['/home/muse-newapi/makefun-token-radar/work/tools/pngdiff.cjs', a, b]).toString();
  const bands = r.split('\n').filter((l) => /mean abs channel diff/.test(l)).map((l) => parseFloat(l.split(/diff\s+/)[1].trim()));
  return bands.reduce((a, b) => a + b, 0);
}
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  for (const [kind, file] of [['board', '1-board.png'], ['detail', '2-detail.png'], ['filtered', '3-filtered.png']]) {
    const stored = '/home/muse-newapi/makefun-token-radar/work/screenshots/' + file;
    await shoot(browser, CUR, kind, `/tmp/st-cur-${kind}.png`);
    await shoot(browser, OLD, kind, `/tmp/st-old-${kind}.png`);
    console.log(file.padEnd(18), 'sum-band-diff vs CURRENT build:', diff(stored, `/tmp/st-cur-${kind}.png`).toFixed(2),
      ' vs 3f202b4 build:', diff(stored, `/tmp/st-old-${kind}.png`).toFixed(2));
  }
  await browser.close();
})();
