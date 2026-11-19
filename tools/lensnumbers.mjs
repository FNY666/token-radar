// Recompute every numeric claim in MODEL.md sections 2, 3 and 4 from the sealed snapshot,
// using the model's own predicates and the model's own launch universe.
import fs from 'node:fs';
import { parseSnapshot, isEligible, issuedOwnToken, isTokenProduct, isPreToken, ageDays } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';

const raw = JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json', 'utf8'));
const S = parseSnapshot(JSON.stringify(raw));

const all = S.protocols;
const elig = all.filter(isEligible);
const anyToken = (p) => p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;
const recordsAny = elig.filter(anyToken);
const product = elig.filter(isTokenProduct);
const ownIssued = elig.filter((p) => issuedOwnToken(p));
const pre = elig.filter(isPreToken);
const universe = elig.filter((p) => !isTokenProduct(p));   // the launch model's universe

console.log('snapshot protocols            :', all.length, '(MODEL.md says 758)');
console.log('eligible universe             :', elig.length, '(MODEL.md says 433)');
console.log('  records a token (any field) :', recordsAny.length, '(MODEL.md says 238)');
console.log('  of those, product rows      :', product.length, '(MODEL.md says 130)');
console.log('  of those, own issuers       :', ownIssued.length);
console.log('  records none (board)        :', pre.length, '(MODEL.md says 195)');
console.log('launch universe (elig - prod) :', universe.length, '(MODEL.md says 303)');
console.log('  own issuers in universe     :', universe.filter(issuedOwnToken).length, '(MODEL.md says 108)');
console.log('  pre-token in universe       :', universe.filter(isPreToken).length, '(MODEL.md says 195)');
console.log('');

const uni = universe.length;
const oldIssued = universe.filter(anyToken).length;
const newIssued = universe.filter(issuedOwnToken).length;
console.log('OLD label over launch universe :', oldIssued + '/' + uni, '=', (oldIssued / uni * 100).toFixed(1) + '%', '(MODEL.md says 55.0%)');
console.log('CORRECTED over launch universe :', newIssued + '/' + uni, '=', (newIssued / uni * 100).toFixed(1) + '%', '(MODEL.md says 35.6%)');
console.log('difference in points           :', ((oldIssued - newIssued) / uni * 100).toFixed(1), '(MODEL.md says 19.4)');
console.log('');

const BANDS = [[0, 182], [182, 365], [365, 730], [730, 1460], [1460, Infinity]];
const age = (p) => ageDays(S.as_of, p.listed_at) ?? 365;   // the fit's own UNKNOWN_AGE rule
console.log('AGE-BAND TABLE over the launch universe (n / issued / rate):');
for (const [lo, hi] of BANDS) {
  const inb = universe.filter((p) => age(p) >= lo && age(p) < hi);
  const iss = inb.filter(issuedOwnToken).length;
  console.log('  ', String(lo).padStart(4) + '-' + (hi === Infinity ? 'inf' : String(hi)).padEnd(5),
    'n=' + String(inb.length).padStart(3), 'issued=' + String(iss).padStart(3),
    (iss / inb.length * 100).toFixed(1) + '%');
}
console.log('');
const unknown = universe.filter((p) => ageDays(S.as_of, p.listed_at) === null).length;
console.log('rows with no first-tracked date in the universe:', unknown, '(MODEL.md says 35 for the universe / 7 for the board)');
console.log('board rows with no first-tracked date           :', pre.filter((p) => ageDays(S.as_of, p.listed_at) === null).length);
