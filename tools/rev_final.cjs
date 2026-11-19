// FINAL summary of the measured facts.
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
    const q = svg.querySelector('text.q');
    const labelX = parseFloat(q.getAttribute('x')), labelY = parseFloat(q.getAttribute('y'));
    const tx = labelX - 9, ty = labelY - 3.5;
    let dot=null; for(const c of svg.querySelectorAll('circle')) if(Math.abs(parseFloat(c.getAttribute('cx'))-tx)<0.01){dot=c;break;}
    const r0 = parseFloat(dot.getAttribute('r'));
    const e0 = q.getExtentOfChar(0);
    const dy = (e0.y + e0.height/2) - ty;
    const chord = Math.sqrt(r0*r0 - dy*dy);
    return {
      claim_said_dot_at: 'svg user (482.88, 10), r=11.998, label at (491.88, 3.48)',
      measured_dot_at: { cx:+tx.toFixed(3), cy:+ty.toFixed(3), r:+r0.toFixed(3) },
      measured_dot_vertical_span: [+(ty-r0).toFixed(3), +(ty+r0).toFixed(3)],
      measured_label_anchor: { x:+labelX.toFixed(3), y:+labelY.toFixed(3) },
      measured_label_ink: { left:+e0.x.toFixed(3), top:+e0.y.toFixed(3), w:+e0.width.toFixed(3), h:+e0.height.toFixed(3) },
      dot_top_is_negative: (ty-r0) < 0,
      label_ink_vertical_span: [+e0.y.toFixed(3), +(e0.y+e0.height).toFixed(3)],
      disc_right_at_glyph_mid: +(tx+chord).toFixed(3),
      horizontal_overlap_user_units: +(tx+chord - (labelX+e0.x)).toFixed(3),
      source_padT: 'page.js line 362: padT = 22'
    };
  });
  console.log(JSON.stringify(r,null,1));
  await b.close();
})();
