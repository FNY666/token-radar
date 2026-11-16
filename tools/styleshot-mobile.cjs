// The same computed-style snapshot at a narrow width, so the media-query rules are covered.
const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const path = require('node:path');
const fs = require('node:fs');
const OUT = '/home/muse-newapi/makefun-token-radar/work/out';
const PROPS = ['color','background-color','font-size','font-weight','font-family','line-height','letter-spacing','text-align','text-transform','white-space','padding-top','padding-right','padding-bottom','padding-left','margin-top','margin-right','margin-bottom','margin-left','border-top-width','border-bottom-width','border-top-color','border-bottom-color','display','position','top','left','z-index','flex-direction','align-items','justify-content','gap','grid-template-columns','opacity','overflow-x','overflow-y','cursor','visibility','box-shadow','max-width','min-width','width','height','transform'];
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell', args: ['--no-sandbox','--allow-file-access-from-files'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844 });
  const out = {};
  for (const [name, hash] of [['board',''],['live','#view=live'],['model','#view=model']]) {
    await page.goto('file://' + path.join(OUT,'dashboard','index.html') + hash, { waitUntil: 'load' });
    await new Promise(r=>setTimeout(r,150));
    if (name==='board') { await page.waitForSelector('tbody tr'); await page.evaluate(()=>document.querySelector('tbody tr.row').click()); await page.waitForSelector('.sheet'); await new Promise(r=>setTimeout(r,120)); }
    out[name] = await page.evaluate((props)=>{ const seen=new Map(); let i=0; const walk=(n,p)=>{ if(n.nodeType!==1)return; const s=getComputedStyle(n); const st={}; for(const q of props) st[q]=s[q]; seen.set(p+'#'+i,{tag:n.tagName,cls:n.className&&String(n.className),style:st}); i++; for(const c of n.children) walk(c,p+'/'+c.tagName); }; walk(document.body,'body'); return Array.from(seen.entries()); }, PROPS);
  }
  await browser.close();
  fs.writeFileSync(process.argv[2], JSON.stringify(out));
  console.log('mobile snapshot written');
})();
