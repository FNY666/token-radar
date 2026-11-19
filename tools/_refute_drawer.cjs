const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
  await page.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html', { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  for (const slug of ['Shift DeFi', 'NUVA', 'Anemoy Capital']) {
    await page.evaluate((s) => {
      const rows = Array.from(document.querySelectorAll('tbody tr.row'));
      const want = s.toLowerCase();
      const t = rows.find((r) => { const n = r.querySelector('.pname'); return n && n.textContent.trim().toLowerCase() === want; });
      if (t) t.click();
    }, slug);
    await page.waitForSelector('.sheet', { visible: true });
    await new Promise((r) => setTimeout(r, 300));
    const info = await page.evaluate(() => {
      const d = document.querySelector('#drawer');
      const lines = d.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
      const h4s = Array.from(d.querySelectorAll('h4')).map((h) => h.textContent.trim());
      return { h4s, lines };
    });
    console.log('=== ' + slug);
    console.log('HEADINGS:', JSON.stringify(info.h4s));
    console.log(info.lines.join('\n'));
    await page.evaluate(() => { const c = document.querySelector('.drawer .close'); if (c) c.click(); });
    await new Promise((r) => setTimeout(r, 250));
  }
  await browser.close();
})();
