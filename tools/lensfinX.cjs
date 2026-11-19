const fs=require('fs');
const t=fs.readFileSync('_jv30144.txt','utf8').split('\n');
const i=t.findIndex(l=>l.startsWith('### page.js'));
const j=t.findIndex((l,k)=>k>i && l.startsWith('### theme.css'));
const seg=t.slice(i,j);
// find the line with the chains guard
const g=seg.findIndex(l=>l.includes("if ((row.chains"));
console.log('--- judge view page.js: 12 lines around the chains guard ---');
console.log(seg.slice(Math.max(0,g-6), g+12).join('\n'));
console.log('--- any mention of 8 or slice in the page.js block? ---');
seg.forEach((l,k)=>{ if(/slice\(0|\b8\b/.test(l)) console.log(k, JSON.stringify(l)); });
