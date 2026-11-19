const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  p.on('console', m=>console.log('PAGE:', m.text().slice(0,200)));
  p.on('pageerror', e=>console.log('ERR:', String(e).slice(0,300)));
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('file:///tmp/oldbuild/index.html', { waitUntil: 'load' });
  await new Promise(r=>setTimeout(r,1500));
  const r = await p.evaluate(() => {
    const svgs=[...document.querySelectorAll('svg')];
    return { svgCount: svgs.length,
      plotSvg: !!document.querySelector('.plot svg'),
      qCount: document.querySelectorAll('text.q').length,
      circleCount: document.querySelectorAll('circle').length,
      rows: document.querySelectorAll('tbody tr').length,
      globals: Object.keys(window).filter(k=>/RADAR|DATA|BOARD/i.test(k)).slice(0,10) };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
