// MODEL.md section 4: "The correction raised the AUC from 0.735: a model trained on the wrong
// labels was being asked to fit a relationship that was not there."
//
// The old labelling: a product row (a ticker with no market cap of its own) counts as an ISSUER.
// The claim implies the old fit was trained on a universe where those rows were included AND
// labelled 1. Measure the AUC of the entry's own launch fit under the old labelling, on the
// universe the old labelling would have used, and on the corrected universe.
import fs from 'node:fs';
import { parseSnapshot, isEligible, isTokenProduct, issuedOwnToken, ageDays } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';

const raw = JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json', 'utf8'));
const S = parseSnapshot(JSON.stringify(raw));
const asOf = S.as_of;

const AGE_BANDS = [[0, 182], [182, 365], [365, 730], [730, 1460], [1460, Infinity]];
const TVL_BANDS = [[0, 1e7], [1e7, 5e7], [5e7, 2e8], [2e8, Infinity]];
const clamp = (g) => g === null ? 0 : Math.max(-60, Math.min(120, g));
const bandOf = (bs, v) => { for (let i = 0; i < bs.length; i++) if (v >= bs[i][0] && v < bs[i][1]) return i; return bs.length - 1; };
function row(p) {
  const age = ageDays(asOf, p.listed_at) ?? 365;
  const ab = bandOf(AGE_BANDS, age), tb = bandOf(TVL_BANDS, p.tvl_usd);
  const g = clamp(p.change_7d);
  const x = [1];
  for (let i = 0; i < AGE_BANDS.length; i++) x.push(i === ab ? 1 : 0);
  for (let i = 0; i < TVL_BANDS.length; i++) x.push(i === tb ? 1 : 0);
  x.push(g / 60, (g / 60) * (g / 60));
  return x;
}
function fit(rows) {
  const k = rows[0].x.length;
  let beta = new Array(k).fill(0);
  for (let it = 0; it < 400; it++) {
    const grad = new Array(k).fill(0);
    for (const r of rows) {
      let z = 0; for (let j = 0; j < k; j++) z += beta[j] * r.x[j];
      const e = r.y - 1 / (1 + Math.exp(-z));
      for (let j = 0; j < k; j++) grad[j] += e * r.x[j];
    }
    for (let j = 0; j < k; j++) beta[j] += (0.6 * grad[j]) / rows.length;
  }
  return beta;
}
function auc(rows, beta) {
  const pos = rows.filter((r) => r.y === 1), neg = rows.filter((r) => r.y === 0);
  let hits = 0;
  for (const p of pos) {
    let zp = 0; for (let j = 0; j < beta.length; j++) zp += beta[j] * p.x[j];
    for (const n of neg) {
      let zn = 0; for (let j = 0; j < beta.length; j++) zn += beta[j] * n.x[j];
      if (zp > zn) hits++; else if (zp === zn) hits += 0.5;
    }
  }
  return hits / (pos.length * neg.length);
}
const elig = S.protocols.filter(isEligible);
const anyTok = (p) => p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null;

const CASES = [
  ['CORRECTED: universe = elig - product, label = issuedOwnToken',
    elig.filter((p) => !isTokenProduct(p)), (p) => (issuedOwnToken(p) ? 1 : 0)],
  ['OLD: universe = elig (product rows IN), label = any token field',
    elig, (p) => (anyTok(p) ? 1 : 0)],
  ['OLD label, corrected universe (product rows excluded, still labelled 1)',
    elig.filter((p) => !isTokenProduct(p)), (p) => (anyTok(p) ? 1 : 0)],
  ['CORRECTED label, full universe (product rows in, labelled 0)',
    elig, (p) => (issuedOwnToken(p) ? 1 : 0)],
];
console.log('case                                                            n   pos   AUC');
for (const [name, U, lab] of CASES) {
  const rows = U.map((p) => ({ x: row(p), y: lab(p) }));
  const b = fit(rows);
  console.log(name.padEnd(60), String(rows.length).padStart(4), String(rows.filter((r) => r.y).length).padStart(5), '  ', auc(rows, b).toFixed(4));
}
console.log('');
console.log("MODEL.md claims: corrected 0.754, old labelling 0.735, 'the correction raised the AUC from 0.735'");
