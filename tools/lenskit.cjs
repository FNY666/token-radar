const fs=require('fs');
const {execFileSync}=require('child_process');
const kit='/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs';
// find a CLI verb that renders the judge view
const out=execFileSync(process.execPath,[kit,'--help'],{encoding:'utf8',stdio:['pipe','pipe','pipe']});
console.log(out.slice(0,4000));
