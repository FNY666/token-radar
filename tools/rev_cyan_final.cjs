const p=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await p.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const pg=await b.newPage();
await pg.setViewport({width:1440,height:1200});
await pg.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
await new Promise(r=>setTimeout(r,600));
const o=await pg.evaluate(()=>{
  const early=[...document.querySelectorAll('tbody .tag.early')][0];
  const pill=early.closest('tr').querySelector('.pill');
  const ecs=getComputedStyle(early), pcs=getComputedStyle(pill);
  // is the tag text truncated?
  return {
    earlyText: early.textContent, earlyScrollW: early.scrollWidth, earlyClientW: early.clientWidth,
    earlyOverflow: ecs.overflow, earlyTextOverflow: ecs.textOverflow, earlyWhiteSpace: ecs.whiteSpace,
    earlyFont: ecs.fontFamily.split(',')[0], earlyFs: ecs.fontSize,
    pillText: pill.textContent, pillFont: pcs.fontFamily.split(',')[0], pillFs: pcs.fontSize,
    pillBorder: pcs.borderTopWidth, pillRadius: pcs.borderRadius, earlyBorder: ecs.borderTopWidth,
    earlyRadius: ecs.borderRadius,
    allLinks: [...document.querySelectorAll('a')].map(a=>({cls:a.className,href:a.getAttribute('href'),color:getComputedStyle(a).color,txt:a.textContent.trim().slice(0,30)})),
    // is there a scope filter that gives an explicit non-colour way to scan membership?
    chips: [...document.querySelectorAll('.chip, .controls button')].map(c=>c.textContent.trim()).slice(0,12)
  };
});
console.log(JSON.stringify(o,null,1));
await b.close();
})();
