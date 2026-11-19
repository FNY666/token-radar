const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
const url = process.argv[2];
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args:['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
  await p.goto(url, { waitUntil:'networkidle0' });
  await new Promise(r=>setTimeout(r,500));
  const info = await p.evaluate(()=>{
    const t = Array.from(document.querySelectorAll('.plot svg text'));
    const pick = x=>{const bb=x.getBBox();return {t:x.textContent,x:+bb.x.toFixed(2),y:+bb.y.toFixed(2),w:+bb.width.toFixed(2),h:+bb.height.toFixed(2)};};
    const all = t.map(pick);
    const A = t.find(x=>x.textContent==='Implied value');
    const B = t.find(x=>x.textContent==='$10.0M');
    if(!A||!B) return {all, note:'missing one'};
    const bbA=A.getBBox(), bbB=B.getBBox();
    const ix=Math.min(bbA.x+bbA.width,bbB.x+bbB.width)-Math.max(bbA.x,bbB.x);
    const iy=Math.min(bbA.y+bbA.height,bbB.y+bbB.height)-Math.max(bbA.y,bbB.y);
    return {all, title:pick(A), tick:pick(B), bboxOverlap:[+ix.toFixed(2),+iy.toFixed(2)], overlap: ix>0&&iy>0};
  });
  console.log(url);
  console.log(JSON.stringify(info,null,1));
  await b.close();
})();
