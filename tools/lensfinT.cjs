const fs=require('fs');
const t=fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/tools/_jv30144.txt','utf8').split('\n');
const i=t.findIndex(l=>l.startsWith('### page.js'));
const j=t.findIndex((l,k)=>k>i && l.startsWith('### theme.css'));
const seg=t.slice(i,j);
console.log('page.js block lines:',seg.length);
console.log('--- LAST 20 lines of the page.js block in the judge view ---');
console.log(seg.slice(-20).join('\n'));
console.log('--- does the block contain "chips"?', seg.filter(l=>l.includes('chips')).join(' || '));
