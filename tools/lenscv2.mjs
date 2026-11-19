// Robustness check for MODEL.md section 3's CV table: try the plausible readings of each design
// and each fold scheme, and see whether ANY of them reproduces the published 0.517 and 0.472.
import fs from 'node:fs';
import { parseSnapshot, isEligible, isPreToken } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';

const raw = JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json', 'utf8'));
const S = parseSnapshot(JSON.stringify(raw));
const cohort = S.protocols.filter((p) => isEligible(p) && !isPreToken(p) && (p.mcap_usd ?? 0) >= 1e6 && p.tvl_usd >= 1e6);

const clamp = (g) => g === null ? 0 : Math.max(-60, Math.min(120, g));
const ageDays = (p) => { if (!p.listed_at) return 365; const a = Date.parse(S.as_of + 'T00:00:00Z'), b = Date.parse(p.listed_at + 'T00:00:00Z'); if (!Number.isFinite(b)) return 365; return Math.max(0, Math.floor((a - b) / 86400000)); };
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
function solve(matrix, rhs) {
  const n = rhs.length;
  const A = matrix.map((r, i) => [...r, rhs[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < n; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
  }
  return A.map((r, i) => r[n] / A[i][i]);
}
// growth scalings and age scalings to try
const G = {
  'g/10 (the model\'s)': (p) => clamp(p.change_7d) / 10,
  'g/100': (p) => clamp(p.change_7d) / 100,
  'g raw': (p) => clamp(p.change_7d),
  'g/10, no clamp': (p) => (p.change_7d ?? 0) / 10,
};
const A = {
  'log10(days)': (p) => Math.log10(Math.max(ageDays(p), 1)),
  'log10(years)': (p) => Math.log10(Math.max(ageDays(p), 1) / 365.25),
  'log10(days+1)': (p) => Math.log10(ageDays(p) + 1),
};
function design(p, kind, gk, ak) {
  const t = Math.log10(p.tvl_usd);
  const g = G[gk](p);
  const a = A[ak](p);
  switch (kind) {
    case 'tvl': return [1, t];
    case 'tvg': return [1, t, g];
    case 'tvga': return [1, t, g, a];
    case 'tvg2': return [1, t, g, g * g];
    case 'tvgla2': return [1, t, g, a * a];
  }
}
function fit(rows, kind, gk, ak) {
  const R = rows.map((p) => ({ x: design(p, kind, gk, ak), y: Math.log10(Math.max(p.mcap_usd ?? 1, 1) / Math.max(p.tvl_usd, 1)) }));
  const k = R[0].x.length;
  let beta = new Array(k).fill(0);
  for (let it = 0; it < 24; it++) {
    const residual = (i) => { let acc = 0; for (let j = 0; j < k; j++) acc += beta[j] * R[i].x[j]; return R[i].y - acc; };
    const scale = 1.4826 * median(R.map((_, i) => Math.abs(residual(i))));
    const m = Array.from({ length: k }, () => new Array(k).fill(0)); const rhs = new Array(k).fill(0);
    R.forEach((row, i) => { const r = Math.abs(residual(i)); const w = r <= 1.5 * scale ? 1 : (1.5 * scale) / r; for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) m[a][b] += w * w * row.x[a] * row.x[b]; rhs[a] += w * w * row.x[a] * row.y; } });
    for (let a = 0; a < k; a++) m[a][a] += 1e-6;
    beta = solve(m, rhs);
  }
  return beta;
}
const FOLDS = {
  'modulo 5': (i, f) => i % 5 !== f,
  'contiguous blocks': (i, f, n) => Math.floor(i / Math.ceil(n / 5)) !== f,
  'even/odd parity': (i, f) => i % 2 !== f,
  'interleaved mod 5, offset': (i, f) => (i + 1) % 5 !== f,
  'leave-one-out': (i, f, n) => i !== f,
  'modulo 3': (i, f) => i % 3 !== f,
  'modulo 10': (i, f) => i % 10 !== f,
};
function cv(kind, gk, ak, foldName) {
  const errs = [];
  const f = FOLDS[foldName];
  const NF = foldName === 'leave-one-out' ? cohort.length : foldName === 'modulo 3' ? 3 : foldName === 'modulo 10' ? 10 : 5;
  for (let k = 0; k < NF; k++) {
    const train = cohort.filter((_, i) => f(i, k, cohort.length));
    const test = cohort.filter((_, i) => !f(i, k, cohort.length));
    if (!test.length || !train.length) continue;
    const b = fit(train, kind, gk, ak);
    for (const p of test) { const x = design(p, kind, gk, ak); let acc = 0; for (let j = 0; j < b.length; j++) acc += b[j] * x[j]; errs.push(Math.abs(Math.log10(Math.max(p.mcap_usd ?? 1, 1) / Math.max(p.tvl_usd, 1)) - acc)); }
  }
  return median(errs);
}
const CLAIMS = [['tvl', 0.483], ['tvg', 0.420], ['tvga', 0.461], ['tvg2', 0.517], ['tvgla2', 0.472]];
// lock the age scaling to log10(years) and the fold to modulo 5, then print one clean table
console.log('kind     gk                 ak                fold                measured   claimed');
for (const [kind, claim] of CLAIMS) {
  const gks = kind === 'tvg2' || kind === 'tvgla2' ? Object.keys(G) : ["g/10 (the model's)"];
  const aks = kind === 'tvga' || kind === 'tvgla2' ? Object.keys(A) : ['log10(days)'];
  for (const gk of gks) for (const ak of aks) for (const fold of Object.keys(FOLDS)) {
    const m = cv(kind, gk, ak, fold);
    const flag = Math.abs(m - claim) <= 0.004 ? '  <= MATCH' : '';
    console.log(kind.padEnd(8), gk.padEnd(18), ak.padEnd(17), fold.padEnd(20), m.toFixed(3), '  ', claim, flag);
  }
  console.log('');
}

console.log('=== THE TABLE UNDER ONE CONSISTENT READING: age = log10(years), folds = modulo 5 ===');
for (const [kind, claim] of CLAIMS) {
  const gk = "g/10 (the model's)";
  const ak = (kind === 'tvga' || kind === 'tvgla2') ? 'log10(years)' : 'log10(days)';
  const m = cv(kind, gk, ak, 'modulo 5');
  console.log('  ' + kind.padEnd(8), 'claimed', String(claim).padEnd(7), 'measured', m.toFixed(3), Math.abs(m-claim)<=0.004?'OK':'MISMATCH');
}
