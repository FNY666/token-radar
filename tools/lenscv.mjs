// Verify MODEL.md section 3's cross-validation table using the ENTRY'S OWN fit routine
// (Huber-weighted IRLS as in lib/model.ts fitValueModel), with five-fold CV by modulo-5.
import fs from 'node:fs';
import { parseSnapshot, isEligible, isPreToken } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';

const raw = JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json', 'utf8'));
const S = parseSnapshot(JSON.stringify(raw));
const cohort = S.protocols.filter((p) => isEligible(p) && !isPreToken(p) && (p.mcap_usd ?? 0) >= 1e6 && p.tvl_usd >= 1e6);
console.log('cohort size:', cohort.length, '(MODEL.md says 75)');

const clamp = (g) => g === null ? 0 : Math.max(-60, Math.min(120, g));
const ageOf = (p) => { if (!p.listed_at) return 365; const a = Date.parse(S.as_of + 'T00:00:00Z'), b = Date.parse(p.listed_at + 'T00:00:00Z'); if (!Number.isFinite(b)) return 365; return Math.max(0, Math.floor((a - b) / 86400000)); };
const median = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function solve(matrix, rhs) {
  const n = rhs.length;
  const A = matrix.map((r, i) => [...r, rhs[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k];
    }
  }
  return A.map((r, i) => r[n] / A[i][i]);
}

// design vectors, mirroring lib/model.ts valueRow but with the alternative forms MODEL.md lists
function design(p, kind) {
  const t = Math.log10(p.tvl_usd);
  const g = clamp(p.change_7d) / 10;
  const age = Math.log10(Math.max(ageOf(p), 1));
  switch (kind) {
    case 'tvl': return [1, t];
    case 'tvg': return [1, t, g];
    case 'tvga': return [1, t, g, age];
    case 'tvg2': return [1, t, g, g * g];
    case 'tvgla2': return [1, t, g, age * age];
  }
}
function fitValueModel(rows, kind) {
  const R = rows.map((p) => ({ x: design(p, kind), y: Math.log10(Math.max(p.mcap_usd ?? 1, 1) / Math.max(p.tvl_usd, 1)) }));
  const k = R[0].x.length;
  let beta = new Array(k).fill(0);
  for (let iteration = 0; iteration < 24; iteration++) {
    const residual = (i) => { let acc = 0; for (let j = 0; j < k; j++) acc += beta[j] * R[i].x[j]; return R[i].y - acc; };
    const scale = 1.4826 * median(R.map((_, i) => Math.abs(residual(i))));
    const matrix = Array.from({ length: k }, () => new Array(k).fill(0));
    const rhs = new Array(k).fill(0);
    R.forEach((row, i) => {
      const r = Math.abs(residual(i));
      const w = r <= 1.5 * scale ? 1 : (1.5 * scale) / r;
      for (let a = 0; a < k; a++) { for (let b = 0; b < k; b++) matrix[a][b] += w * w * row.x[a] * row.x[b]; rhs[a] += w * w * row.x[a] * row.y; }
    });
    for (let a = 0; a < k; a++) matrix[a][a] += 1e-6;
    beta = solve(matrix, rhs);
  }
  return beta;
}
function cv(kind, foldRule) {
  const errs = [];
  for (let f = 0; f < 5; f++) {
    const train = cohort.filter((_, i) => i % 5 !== f);
    const test = cohort.filter((_, i) => i % 5 === f);
    const b = fitValueModel(train, kind);
    for (const p of test) {
      const x = design(p, kind);
      let acc = 0; for (let j = 0; j < b.length; j++) acc += b[j] * x[j];
      errs.push(Math.abs(Math.log10(Math.max(p.mcap_usd ?? 1, 1) / Math.max(p.tvl_usd, 1)) - acc));
    }
  }
  return median(errs);
}
const CLAIMS = [['tvl', 0.483], ['tvg', 0.420], ['tvga', 0.461], ['tvg2', 0.517], ['tvgla2', 0.472]];
console.log('');
console.log('design                  claimed   measured    verdict');
for (const [kind, claim] of CLAIMS) {
  const m = cv(kind);
  const ok = Math.abs(m - claim) <= 0.004;
  console.log('  ' + kind.padEnd(20), String(claim).padEnd(8), m.toFixed(3).padEnd(10), ok ? 'ok' : 'MISMATCH');
}
