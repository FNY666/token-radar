const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, args:['--no-sandbox','--allow-file-access-from-files'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
  await p.goto(process.argv[2], { waitUntil:'networkidle0' });
  await new Promise(r=>setTimeout(r,500));
  const out = await p.evaluate(()=>{
    const svg = document.querySelector('.plot svg');
    const texts = Array.from(svg.querySelectorAll('text'));
    const A = texts.find(t=>t.textContent==='Implied value');
    const B = texts.find(t=>t.textContent==='$10.0M');
    const scale=4;
    function mask(t){
      const bb=t.getBBox(); const cs=getComputedStyle(t);
      const W=Math.ceil(bb.width)+6,H=Math.ceil(bb.height)+6;
      const c=document.createElement('canvas'); c.width=W*scale;c.height=H*scale;
      const g=c.getContext('2d'); g.scale(scale,scale);
      g.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
      g.textBaseline='alphabetic'; g.fillStyle='#000';
      g.fillText(t.textContent,3,3+bb.y);
      const d=g.getImageData(0,0,c.width,c.height).data; const s=new Set();
      for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++) if(d[(y*c.width+x)*4+3]>40) s.add(x+','+y);
      return s;
    }
    const ma=mask(A), mb=mask(B);
    let n=0; for(const k of ma) if(mb.has(k)) n++;
    return {overlapInkPixels:n, overlapInkCssPx2:+(n/(scale*scale)).toFixed(2),
      titleBBox:(x=>[x.x,x.y,x.width,x.height])(A.getBBox()),
      tickBBox:(x=>[x.x,x.y,x.width,x.height])(B.getBBox())};
  });
  console.log(process.argv[2], JSON.stringify(out));
  await b.close();
})();
