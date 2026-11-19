// Test the claim "no protocol's name is special": perturb the snapshot's NAMES and SLUGS only
// (no figures touched) and check every scored row's implied value is unchanged.
import fs from 'node:fs';
import { parseSnapshot, calibrate, buildBoard } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';

const snap = JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json', 'utf8'));

// Rename every protocol and re-slug it. The model must score the renamed protocols identically.
const renamed = {
  ...snap,
  protocols: snap.protocols.map((p, i) => ({ ...p, name: 'ZZZ Protocol ' + i, slug: 'zzz-' + i })),
  watchlist: snap.watchlist.map((s, i) => 'zzz-' + snap.protocols.findIndex((p) => p.slug === s)),
};
const calA = calibrate(parseSnapshot(JSON.stringify(snap)));
const calB = calibrate(parseSnapshot(JSON.stringify(renamed)));
const A = buildBoard(parseSnapshot(JSON.stringify(snap)), calA);
const B = buildBoard(parseSnapshot(JSON.stringify(renamed)), calB);

// map renamed rows back to the original index by position in the renamed slug
let diff = 0, worst = 0, worstSlug = '';
const aByPos = new Map(A.map((r, k) => [k, r]));
for (const r of B) {
  const i = Number(r.slug.replace('zzz-', ''));
  const orig = aByPos.get(i);
  if (!orig) continue;
  if (orig.implied_value_usd !== r.implied_value_usd) { diff++; const g = Math.abs(orig.implied_value_usd - r.implied_value_usd); if (g > worst) { worst = g; worstSlug = orig.slug; } }
}
console.log('rows scored A:', A.length, 'B:', B.length);
console.log('rows whose implied value changed after renaming every protocol:', diff, 'worst gap', worst, worstSlug);
console.log('sample renamed row:', JSON.stringify({ slug: B[0].slug, name: B[0].name, implied: B[0].implied_value_usd, orig: A[0].implied_value_usd }));
