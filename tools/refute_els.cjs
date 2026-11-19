const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args:['--no-sandbox','--hide-scrollbars','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
  await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html', { waitUntil:'networkidle0' });
  await p.waitForSelector('tbody tr');
  await new Promise(r=>setTimeout(r,600));
  const out = await p.evaluate(()=>{
    return Array.from(document.querySelectorAll('body *')).map(e=>{const r=e.getBoundingClientRect();
      return {tag:e.tagName, cls:(e.className&&e.className.baseVal!==undefined?e.className.baseVal:e.className)||'', x:+r.x.toFixed(0),y:+r.y.toFixed(0),w:+r.width.toFixed(0),h:+r.height.toFixed(0)};
    }).filter(e=>e.w>0&&e.h>0&&e.y<700&&e.y+e.h>480);
  });
  console.log(JSON.stringify(out,null,0).replace(/\},/g,'},\n'));
  await b.close();
})();
