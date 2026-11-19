const p=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await p.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const pg=await b.newPage();
await pg.setViewport({width:1440,height:1200});
await pg.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,600));
const o=await pg.evaluate(()=>{
  // find a row that is OFF watchlist (early tag) so both a cyan tag AND a cyan pill sit in the SAME row
  const tr=[...document.querySelectorAll('tbody tr')].find(t=>t.querySelector('.tag.early'));
  const tag=tr.querySelector('.tag.early'), pill=tr.querySelector('.pill');
  const cells=[...tr.children].map((c,i)=>({i,head:document.querySelectorAll('thead th')[i].textContent.trim(),txt:c.textContent.trim().slice(0,26)}));
  const bg=(e)=>getComputedStyle(e).backgroundColor;
  const g=e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.x),right:Math.round(r.right)};};
  const scopeHdr=[...document.querySelectorAll('thead th')].find(t=>t.textContent.trim()==='Scope');
  const oddsHdr=[...document.querySelectorAll('thead th')].find(t=>t.textContent.trim()==='Launch odds');
  return {
    cellsBetweenScopeAndOdds: cells.slice(3,6).map(c=>c.head),
    scopeHdrRect:g(scopeHdr), oddsHdrRect:g(oddsHdr),
    gapColumns: (()=>{const a=[...document.querySelectorAll('thead th')].findIndex(t=>t.textContent.trim()==='Scope');
      const b2=[...document.querySelectorAll('thead th')].findIndex(t=>t.textContent.trim()==='Launch odds');
      return b2-a;})(),
    tag:{text:tag.textContent, color:getComputedStyle(tag).color, bg:bg(tag), border:getComputedStyle(tag).borderTopColor, hasBg:bg(tag)!=='rgba(0, 0, 0, 0)'},
    pill:{text:pill.textContent, color:getComputedStyle(pill).color, bg:bg(pill), hasBg:bg(pill)!=='rgba(0, 0, 0, 0)'},
    tagRect:g(tag), pillRect:g(pill),
    sameRow: tr.contains(tag)&&tr.contains(pill)
  };
});
console.log(JSON.stringify(o,null,1));
await b.close();
})();
