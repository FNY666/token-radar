// Verify README's dashboard bullet claims on the live page: the tabs, the "Already trading"
// table, the detail view's peer protocols, and the plot's click-to-detail.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const URL = 'file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html';
(async () => {
  const browser = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--force-device-scale-factor=1', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr');

  // tabs
  const tabs = await page.evaluate(() => [...document.querySelectorAll('[role=tab], .tab, button[data-tab]')].map((e) => e.textContent.trim()));
  console.log('tabs:', JSON.stringify(tabs));

  // board columns
  const heads = await page.evaluate(() => [...document.querySelectorAll('thead th')].map((e) => e.textContent.trim()));
  console.log('board headers:', JSON.stringify(heads));

  // "Already trading" table
  const live = await page.evaluate(() => {
    const t = [...document.querySelectorAll('table')].map((x) => x.id || x.className);
    return t;
  });
  console.log('tables:', JSON.stringify(live));

  // detail view: peer protocols of the same category
  await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('tbody tr.row'));
    (rows.find((r) => r.querySelector('.pname') && r.querySelector('.pname').textContent.indexOf('Gauntlet') !== -1) || rows[0]).click();
  });
  await page.waitForSelector('.sheet', { visible: true });
  await new Promise((r) => setTimeout(r, 400));
  const detail = await page.evaluate(() => {
    const d = document.querySelector('#drawer');
    const txt = d.innerText;
    return {
      hasPeers: /peer/i.test(txt),
      peersHeading: (txt.match(/[^\n]*[Pp]eer[^\n]*/g) || []).slice(0, 4),
      peerLinks: d.querySelectorAll('a, button.row-link, .peer').length,
      sections: [...d.querySelectorAll('.sect-title, .sec, h4, .drawer-sec')].map((e) => e.textContent.trim()).slice(0, 12),
      steps: d.querySelectorAll('.steps li').length,
      hasArithmetic: /Fitted log10/.test(txt),
      hasSnapshot: /snapshot record it read/i.test(txt),
      liveTabRows: null,
    };
  });
  console.log('detail:', JSON.stringify(detail, null, 1));

  // plot dot click -> detail
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 200));
  const dots = await page.evaluate(() => document.querySelectorAll('#plot-wrap svg circle').length);
  console.log('plot circles:', dots);
  await browser.close();
})();
