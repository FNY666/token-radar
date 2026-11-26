// Does the detail shot cut a line of text at its bottom edge?
//
// The shot is clipped to the drawer at CSS y in [0, 833) and scaled to an 800x1010 PNG. A line
// that straddles y = 833 is drawn half in and half out: the judge reads a fragment of a cost
// line, and a fragment of "Cost: $8400 of capital and about $3 of gas" reads as a wrong figure.
//
// This measures it from the RENDERED PIXELS, not from the DOM: it looks for a row of non-
// background pixels that touches the bottom edge of the shot, and reports what is there.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const fs = require('node:fs');
const path = require('node:path');
const { PNG } = (() => { try { return require('pngjs'); } catch { return {}; } })();

(async () => {
  const OFF = Number(process.argv[2] || 240);
  const OUT = process.argv[3] || ('/tmp/cut-' + OFF + '.png');
  const b = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--hide-scrollbars','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({width:1440,height:900,deviceScaleFactor:800/660});
  await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
  await p.waitForSelector('tbody tr');
  await p.evaluate(() => {
    const rows=[...document.querySelectorAll('tbody tr.row')];
    const t=rows.find(r=>r.querySelector('.pname') && r.querySelector('.pname').textContent.indexOf('Gauntlet')!==-1)||rows[0];
    t.click();
  });
  await p.waitForSelector('.sheet',{visible:true});
  await new Promise(r=>setTimeout(r,300));
  await p.evaluate((o)=>{ document.querySelector('.sheet').scrollTop = o; }, OFF);
  await new Promise(r=>setTimeout(r,200));
  await p.screenshot({path:OUT, clip:{x:1440-660,y:0,width:660,height:833}});
  await b.close();
  console.log('wrote', OUT);
})();
