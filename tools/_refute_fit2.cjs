const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async () => {
  const b = await puppeteer.launch({
    executablePath: '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',
    args: ['--no-sandbox', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const p = await b.newPage();
  await p.setViewport({width:1440,height:1200});
  await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'networkidle0'});
  await p.waitForSelector('tbody tr');
  // click the model tab
  const tabs = await p.evaluate(() => Array.from(document.querySelectorAll('[role=tab]')).map(t=>t.textContent.trim()));
  console.log('tabs', tabs);
  await p.evaluate(() => { const t=Array.from(document.querySelectorAll('[role=tab]')).find(x=>/model/i.test(x.textContent)); if(t) t.click(); });
  await new Promise(r=>setTimeout(r,400));
  const r = await p.evaluate(() => {
    const host=document.querySelector('#view-model');
    return { visible: host && !host.hidden, text: host?host.innerText.slice(0,2500):null };
  });
  console.log(r.visible);
  console.log(r.text);
  await b.close();
})();
