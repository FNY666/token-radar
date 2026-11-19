// Clean test: hide every circle except the rank-1 amber dot; measure the disc's painted edge
// at the label's ink rows, and measure the label's true first-ink column via canvas metrics.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 4 });
  await p.goto('file://' + path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'), { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');
  const r = await p.evaluate(() => {
    const svg = document.querySelector('.plot svg');
    const q = svg.querySelector('text.q');
    const labelX = parseFloat(q.getAttribute('x')), labelY = parseFloat(q.getAttribute('y'));
    const tx = labelX - 9, ty = labelY - 3.5;
    const circles = [...svg.querySelectorAll('circle')];
    let target=null;
    for (const c of circles) if (Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01) { target=c; break; }
    // hide every other circle and all other text, keep only the target dot and the label
    circles.forEach(c => { if (c !== target) c.style.display='none'; });
    const others = [...svg.querySelectorAll('text')].filter(t=>t!==q); others.forEach(t=>t.style.display='none');
    const tr = target.getBoundingClientRect();
    const qr = q.getBoundingClientRect();
    // canvas metrics for the label's true ink box
    const cvs = document.createElement('canvas'); const ctx = cvs.getContext('2d');
    const cs = getComputedStyle(q);
    ctx.font = cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
    const m = ctx.measureText(q.textContent);
    const inkLeft = labelX + (m.actualBoundingBoxLeft ? -m.actualBoundingBoxLeft : 0);
    return { labelX, labelY, tx, ty, targetR: parseFloat(target.getAttribute('r')),
      discRight: tx + parseFloat(target.getAttribute('r')),
      discRightAtLabelBaseline: tx + Math.sqrt(Math.pow(parseFloat(target.getAttribute('r')),2) - Math.pow(ty-(labelY-3.5),2)),
      inkLeftUser: inkLeft, bboxLeftUser: m.actualBoundingBoxLeft,
      textRect: {l:qr.left, r:qr.right, t:qr.top, b:qr.bottom},
      discRect: {l:tr.left, r:tr.right, t:tr.top, b:tr.bottom} };
  });
  console.log(JSON.stringify(r,null,1));
  // screenshot the isolated pair
  const pad=10;
  await p.screenshot({ path: '/tmp/rev_iso.png', clip: { x: r.discRect.l-pad, y: r.discRect.t-pad, width: 60, height: (r.discRect.b-r.discRect.t)+2*pad } });
  await b.close();
})();
