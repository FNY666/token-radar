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
    const names = Array.from(document.querySelectorAll('tbody tr.row .pname')).map(e=>e.textContent.trim());
    return { count: names.length, names: names.slice(0,40) };
  });
  console.log('rows visible in the board viewport:', r.count);
  console.log(r.names.join(', '));
  await b.close();
})();
