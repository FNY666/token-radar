// Every number in every farm step must come from that protocol's own record.
import fs from 'node:fs';
const s=JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json','utf8'));
const idx=new Map(s.protocols.map(p=>[p.slug,p]));
const raw=fs.readFileSync('/tmp/fz/data.js','utf8');
const D=JSON.parse(raw.slice(raw.indexOf('=')+1).replace(/;\s*$/,''));
const gasOf=c=>c==='Ethereum'?12:c==='Bitcoin'?6:c==='Solana'?1:3;
const capOf=t=>t>=1e9?400:t>=250e6?250:t>=100e6?150:t>=50e6?100:50;
const holdOf=a=>a===null?60:a<180?90:a<365?60:a<730?45:30;
let problems=[];
for(const r of D.rows){
  const p=idx.get(r.slug);
  const chain=p.chains[0]||'its main chain';
  const gas=gasOf(chain), cap=capOf(p.tvl_usd), hold=holdOf(r.age_days);
  const steps=r.farm_steps;
  if(steps.length!==8) problems.push([r.slug,'steps',steps.length]);
  // step 1: chain + gas
  if(!steps[0].includes(chain)) problems.push([r.slug,'step1 chain',chain,steps[0].slice(0,80)]);
  if(!steps[0].includes('\$'+gas)) problems.push([r.slug,'step1 gas',gas,steps[0].slice(0,80)]);
  // step 2: capital from TVL, chain, name
  if(!steps[1].includes('\$'+cap)) problems.push([r.slug,'step2 capital',cap,steps[1].slice(0,120)]);
  if(!steps[1].includes(chain)) problems.push([r.slug,'step2 chain',chain]);
  if(!steps[1].includes(p.name)) problems.push([r.slug,'step2 name',p.name]);
  if(!steps[1].includes('\$'+gas)) problems.push([r.slug,'step2 gas',gas]);
  // step 3: weekly gas
  if(!steps[2].includes('\$'+gas*4)) problems.push([r.slug,'step3 4-week',gas*4,steps[2]]);
  // step 4: hold days
  if(!steps[3].includes(hold+' days')) problems.push([r.slug,'step4 hold',hold,steps[3]]);
  // step 8: listed_at
  if(p.listed_at && !steps[7].includes(p.listed_at)) problems.push([r.slug,'step8 listed_at',p.listed_at,steps[7].slice(0,160)]);
  // no stale numbers: every $ amount in the plan must be one of the allowed set
  const allowed=new Set([gas,cap,gas*4]);
  for(const st of steps){
    for(const m of st.matchAll(/\$([\d,]+)/g)){
      const v=Number(m[1].replace(/,/g,''));
      if(!allowed.has(v)) problems.push([r.slug,'unexpected $',v,st.slice(0,150)]);
    }
  }
}
console.log('rows', D.rows.length, 'farm-plan problems:', problems.length);
const seen=new Set();
for(const p of problems){ const k=p.slice(0,3).join('|'); if(seen.has(k))continue; seen.add(k); console.log(' ',p.join(' | ')); if(seen.size>20)break; }
