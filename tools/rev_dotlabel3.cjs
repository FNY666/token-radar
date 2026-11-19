// Pixel-level: does the label's INK overlap the rank-1 dot's painted disc?
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 4 });
  await p.goto('file://' + path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'), { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');
  const info = await p.evaluate(() => {
    const svg = document.querySelector('.plot svg');
    const q = svg.querySelector('text.q');
    const labelX = parseFloat(q.getAttribute('x')), labelY = parseFloat(q.getAttribute('y'));
    const dx = 9;
    const tx = labelX - dx, ty = labelY - 3.5;
    let dot=null;
    for (const c of svg.querySelectorAll('circle.dot')) {
      if (Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01) { dot=c; break; }
    }
    const cs = getComputedStyle(dot);
    const qcs = getComputedStyle(q);
    const svgBox = svg.getBoundingClientRect();
    const scale = svgBox.width/svg.viewBox.baseVal.width;
    // screen rect of the dot and of the label
    const dotRect = dot.getBoundingClientRect();
    const qRect = q.getBoundingClientRect();
    return { dotFill: cs.fill, dotStroke: cs.stroke, dotStrokeW: cs.strokeWidth, labelFill: qcs.fill,
      dotRect: {l:dotRect.left,t:dotRect.top,r:dotRect.right,b:dotRect.bottom,w:dotRect.width,h:dotRect.height},
      qRect: {l:qRect.left,t:qRect.top,r:qRect.right,b:qRect.bottom},
      scale, dpr: window.devicePixelRatio };
  });
  console.log(JSON.stringify(info,null,1));

  // crop the region around dot+label
  const clip = { x: info.dotRect.l - 6, y: info.dotRect.t - 10, width: (info.qRect.l + 60) - (info.dotRect.l - 6), height: (info.dotRect.b + 10) - (info.dotRect.t - 10) };
  await p.screenshot({ path: '/tmp/rev_dotlabel.png', clip });
  console.log('clip', JSON.stringify(clip));
  await b.close();
})();
