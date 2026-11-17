// 10 different shuffles: is board.json byte-identical every time?
import fs from 'node:fs'; import {execFileSync} from 'node:child_process'; import {mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const WORK='/home/muse-newapi/makefun-token-radar/work';
const base=JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json','utf8'));
function mk(seed){let s=seed;const r=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
  const sh=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  return {...base, protocols:sh([...base.protocols]), watchlist:sh([...base.watchlist])};}
const hashes=new Set(), datahashes=new Set();
for(let i=0;i<10;i++){
  const d=`/tmp/sh10/${i}`; mkdirSync(d,{recursive:true});
  fs.writeFileSync(`${d}/snapshot.json`, JSON.stringify(mk(1000+i*7919)));
  execFileSync('node',['main.ts','--input',`${d}/snapshot.json`],{cwd:WORK,env:{...process.env,MAKEFUN_OUTPUT_DIR:`${d}/out`},stdio:'pipe'});
  const b=fs.readFileSync(`${d}/out/board.json`);
  const dt=fs.readFileSync(`${d}/out/data.js`);
  hashes.add(createHash('sha256').update(b).digest('hex'));
  datahashes.add(createHash('sha256').update(dt).digest('hex'));
  // full-precision launch_beta
  const raw=dt.toString(); const D=JSON.parse(raw.slice(raw.indexOf('=')+1).replace(/;\s*$/,''));
  if(i===0) console.log('launch_beta', JSON.stringify(D.calibration.launch_beta));
  else console.log('launch_beta', JSON.stringify(D.calibration.launch_beta), 'value_beta', JSON.stringify(D.calibration.value_beta));
}
console.log('\ndistinct board.json hashes over 10 shuffles:', hashes.size);
console.log('distinct data.js hashes over 10 shuffles:', datahashes.size);
