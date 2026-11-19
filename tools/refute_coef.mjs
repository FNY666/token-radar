// Does the base-rate gap between the two SPECIFICATIONS show up in the fitted model itself?
import fs from 'node:fs';
import { parseSnapshot, isEligible, isTokenProduct, issuedOwnToken, ageDays } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';
const raw=JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json','utf8'));
const S=parseSnapshot(JSON.stringify(raw)); const asOf=S.as_of;
const AGE=[[0,182],[182,365],[365,730],[730,1460],[1460,Infinity]];
const TVL=[[0,1e7],[1e7,5e7],[5e7,2e8],[2e8,Infinity]];
const clampG=(g)=>g===null?0:Math.max(-60,Math.min(120,g));
const bandOf=(bs,v)=>{for(let i=0;i<bs.length;i++)if(v>=bs[i][0]&&v<bs[i][1])return i;return bs.length-1;};
const row=(p)=>{const age=ageDays(asOf,p.listed_at)??365;const ab=bandOf(AGE,age),tb=bandOf(TVL,p.tvl_usd);const x=[1];for(let i=0;i<AGE.length;i++)x.push(i===ab?1:0);for(let i=0;i<TVL.length;i++)x.push(i===tb?1:0);x.push(clampG(p.change_7d)/10);return x;};
function fit(rows){const k=rows[0].x.length;let b=new Array(k).fill(0);for(let it=0;it<400;it++){const gr=new Array(k).fill(0);for(const r of rows){let z=0;for(let j=0;j<k;j++)z+=b[j]*r.x[j];const e=r.y-1/(1+Math.exp(-z));for(let j=0;j<k;j++)gr[j]+=e*r.x[j];}for(let j=0;j<k;j++)b[j]+=(0.6*gr[j])/rows.length;}return b;}
const elig=S.protocols.filter(isEligible);
const anyTok=(p)=>p.mcap_usd!==null||p.gecko_id!==null||p.symbol!==null;
const mk=(rows,lab)=>rows.map(p=>({x:row(p),y:lab(p)?1:0}));
const board=elig.filter(p=>p.mcap_usd===null&&p.gecko_id===null&&p.symbol===null);
const NAMES=['intercept',...AGE.map((a,i)=>'age'+i),...TVL.map((t,i)=>'tvl'+i),'growth'];
for(const [name,rows] of [
 ['OLD spec (433, records-a-token)', mk(elig,anyTok)],
 ['NEW spec (303, own-issuer)    ', mk(elig.filter(p=>!isTokenProduct(p)),issuedOwnToken)],
]){
 const b=fit(rows);
 console.log(name);
 console.log('  ', NAMES.map((n,i)=>n+'='+b[i].toFixed(2)).join(' '));
 // what does each spec predict for an OLD protocol that is BIG vs one that is SMALL?
 const probe=(p)=>{let z=0;for(let j=0;j<b.length;j++)z+=b[j]*row(p)[j];return 1/(1+Math.exp(-z));};
 const oldBig = board.filter(p=>p.tvl_usd>=5e7), oldSmall=board.filter(p=>p.tvl_usd<5e7);
 const avg=(a)=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
 console.log('   board rows: big TVL (>=50M) n='+oldBig.length+' mean P='+(avg(oldBig.map(probe))*100).toFixed(1)+'%',
   '| small TVL n='+oldSmall.length+' mean P='+(avg(oldSmall.map(probe))*100).toFixed(1)+'%');
 console.log('   big-minus-small P gap =', ((avg(oldBig.map(probe))-avg(oldSmall.map(probe)))*100).toFixed(1),'points');
 console.log('');
}
