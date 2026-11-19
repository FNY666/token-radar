// DECISIVE: (1) is the rank-1 dot ever clipped in the current build, at any width?
//           (2) exactly how many CSS px of label ink lie over the dot's disc?
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
      let dot=null; for(const c of svg.querySelectorAll('circle')) if(Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01){dot=c;break;}
      const r0 = parseFloat(dot.getAttribute('r'));
      const e0 = q.getExtentOfChar(0);
      // clip check: the topmost point of ANY dot vs the svg's top edge
      let minTop = 1e9;
      for (const c of svg.querySelectorAll('circle.dot')) {
        const t = parseFloat(c.getAttribute('cy')) - parseFloat(c.getAttribute('r'));
        if (t < minTop) minTop = t;
      }
      // the disc's right edge AT THE GLYPH'S INK ROWS
      const rows = [];
      for (let gy = e0.y; gy <= e0.y + e0.height; gy += 1) {
        const dy = gy - ty;
        const chord = dy*dy < r0*r0 ? Math.sqrt(r0*r0 - dy*dy) : 0;
        rows.push({ gy:+gy.toFixed(2), discRight:+(tx+chord).toFixed(2) });
      }
      // the widest intrusion = smallest (discRight - inkLeft)
      const inkLeft = labelX + e0.x;
      let worst = 1e9, worstRow = null;
      for (const r2 of rows) { const intr = r2.discRight - inkLeft; if (intr < worst) { worst = intr; worstRow = r2; } }
      return {
        width: innerWidth, svgH: svg.viewBox.baseVal.height,
        dotCentreY: +ty.toFixed(3), dotRadius: +r0.toFixed(3),
        dotVerticalSpan: [+(ty-r0).toFixed(3), +(ty+r0).toFixed(3)],
        DOT_CLIPPED_BY_SVG_TOP: (ty - r0) < 0,
        topmostAnyDot: +minTop.toFixed(3),
        labelBaselineY: +labelY.toFixed(3),
        labelInkTop: +e0.y.toFixed(3), labelInkBottom: +(e0.y+e0.height).toFixed(3),
        LABEL_ABOVE_DISC_TOP: e0.y < (ty - r0),
        maxInkOverDiscUnits: +worst.toFixed(3), atRow: worstRow,
        overlapFractionOfGlyphWidth: +(worst / e0.width).toFixed(3)
      };
    });
    console.log(JSON.stringify(r));
  }
  await b.close();
})();
