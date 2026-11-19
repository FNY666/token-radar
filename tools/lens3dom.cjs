const puppeteer=require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
(async()=>{
const b=await puppeteer.launch({executablePath:'/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell',args:['--no-sandbox','--allow-file-access-from-files']});
const p=await b.newPage();
await p.setViewport({width:1400,height:1200});
await p.goto('file:///home/muse-newapi/makefun-token-radar/work/out/dashboard/index.html',{waitUntil:'load'});
await new Promise(r=>setTimeout(r,1000));
const res=await p.evaluate(()=>{
  const out=[];
  for(const name of ['Gauntlet','Steakhouse','Polymarket']){
    const cell=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&(e.textContent||'').trim().startsWith(name));
    if(!cell){out.push(name+': NOT FOUND');continue;}
    const row=cell.closest('tr')||cell.closest('[role=row]')||cell.parentElement;
    out.push(name+' rowtext: '+(row.textContent||'').slice(0,150));
  }
  return out;
});
console.log(res.join('\n'));
await b.close();
process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
