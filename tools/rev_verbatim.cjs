// The reviewer's three quoted bboxes, measured verbatim on the CURRENT build.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('file://' + path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'), { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');
  const r = await p.evaluate(() => {
    const svg = document.querySelector('.plot svg');
    const axisTitle = [...svg.querySelectorAll('text.axis-title')].find(t => t.textContent === 'Implied value');
    const q = svg.querySelector('text.q');
    const dot = svg.querySelector('circle.dot.wl');
    // the rank-1 dot = the .wl whose cx matches the label's anchor - 9
    const tx = parseFloat(q.getAttribute('x')) - 9;
    let top=null; for(const c of svg.querySelectorAll('circle.dot.wl')) if(Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01){top=c;break;}
    const bb = el => { const r = el.getBoundingClientRect(); return [ +r.left.toFixed(2), +r.top.toFixed(2), +r.width.toFixed(2), +r.height.toFixed(2) ]; };
    return {
      'Implied value axis-title bbox [l,t,w,h]': bb(axisTitle),
      'label bbox [l,t,w,h]': bb(q),
      'label user x,y': [parseFloat(q.getAttribute('x')), parseFloat(q.getAttribute('y'))],
      'rank-1 dot bbox [l,t,w,h]': bb(top),
      'rank-1 dot user cx,cy,r': [parseFloat(top.getAttribute('cx')), parseFloat(top.getAttribute('cy')), parseFloat(top.getAttribute('r'))]
    };
  });
  for (const [k,v] of Object.entries(r)) console.log(k, '->', JSON.stringify(v));
  console.log('\nREVIEWER QUOTED:');
  console.log("  'Implied value' axis-title bbox [8, 3.98, 74.5, 13.02]");
  console.log("  'Steakhouse Financial' q-label bbox [491.88, 3.48, 132.28, 13.02]");
  console.log("  rank-1 dot (circle.dot.wl) bbox [470.88, -2, 24, 24]");
  await b.close();
})();
