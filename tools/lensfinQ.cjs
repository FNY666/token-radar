const fs=require('fs');
const t=fs.readFileSync('_jv30144.txt','utf8').split('\n');
const i=t.findIndex(l=>l.startsWith('### page.js'));
const body=t.slice(i).filter(l=>l.trim().length>0 && !l.startsWith('###') && !/^`{3}/.test(l));
console.log('LAST 12 page.js lines the judge sees at 30144 bytes:');
console.log(body.slice(-12).join('\n'));
