// Counterfactual base rates for the four (universe, label) combinations the entry could mean.
import fs from 'node:fs';
import { parseSnapshot, isEligible, issuedOwnToken, isTokenProduct, isPreToken, ageDays } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';

const raw = JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json','utf8'));
const S = parseSnapshot(JSON.stringify(raw));
const elig = S.protocols.filter(isEligible);
const anyToken = (p) => p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
const own = issuedOwnToken;

const uniOld = elig;                       // old universe: all eligible (433)
const uniNew = elig.filter(p => !isTokenProduct(p)); // new universe (303)
const pct = (a,b)=> (a/b*100).toFixed(1)+'%';

console.log('OLD universe (433), OLD label (records a token) :', uniOld.filter(anyToken).length+'/'+uniOld.length, pct(uniOld.filter(anyToken).length, uniOld.length));
console.log('OLD universe (433), NEW label (own issuer)      :', uniOld.filter(own).length+'/'+uniOld.length, pct(uniOld.filter(own).length, uniOld.length));
console.log('NEW universe (303), NEW label (own issuer)      :', uniNew.filter(own).length+'/'+uniNew.length, pct(uniNew.filter(own).length, uniNew.length));
console.log('NEW universe (303), OLD label (records a token) :', uniNew.filter(anyToken).length+'/'+uniNew.length, pct(uniNew.filter(anyToken).length, uniNew.length));
console.log('');

// The claim "product rows are older and bigger, so labelling them issued teaches old-and-big means issued":
// compare age-band rates under each labelling.
const BANDS=[[0,182],[182,365],[365,730],[730,1460],[1460,Infinity]];
const age=(p)=>ageDays(S.as_of,p.listed_at)??365;
function band(rows,label){
  console.log(rows===uniOld?'OLD universe (433)':'NEW universe (303)');
  for(const [lo,hi] of BANDS){
    const inb=rows.filter(p=>age(p)>=lo&&age(p)<hi);
    const iss=inb.filter(label).length;
    console.log('  ',String(lo).padStart(4)+'-'+(hi===Infinity?'inf':String(hi)).padEnd(5),'n='+String(inb.length).padStart(3),'issued='+String(iss).padStart(3),pct(iss,inb.length));
  }
  // mean age
  const ma=rows.reduce((a,p)=>a+age(p),0)/rows.length;
  console.log('   mean age days:', ma.toFixed(0));
}
band(uniOld, anyToken);
band(uniNew, own);
// also: NEW universe, but with product rows hypothetically labelled issued is degenerate (identical) - show it
console.log('');
console.log('On the NEW universe the OLD label equals the NEW label on every row:', uniNew.every(p=>anyToken(p)===own(p)));
