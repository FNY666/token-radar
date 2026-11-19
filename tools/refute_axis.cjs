const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = '/home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html';
const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, args:['--no-sandbox','--allow-file-access-from-files'] });
  for (const width of [1440, 1024, 390]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    await page.goto('file://' + path, { waitUntil: 'networkidle0' });
    await new Promise(r=>setTimeout(r,400));
    const res = await page.evaluate(() => {
      const svg = document.querySelector('.plot svg');
      if (!svg) return { err: 'no svg' };
      const texts = Array.from(svg.querySelectorAll('text'));
      const info = texts.map(t => {
        const b = t.getBBox();
        const cs = getComputedStyle(t);
        return { txt: t.textContent, cls: t.getAttribute('class'), x:+b.x.toFixed(2), y:+b.y.toFixed(2), w:+b.width.toFixed(2), h:+b.height.toFixed(2), fs: cs.fontSize, ff: cs.fontFamily };
      });
      const box = t => { const b = t.getBBox(); return {x:b.x,y:b.y,w:b.width,h:b.height}; };
      const title = texts.find(t=>t.textContent==='Implied value');
      const tb = box(title);
      // ink overlap via canvas
      function inkMask(t, scale) {
        const b = t.getBBox();
        const W = Math.ceil(b.width)+4, H = Math.ceil(b.height)+4;
        const c = document.createElement('canvas');
        c.width = W*scale; c.height = H*scale;
        const g = c.getContext('2d');
        g.scale(scale,scale);
        const cs = getComputedStyle(t);
        g.font = cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
        g.textBaseline = 'alphabetic';
        g.textAlign = 'start';
        g.fillStyle='#000';
        // position text so its baseline matches bbox: bbox.y is top of ink for most; use baseline = b.y + ascent
        const bb = t.getBBox();
        const asc = bb.y - (parseFloat(cs.fontSize)*0.8);
        g.fillText(t.textContent, 2, 2 + asc);
        const d = g.getImageData(0,0,c.width,c.height).data;
        const out = [];
        for (let y=0;y<c.height;y++) for(let x=0;x<c.width;x++){ if(d[(y*c.width+x)*4+3]>40) out.push([x,y]); }
        return out;
      }
      const scale=4;
      let overlaps = [];
      for (const t of texts) {
        const a = inkMask(t, scale);
        const b = box(t);
        for (const u of texts) {
          if (u===t) continue;
          const c = box(u);
          // bbox intersection
          const ix = Math.min(b.x+b.w, c.x+c.w)-Math.max(b.x,c.x);
          const iy = Math.min(b.y+b.h, c.y+c.h)-Math.max(b.y,c.y);
          if (ix<=0||iy<=0) continue;
          // pixel overlap
          const setB = new Set(u && inkMask(u,scale).map(p=>p[0]+','+p[1]));
          let n=0;
          for (const [x,y] of a) if (setB.has(x+','+y)) n++;
          overlaps.push({a:t.textContent, b:u.textContent, bboxOverlap:[+ix.toFixed(1),+iy.toFixed(1)], inkPx:n, inkCssPx2:+(n/(scale*scale)).toFixed(2)});
        }
      }
      return { info, overlaps: overlaps.filter(o=>o.inkPx>0).sort((x,y)=>y.inkPx-x.inkPx), title: tb };
    });
    console.log('=== width', width, '===');
    console.log('axis-title bbox:', JSON.stringify(res.title));
    console.log(res.info.map(i=>`${i.cls||''} "${i.txt}" x=${i.x} y=${i.y} w=${i.w} h=${i.h} fs=${i.fs}`).join('\n'));
    console.log('ink overlaps >0:', JSON.stringify(res.overlaps, null, 1));
    await page.close();
  }
  await browser.close();
})();
