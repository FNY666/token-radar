// Is the stated mechanism true? "Product rows are older and bigger than pre-token rows by construction."
import fs from 'node:fs';
import { parseSnapshot, isEligible, isTokenProduct, isPreToken, ageDays } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';
const raw=JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json','utf8'));
const S=parseSnapshot(JSON.stringify(raw));
const elig=S.protocols.filter(isEligible);
const prod=elig.filter(isTokenProduct);
const pre=elig.filter(isPreToken);
const age=(p)=>ageDays(S.as_of,p.listed_at)??365;
const med=(a)=>{a=[...a].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
console.log('product rows:',prod.length,' median age',med(prod.map(age)),' median TVL',med(prod.map(p=>p.tvl_usd)));
console.log('pre-token   :',pre.length,' median age',med(pre.map(age)),' median TVL',med(pre.map(p=>p.tvl_usd)));
console.log('own issuers :',elig.filter(p=>p.mcap_usd!==null||p.gecko_id!==null).length,' median age',med(elig.filter(p=>p.mcap_usd!==null||p.gecko_id!==null).map(age)));
