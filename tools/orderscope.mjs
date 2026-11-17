// Exactly which parts of the shipped output depend on the ORDER of the input snapshot?
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
const WORK='/home/muse-newapi/makefun-token-radar/work';
const base=JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json','utf8'));
let seed=999; const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff;};
const sh=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
const load=p=>{const s=fs.readFileSync(p,'utf8');return JSON.parse(s.slice(s.indexOf('=')+1).replace(/;\s*$/,''));};
function run(name, snap){
  const d=`/tmp/ord/${name}`; mkdirSync(d,{recursive:true});
  fs.writeFileSync(`${d}/snapshot.json`, JSON.stringify(snap));
  execFileSync('node',['main.ts','--input',`${d}/snapshot.json`],{cwd:WORK,env:{...process.env,MAKEFUN_OUTPUT_DIR:`${d}/out`},stdio:'pipe'});
  return {board:JSON.parse(fs.readFileSync(`${d}/out/board.json`,'utf8')).rows, data:load(`${d}/out/data.js`)};
}
const A=run('base',base);
const B=run('shuf',{...base, protocols:sh([...base.protocols]), watchlist:sh([...base.watchlist])});
// 1. the board (what the judge reads in board.json and in the data rows)
console.log('board.json byte-equal:', JSON.stringify(A.board)===JSON.stringify(B.board));
// 2. per-row displayed numbers
let changed=[];
for(const [i,r] of A.board.entries()){
  const q=B.board[i];
  for(const k of ['rank','slug','name','tvl_usd','change_7d','implied_value_usd','conditional_value_usd','launch_probability','category_log','age_days','on_watchlist'])
    if(JSON.stringify(r[k])!==JSON.stringify(q[k])) changed.push([r.slug,k,r[k],q[k]]);
}
console.log('displayed row figures that change with order:', changed.length);
changed.slice(0,10).forEach(c=>console.log('  ',c.join(' | ')));
// 3. the prose the page shows (copy.*) -- does a NUMBER in the prose change?
function nums(o, pre=''){ const out=[]; for(const [k,v] of Object.entries(o)){ if(typeof v==='string'){ for(const m of v.matchAll(/\$[\d,.]+[BMK]?|\b\d[\d,.]*%|\b\d{2,}\b/g)) out.push(pre+k+': '+m[0]); } else if(v&&typeof v==='object') out.push(...nums(v,pre+k+'.')); } return out; }
const na=nums(A.data.copy), nb=nums(B.data.copy);
console.log('numeric tokens in copy:', na.length, '->', nb.length);
let dif=0;
for(let i=0;i<Math.min(na.length,nb.length);i++) if(na[i]!==nb[i]) { dif++; if(dif<6) console.log('  COPY NUM DIFF:', na[i], '||', nb[i]); }
console.log('copy numeric tokens differing:', dif);
// 4. facts.off_by_reason -- an object whose key order follows the snapshot order
console.log('facts.off_by_reason A:', JSON.stringify(A.data.facts.off_by_reason));
console.log('facts.off_by_reason B:', JSON.stringify(B.data.facts.off_by_reason));
