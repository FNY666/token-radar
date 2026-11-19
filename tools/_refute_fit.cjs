const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const p = await b.newPage();
  await p.setViewport({width:1440,height:1200});
  await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
  await p.waitForSelector('tbody tr');
  const r = await p.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#view-model .card')).map(c=>c.innerText).filter(t=>/Refitted|formula/i.test(t));
    // find the formula card
    const fc = Array.from(document.querySelectorAll('#view-model .card')).find(c=>/growth = clamp/.test(c.innerText));
    return { cards, formula: fc?fc.innerText:null };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
