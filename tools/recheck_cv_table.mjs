// Independent check of MODEL.md section 3's CV table under the scheme MODEL.md NOW NAMES:
// folds by position five apart, age = log10(years). Written from scratch (not reusing lenscv.mjs)
// so the check does not inherit that tool's stale CLAIMS constant.
import fs from 'node:fs';
import { parseSnapshot, isEligible, isPreToken } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';

const raw = JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json', 'utf8'));
const S = parseSnapshot(JSON.stringify(raw));
const cohort = S.protocols.filter((p) => isEligible(p) && !isPreToken(p) && (p.mcap_usd ?? 0) >= 1e6 && p.tvl_usd >= 1e6);
console.log('cohort size:', cohort.length);

const clamp = (g) => g === null ? 0 : Math.max(-60, Math.min(120, g));
const ageDays = (p) => {
  if (!p.listed_at) return 365;
  const a = Date.parse(S.as_of + 'T00:00:00Z'), b = Date.parse(p.listed_at + 'T00:00:00Z');
  if (!Number.isFinite(b)) return 365;
  return Math.max(0, Math.floor((a - b) / 86400000));
};
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function solve(m, rhs) {
  const n = rhs.length;
  const A = m.map((r, i) => [...r, rhs[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.map((r, i) => r[n] / A[i][i]);
}
const G = (p) => clamp(p.change_7d) / 10;
const AGE_DAYS = (p) => Math.log10(Math.max(ageDays(p), 1));
const AGE_YEARS = (p) => Math.log10(Math.max(ageDays(p), 1) / 365.25);
function design(p, kind, ageFn) {
  const t = Math.log10(p.tvl_usd), g = G(p), a = ageFn(p);
  switch (kind) {
    case 'tvl': return [1, t];
    case 'tvg': return [1, t, g];
    case 'tvga': return [1, t, g, a];
    case 'tvg2': return [1, t, g, g * g];
    case 'tvgla2': return [1, t, g, a * a];
  }
}
function fit(rows, kind, ageFn) {
  const R = rows.map((p) => ({ x: design(p, kind, ageFn), y: Math.log10(Math.max(p.mcap_usd ?? 1, 1) / Math.max(p.tvl_usd, 1)) }));
  const k = R[0].x.length;
  let beta = new Array(k).fill(0);
  for (let it = 0; it < 24; it++) {
    const residual = (i) => { let acc = 0; for (let j = 0; j < k; j++) acc += beta[j] * R[i].x[j]; return R[i].y - acc; };
    const scale = 1.4826 * median(R.map((_, i) => Math.abs(residual(i))));
    const m = Array.from({ length: k }, () => new Array(k).fill(0)), rhs = new Array(k).fill(0);
    R.forEach((row, i) => { const r = Math.abs(residual(i)); const w = r <= 1.5 * scale ? 1 : (1.5 * scale) / r; for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) m[a][b] += w * w * row.x[a] * row.x[b]; rhs[a] += w * w * row.x[a] * row.y; } });
    for (let a = 0; a < k; a++) m[a][a] += 1e-6;
    beta = solve(m, rhs);
  }
  return beta;
}
function cv(kind, ageFn, foldFn) {
  const errs = [];
  for (let f = 0; f < 5; f++) {
    const train = cohort.filter((_, i) => foldFn(i, f, cohort.length));
    const test = cohort.filter((_, i) => !foldFn(i, f, cohort.length));
    const b = fit(train, kind, ageFn);
    for (const p of test) { const x = design(p, kind, ageFn); let acc = 0; for (let j = 0; j < b.length; j++) acc += b[j] * x[j]; errs.push(Math.abs(Math.log10(Math.max(p.mcap_usd ?? 1, 1) / Math.max(p.tvl_usd, 1)) - acc)); }
  }
  return median(errs);
}
const FOLDS = {
  'modulo 5 (as named)': (i, f) => i % 5 !== f,
  'contiguous blocks': (i, f, n) => Math.floor(i / Math.ceil(n / 5)) !== f,
  'even/odd parity': (i, f) => i % 2 !== f,
  'interleaved mod 5 offset': (i, f) => (i + 1) % 5 !== f,
};
// MODEL.md as it stands at HEAD
const PUBLISHED = [['tvl', 0.483], ['tvg', 0.420], ['tvga', 0.461], ['tvg2', 0.456], ['tvgla2', 0.472]];
const OLD = [['tvl', 0.483], ['tvg', 0.420], ['tvga', 0.461], ['tvg2', 0.517], ['tvgla2', 0.472]];

console.log('\n=== PUBLISHED TABLE (HEAD) under the scheme MODEL.md names: folds five apart, age = log10(years) ===');
for (const [kind, claim] of PUBLISHED) {
  const m = cv(kind, AGE_YEARS, FOLDS['modulo 5 (as named)']);
  console.log('  ' + kind.padEnd(8), 'published', String(claim).padEnd(7), 'measured', m.toFixed(3), Math.abs(m - claim) <= 0.004 ? 'OK' : 'MISMATCH');
}
console.log('\n=== PUBLISHED TABLE with age = log10(days) instead ===');
for (const [kind, claim] of PUBLISHED) {
  const m = cv(kind, AGE_DAYS, FOLDS['modulo 5 (as named)']);
  console.log('  ' + kind.padEnd(8), 'published', String(claim).padEnd(7), 'measured', m.toFixed(3), Math.abs(m - claim) <= 0.004 ? 'OK' : 'MISMATCH');
}
console.log('\n=== OLD TABLE (pre-fix 0.517) under the named scheme ===');
for (const [kind, claim] of OLD) {
  const m = cv(kind, AGE_YEARS, FOLDS['modulo 5 (as named)']);
  console.log('  ' + kind.padEnd(8), 'claimed', String(claim).padEnd(7), 'measured', m.toFixed(3), Math.abs(m - claim) <= 0.004 ? 'OK' : 'MISMATCH');
}
console.log('\n=== Is 0.517 reachable for tvg2 under ANY (fold, age) combo? ===');
let max = -1, argmax = '';
for (const [fname, ff] of Object.entries(FOLDS)) {
  for (const [aname, af] of [['years', AGE_YEARS], ['days', AGE_DAYS]]) {
    const m = cv('tvg2', af, ff);
    if (m > max) { max = m; argmax = `${fname} / age=${aname}`; }
  }
}
console.log('  max tvg2 measured =', max.toFixed(3), 'at', argmax, '(0.517 reachable? ' + (Math.abs(max - 0.517) <= 0.004 ? 'YES' : 'NO') + ')');
