// The mechanism claim, with and without the untracked-age rows.
import fs from 'node:fs';
import { parseSnapshot, isEligible, isTokenProduct, isPreToken, ageDays } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';
const raw=JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json','utf8'));
const S=parseSnapshot(JSON.stringify(raw));
const elig=S.protocols.filter(isEligible);
const prod=elig.filter(isTokenProduct), pre=elig.filter(isPreToken);
const med=(a)=>{a=[...a].sort((x,y)=>x-y);return a.length%2?a[(a.length-1)/2]:(a[a.length/2-1]+a[a.length/2])/2;};
for (const [label,rows] of [['product rows',prod],['pre-token rows',pre]]) {
  const known = rows.filter(p=>ageDays(S.as_of,p.listed_at)!==null);
  console.log(label, 'n='+rows.length,
    '| median age (null->365):', med(rows.map(p=>ageDays(S.as_of,p.listed_at)??365)),
    '| median age (known only, n='+known.length+'):', med(known.map(p=>ageDays(S.as_of,p.listed_at))),
    '| median TVL: $'+med(rows.map(p=>p.tvl_usd)).toExponential(2));
}
