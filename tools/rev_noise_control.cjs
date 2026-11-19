// CONTROL: two screenshots with NO change must equal the with/without diff, if that diff is noise.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 8 });
  await p.goto('file://' + path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'), { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');
  const geo = await p.evaluate(() => {
    const svg = document.querySelector('.plot svg');
    const q = svg.querySelector('text.q');
    const labelX = parseFloat(q.getAttribute('x')), labelY = parseFloat(q.getAttribute('y'));
    const tx = labelX - 9, ty = labelY - 3.5;
    let target=null;
    for (const c of svg.querySelectorAll('circle')) if (Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01) { target=c; break; }
    [...svg.querySelectorAll('circle')].forEach(c=>{ if(c!==target) c.style.display='none'; });
    [...svg.querySelectorAll('text')].forEach(t=>{ if(t!==q) t.style.display='none'; });
    const tr = target.getBoundingClientRect();
    return { rect: { l:tr.left, t:tr.top, r:tr.right, b:tr.bottom } };
  });
  const pad=6;
  const clip = { x: geo.rect.l-pad, y: geo.rect.t-pad, width: 34, height: (geo.rect.b-geo.rect.t)+2*pad };
  await p.screenshot({ path: '/tmp/ctl_a.png', clip });
  await p.screenshot({ path: '/tmp/ctl_b.png', clip });   // identical state
  await p.evaluate(() => { document.querySelector('.plot svg text.q').style.display='none'; });
  await p.screenshot({ path: '/tmp/ctl_c.png', clip });
  console.log('clip', JSON.stringify(clip));
  await b.close();
})();
