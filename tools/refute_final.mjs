// The sentence in MODEL.md and the comment in lib/model.ts describe ONE operation:
//   take the 130 product rows OUT of the 433-row eligible set and recompute the rate of the remainder.
// Is that operation like-for-like? Both percentages are rates of THEIR OWN population.
import fs from 'node:fs';
import { parseSnapshot, isEligible, isTokenProduct, issuedOwnToken } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';
const raw=JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json','utf8'));
const S=parseSnapshot(JSON.stringify(raw));
const elig=S.protocols.filter(isEligible);
const anyTok=(p)=>p.mcap_usd!==null||p.gecko_id!==null||p.symbol!==null;

// THE REMOVAL, done literally on one set:
const before = elig.filter(anyTok).length;                 // 238 of 433
const removed = elig.filter(isTokenProduct).length;        // 130
const afterSet = elig.filter(p=>!isTokenProduct(p));
const after = afterSet.filter(issuedOwnToken).length;      // 108
console.log('STEP 1  eligible universe           :', elig.length);
console.log('STEP 2  "issued" under the old label:', before, '->', (before/elig.length*100).toFixed(1)+'%');
console.log('STEP 3  remove the product rows     :', removed, 'removed;', elig.length, '-', removed, '=', afterSet.length);
console.log('STEP 4  "issued" among the remainder :', after, '->', (after/afterSet.length*100).toFixed(1)+'%');
console.log('STEP 5  the rate falls              :', ((before/elig.length)-(after/afterSet.length))*100, 'points');
console.log('');
console.log('Every percentage is the rate of the population it is computed over.');
console.log('The count arithmetic closes exactly:', before, '-', removed, '=', before-removed, '(=', after, ') and', elig.length,'-',removed,'=',afterSet.length);
console.log('');
// The reviewer's counterfactual: hold the universe at 303 and relabel.
console.log('REVIEWER counterfactual: universe held at 303, old label applied.');
const oldLab = afterSet.filter(anyTok).length;
console.log('   old label over 303 =', oldLab, '(identical to new label:', oldLab===after, ')');
console.log('   -> the two labels coincide on EVERY row of that set, so it is not a distinct');
console.log('      specification; it measures nothing.');
