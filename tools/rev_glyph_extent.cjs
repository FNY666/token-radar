// Exact glyph ink extents via SVG getExtentOfChar / getStartPositionOfChar.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
(async () => {
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  for (const w of [1440, 1200, 1024, 900, 768]) {
    await p.setViewport({ width: w, height: 900 });
    await p.goto('file://' + path.join('/home/muse-newapi/makefun-token-radar/work/out','dashboard','index.html'), { waitUntil: 'load' });
    await p.waitForSelector('tbody tr');
    const r = await p.evaluate(() => {
      const svg = document.querySelector('.plot svg');
      const q = svg.querySelector('text.q');
      const labelX = parseFloat(q.getAttribute('x')), labelY = parseFloat(q.getAttribute('y'));
      const tx = labelX - 9, ty = labelY - 3.5;
      let target=null;
      for (const c of svg.querySelectorAll('circle')) if (Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01) { target=c; break; }
      const r0 = parseFloat(target.getAttribute('r'));
      const e0 = q.getExtentOfChar(0);                 // exact ink box of the FIRST glyph
      const sp0 = q.getStartPositionOfChar(0);
      const eAll = q.getBBox();
      const inkLeft = labelX + e0.x;
      const inkRight = labelX + e0.x + e0.width;
      // overlap between the first glyph's ink and the disc, accounting for the CIRCLE not the box
      const dy = (e0.y + e0.height/2) - ty;            // glyph mid vs dot centre
      const chordHalf = Math.sqrt(Math.max(r0*r0 - dy*dy, 0));
      const discRightAtGlyphMid = tx + chordHalf;
      return {
        text: q.textContent, anchor: q.getAttribute('text-anchor'),
        labelX, labelY, dot: { cx: tx, cy: ty, r: r0 },
        firstGlyphInkBox: { x:+e0.x.toFixed(3), y:+e0.y.toFixed(3), w:+e0.width.toFixed(3), h:+e0.height.toFixed(3) },
        firstGlyphInkLeftAbs: +inkLeft.toFixed(3),
        firstGlyphInkRightAbs: +inkRight.toFixed(3),
        allInkBox: { x:+eAll.x.toFixed(3), y:+eAll.y.toFixed(3), w:+eAll.width.toFixed(3), h:+eAll.height.toFixed(3) },
        discRightAtGlyphMid: +discRightAtGlyphMid.toFixed(3),
        glyphMidY: +(e0.y + e0.height/2).toFixed(3),
        OVERLAP_units: +(discRightAtGlyphMid - inkLeft).toFixed(3),
        discTop: +(ty-r0).toFixed(3), discBot: +(ty+r0).toFixed(3)
      };
    });
    console.log(w, JSON.stringify(r));
  }
  await b.close();
})();
