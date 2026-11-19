// Render the OLD commit's dashboard and measure the rank-1 dot / label geometry the review quoted.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto('file:///tmp/oldbuild/index.html', { waitUntil: 'load' });
  await p.waitForSelector('tbody tr');
  const r = await p.evaluate(() => {
    const svg = document.querySelector('.plot svg');
    const q = svg.querySelector('text.q');
    const labelX = parseFloat(q.getAttribute('x')), labelY = parseFloat(q.getAttribute('y'));
    const tx = labelX - 9, ty = labelY - 3.5;
    let dot=null; for(const c of svg.querySelectorAll('circle')) if(Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01){dot=c;break;}
    const r0 = parseFloat(dot.getAttribute('r'));
    const e0 = q.getExtentOfChar(0);
    return { dot:{cx:+tx.toFixed(2), cy:+ty.toFixed(2), r:+r0.toFixed(3)},
      dotTop:+(ty-r0).toFixed(3), dotBot:+(ty+r0).toFixed(3),
      label:{x:+labelX.toFixed(2), y:+labelY.toFixed(2)},
      labelInk:{left:+e0.x.toFixed(2), top:+e0.y.toFixed(2), w:+e0.width.toFixed(2), h:+e0.height.toFixed(2)},
      discRight:+(tx+r0).toFixed(3),
      horizOverlap:+(tx+r0-(labelX+e0.x)).toFixed(3),
      clipped: (ty-r0)<0 };
  });
  console.log('OLD BUILD:', JSON.stringify(r,null,1));
  await b.close();
})();
