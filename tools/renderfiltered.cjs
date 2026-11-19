// Render a built dashboard's FILTERED view exactly the way tools/shootscreens.cjs frames
// screenshots/3-filtered.png: category "Risk Curators" + chain "Ethereum" + search "a", then
// click the TVL sort header.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const url = process.argv[2];
const out = process.argv[3];
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--force-device-scale-factor=1', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');
  await page.evaluate(() => {
    const cat = document.querySelectorAll('.controls select')[0];
    for (const o of cat.options) if (o.value === 'Risk Curators') { cat.value = 'Risk Curators'; break; }
    cat.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => {
    const chain = document.querySelectorAll('.controls select')[1];
    for (const o of chain.options) if (o.value === 'Ethereum') { chain.value = 'Ethereum'; break; }
    chain.dispatchEvent(new Event('change'));
  });
  await page.evaluate(() => {
    const search = document.querySelector('input[type=search]');
    search.value = 'a';
    search.dispatchEvent(new Event('input'));
  });
  await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll('thead th button'));
    const tvl = headers.find((h) => h.textContent.indexOf('TVL') === 0);
    if (tvl) tvl.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: out });
  const rows = await page.$$eval('tbody tr', (rs) => rs.map((r) => [...r.children].map((c) => c.innerText.trim().replace(/\s+/g, ' '))));
  const cc = await page.$eval('#controls', (e) => e.innerText.replace(/\n/g, ' | '));
  console.log('rows:', rows.length);
  console.log('first 3:', JSON.stringify(rows.slice(0, 3)));
  console.log('controls:', cc.slice(0, 400));
  await browser.close();
})();
