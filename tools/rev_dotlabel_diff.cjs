// Differential render: screenshot the plot region WITH and WITHOUT the label.
// Any pixel difference inside the dot's disc = the label paints over the dot.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 4 });
  await p.goto('file://' + path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'), { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');
  const geo = await p.evaluate(() => {
    const svg = document.querySelector('.plot svg');
    const q = svg.querySelector('text.q');
    const labelX = parseFloat(q.getAttribute('x')), labelY = parseFloat(q.getAttribute('y'));
    const tx = labelX - 9, ty = labelY - 3.5;
    let dot=null; for(const c of svg.querySelectorAll('circle.dot')) if(Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01){dot=c;break;}
    const dr = dot.getBoundingClientRect();
    const sb = svg.getBoundingClientRect();
    window.__dot = { cx:tx, cy:ty, r:parseFloat(dot.getAttribute('r')) };
    // mark the dot's disc geometry in CSS px relative to the svg box
    const sc = sb.width/svg.viewBox.baseVal.width;
    return { sc, dotUser: window.__dot, svgLeft: sb.left, svgTop: sb.top,
      dotCss: { cx: sb.left+tx*sc, cy: sb.top+ty*sc, r: parseFloat(dot.getAttribute('r'))*sc },
      clip: { x: sb.left+tx*sc-20, y: sb.top+ty*sc-20, width: 90, height: 45 } };
  });
  await p.screenshot({ path: '/tmp/rev_with.png', clip: geo.clip });
  await p.evaluate(() => { const q = document.querySelector('.plot svg text.q'); q.style.display='none'; });
  await p.screenshot({ path: '/tmp/rev_without.png', clip: geo.clip });
  console.log(JSON.stringify(geo));
  await b.close();
})();
