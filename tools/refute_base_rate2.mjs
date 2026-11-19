// What BASE RATE does each MODEL SPECIFICATION actually produce?
// The entry compares two specifications:
//   OLD spec : universe = all eligible (433), label = "records a token" (product rows -> 1)
//   NEW spec : universe = eligible minus product rows (303), label = "issued a token of its own"
// Question: is the 19.4-point gap an artefact of the denominator switch, or does the FITTED
// MODEL's base rate actually move by that much?
import fs from 'node:fs';
import { parseSnapshot, isEligible, isTokenProduct, issuedOwnToken, ageDays } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';

const raw = JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json','utf8'));
const S = parseSnapshot(JSON.stringify(raw));
const asOf = S.as_of;
const AGE_BANDS=[[0,182],[182,365],[365,730],[730,1460],[1460,Infinity]];
const TVL_BANDS=[[0,1e7],[1e7,5e7],[5e7,2e8],[2e8,Infinity]];
const clamp=(g)=>g===null?0:Math.max(-60,Math.min(120,g));
const bandOf=(bs,v)=>{for(let i=0;i<bs.length;i++)if(v>=bs[i][0]&&v<bs[i][1])return i;return bs.length-1;};
function row(p){const age=ageDays(asOf,p.listed_at)??365;const ab=bandOf(AGE_BANDS,age),tb=bandOf(TVL_BANDS,p.tvl_usd);const g=clamp(p.change_7d);const x=[1];for(let i=0;i<AGE_BANDS.length;i++)x.push(i===ab?1:0);for(let i=0;i<TVL_BANDS.length;i++)x.push(i===tb?1:0);x.push(g/60,(g/60)*(g/60));return x;}
function fit(rows){const k=rows[0].x.length;let beta=new Array(k).fill(0);for(let it=0;it<400;it++){const grad=new Array(k).fill(0);for(const r of rows){let z=0;for(let j=0;j<k;j++)z+=beta[j]*r.x[j];const e=r.y-1/(1+Math.exp(-z));for(let j=0;j<k;j++)grad[j]+=e*r.x[j];}for(let j=0;j<k;j++)beta[j]+=(0.6*grad[j])/rows.length;}return beta;}
function auc(rows,beta){const pos=rows.filter(r=>r.y===1),neg=rows.filter(r=>r.y===0);let h=0;for(const p of pos){let zp=0;for(let j=0;j<beta.length;j++)zp+=beta[j]*p.x[j];for(const n of neg){let zn=0;for(let j=0;j<beta.length;j++)zn+=beta[j]*n.x[j];h+=zp>zn?1:zp===zn?0.5:0;}}return h/(pos.length*neg.length);}
const elig=S.protocols.filter(isEligible);
const anyTok=(p)=>p.mcap_usd!==null||p.gecko_id!==null||p.symbol!==null;
const mk=(rows,lab)=>rows.map(p=>({x:row(p),y:lab(p)?1:0}));

const specs=[
  ['OLD spec: universe 433, label=records-a-token', mk(elig, anyTok)],
  ['NEW spec: universe 303, label=own-issuer    ', mk(elig.filter(p=>!isTokenProduct(p)), issuedOwnToken)],
];
const board=elig.filter(p=>p.mcap_usd===null&&p.gecko_id===null&&p.symbol===null);
for(const [name,rows] of specs){
  const beta=fit(rows);
  const meanPred=rows.reduce((a,r)=>{let z=0;for(let j=0;j<beta.length;j++)z+=beta[j]*r.x[j];return a+1/(1+Math.exp(-z));},0)/rows.length;
  const base=rows.reduce((a,r)=>a+r.y,0)/rows.length;
  // mean prediction restricted to the BOARD rows (the ones the model actually prices)
  let mb=0,nb=0;
  for(const p of board){let z=0;for(let j=0;j<beta.length;j++)z+=beta[j]*row(p)[j];mb+=1/(1+Math.exp(-z));nb++;}
  console.log(name);
  console.log('   rows',rows.length,' empirical base rate', (base*100).toFixed(1)+'%');
  console.log('   fitted intercept beta0 =', beta[0].toFixed(4), ' -> sigmoid =', (1/(1+Math.exp(-beta[0]))*100).toFixed(1)+'%');
  console.log('   model mean predicted P(issued) over its own universe =', (meanPred*100).toFixed(1)+'%');
  console.log('   model mean predicted P(issued) over the 195 BOARD rows =', (mb/nb*100).toFixed(1)+'%');
  console.log('   AUC on its own universe =', auc(rows,beta).toFixed(4));
}
