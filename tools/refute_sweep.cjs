// All-element text overlap sweep across widths and tabs, on the current page.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args:['--no-sandbox','--hide-scrollbars','--allow-file-access-from-files'] });
  for (const width of [1440,1024,390]) {
    const p = await b.newPage();
    await p.setViewport({ width, height: 1000, deviceScaleFactor: 1 });
    await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html', { waitUntil:'networkidle0' });
    await p.waitForSelector('tbody tr');
    await new Promise(r=>setTimeout(r,400));
    for (const tab of [0,1,2]) {
      const res = await p.evaluate((tab)=>{
        const tabs = Array.from(document.querySelectorAll('.tabs button, .tabs a'));
        if (tabs[tab]) { tabs[tab].click(); }
        const els = Array.from(document.querySelectorAll('*')).filter(e=>{
          if (e.closest('svg')) return false;
          const t=(e.textContent||'').trim();
          return e.children.length===0 && t.length>0 && e.getBoundingClientRect().width>0;
        });
        const out=[];
        for (let i=0;i<els.length;i++) for (let j=i+1;j<els.length;j++){
          const a=els[i].getBoundingClientRect(), c=els[j].getBoundingClientRect();
          const ix=Math.min(a.right,c.right)-Math.max(a.left,c.left);
          const iy=Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top);
          if (ix>1&&iy>1) out.push([els[i].textContent.trim().slice(0,25), els[j].textContent.trim().slice(0,25), +ix.toFixed(1), +iy.toFixed(1)]);
        }
        // the SVG texts among themselves
        const svgs = Array.from(document.querySelectorAll('svg text'));
        for (let i=0;i<svgs.length;i++) for (let j=i+1;j<svgs.length;j++){
          const a=svgs[i].getBoundingClientRect(), c=svgs[j].getBoundingClientRect();
          const ix=Math.min(a.right,c.right)-Math.max(a.left,c.left);
          const iy=Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top);
          if (ix>1&&iy>1) out.push(['SVG:'+svgs[i].textContent,'SVG:'+svgs[j].textContent,+ix.toFixed(1),+iy.toFixed(1)]);
        }
        return out;
      }, tab);
      console.log(width, 'tab'+tab, 'overlaps:', res.length, JSON.stringify(res.slice(0,6)));
    }
    await p.close();
  }
  await b.close();
})();
