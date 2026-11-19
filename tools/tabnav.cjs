const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox']});
  for (const w of [1440,390,320]) {
    const p = await b.newPage();
    await p.setViewport({width:w,height:900});
    await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
    await p.evaluate(()=>{document.body.focus(); if(document.activeElement)document.activeElement.blur();});
    const seq=[];
    let hitTable=-1;
    for(let i=0;i<600;i++){
      await p.keyboard.press('Tab');
      const info = await p.evaluate(()=>{const a=document.activeElement; if(!a)return null;
        return {tag:a.tagName, cls:(a.getAttribute('class')||''), inPlot:!!a.closest('#plot-wrap'), inTable:!!a.closest('#table-wrap'), ti:a.getAttribute('tabindex'), label:(a.getAttribute('aria-label')||a.textContent||'').slice(0,40)};});
      if(!info) break;
      seq.push(info);
      if(info.inTable && hitTable<0){hitTable=i+1; break;}
    }
    const census = await p.evaluate(()=>{
      const sel='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea,[tabindex]:not([tabindex="-1"])';
      const all=[...document.querySelectorAll(sel)];
      const c={};
      for(const e of all){const k=e.tagName+(e.closest('#plot-wrap')?'[PLOT]':'')+(e.closest('#table-wrap')?'[TABLE]':'');c[k]=(c[k]||0)+1;}
      return {total:all.length,c};
    });
    console.log(`w=${w} tabStopsToTable=${hitTable} census=`, JSON.stringify(census));
    console.log('  first 12 stops:', seq.slice(0,12).map(s=>`${s.tag}${s.cls?'.'+s.cls.split(' ')[0]:''}${s.ti?'[ti'+s.ti+']':''}${s.inPlot?'(PLOT)':s.inTable?'(TABLE)':''}`).join(' | '));
    await p.close();
  }
  await b.close();
})();
