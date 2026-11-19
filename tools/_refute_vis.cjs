const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const p = await b.newPage();
  await p.setViewport({width:1440,height:1440});
  await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
  await p.waitForSelector('tbody tr');
  const r = await p.evaluate(() => {
    const clamped = ['Shift DeFi','NUVA','Anemoy Capital','Monolith Market'];
    const res = {};
    for (const n of clamped) {
      const tr = Array.from(document.querySelectorAll('tbody tr.row')).find(t => { const e=t.querySelector('.pname'); return e && e.textContent.trim()===n; });
      res[n] = tr ? { top: Math.round(tr.getBoundingClientRect().top), visible: tr.getBoundingClientRect().top < 1440 && tr.getBoundingClientRect().bottom > 0, cells: Array.from(tr.children).map(c=>c.textContent.trim()) } : null;
    }
    return res;
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
