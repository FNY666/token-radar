// The copy says "4 of the board's 195 rows sit on the clamp and the formula reads the clamped
// figure", and MODEL.md says "the board carries each row's own fitted working so the arithmetic can
// be checked row by row". Check the DETAIL view for a clamped row: does it show the raw week or the
// clamped one? And does the shown value let a reader reproduce the fitted term?
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
  for (const slug of ['Shift DeFi', 'NUVA', 'Anemoy Capital', 'Monolith Market', 'Gauntlet']) {
    await page.evaluate((s) => {
      const rows = Array.from(document.querySelectorAll('tbody tr.row'));
      const want = s.toLowerCase();
      const t = rows.find((r) => {
        const n = r.querySelector('.pname') ? r.querySelector('.pname').textContent.toLowerCase() : '';
        return n === want;
      });
      if (t) t.click();
    }, slug);
    await page.waitForSelector('.sheet', { visible: true });
    await new Promise((r) => setTimeout(r, 300));
    const info = await page.evaluate(() => {
      const d = document.querySelector('#drawer');
      const lines = d.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
      const i = lines.findIndex((l) => /Seven-day TVL change/.test(l));
      const j = lines.findIndex((l) => /Fitted log10/.test(l));
      return { growth: i >= 0 ? lines.slice(i, i + 2) : null, fitted: j >= 0 ? lines.slice(j, j + 4) : null };
    });
    console.log(slug, JSON.stringify(info));
    await page.evaluate(() => { const c = document.querySelector('.drawer .close'); if (c) c.click(); });
    await new Promise((r) => setTimeout(r, 250));
  }
  await browser.close();
})();
