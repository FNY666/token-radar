// Verify MODEL.md section 4's AUC claims: the corrected model (product rows excluded, label
// issuedOwnToken) should be 0.754, and the OLD labelling (every product row counted as an issuer)
// should be 0.735.
import fs from 'node:fs';
import { parseSnapshot, isEligible, isTokenProduct, issuedOwnToken, ageDays } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';

const raw = JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json', 'utf8'));
const S = parseSnapshot(JSON.stringify(raw));
const asOf = S.as_of;

const AGE_BANDS = [[0, 182], [182, 365], [365, 730], [730, 1460], [1460, Infinity]];
const TVL_BANDS = [[0, 1e7], [1e7, 5e7], [5e7, 2e8], [2e8, Infinity]];
const clamp = (g) => g === null ? 0 : Math.max(-60, Math.min(120, g));
function bandOf(bands, v) { for (let i = 0; i < bands.length; i++) if (v >= bands[i][0] && v < bands[i][1]) return i; return bands.length - 1; }
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

// CORRECTED: eligible less product rows, label = issuedOwnToken
const corrected = elig.filter((p) => !isTokenProduct(p)).map((p) => ({ x: row(p), y: issuedOwnToken(p) ? 1 : 0 }));
const bC = fit(corrected);
console.log('CORRECTED universe n=' + corrected.length, 'positives=' + corrected.filter((r) => r.y).length,
  'AUC=' + auc(corrected, bC).toFixed(3), '(MODEL.md says 0.754)');

// OLD: the same rows, but every product row counted as an issuer (old labelling)
const old = elig.map((p) => ({ x: row(p), y: (p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null) ? 1 : 0 }));
const bO = fit(old);
console.log('OLD labelling   n=' + old.length, 'positives=' + old.filter((r) => r.y).length,
  'AUC=' + auc(old, bO).toFixed(3), '(MODEL.md says 0.735)');

// variant: old labelling but still excluding product rows from the universe
const oldKeepUniverse = elig.filter((p) => !isTokenProduct(p)).map((p) => ({ x: row(p), y: (p.mcap_usd !== null || p.gecko_id !== null || p.symbol !== null) ? 1 : 0 }));
console.log('OLD label, corrected universe  AUC=' + auc(oldKeepUniverse, fit(oldKeepUniverse)).toFixed(3));
