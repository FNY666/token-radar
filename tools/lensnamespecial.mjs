// Test the model's claim directly: does scoreProtocol's output depend on the protocol's NAME or
// SLUG? Rename one protocol and re-score it; the implied value must not move.
import fs from 'node:fs';
import { parseSnapshot, calibrate, scoreProtocol } from '/home/muse-newapi/makefun-token-radar/work/lib/model.ts';

const snap = JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json', 'utf8'));
const cal = calibrate(parseSnapshot(JSON.stringify(snap)));
const p = snap.protocols.find((x) => x.slug === 'steakhouse-financial');
const before = scoreProtocol(p, snap.as_of, cal);
const renamed = { ...p, name: 'Totally Different Name', slug: 'zzz-9999' };
const after = scoreProtocol(renamed, snap.as_of, cal);
console.log('original:', JSON.stringify(before));
console.log('renamed :', JSON.stringify(after));
console.log('identical:', JSON.stringify(before) === JSON.stringify(after));

// and the calibration itself: rename only protocols whose names do NOT change eligibility
// (keep a name that trips no rule), then check the fitted coefficients are identical.
const ELIG = (pp) => {
  const DERIV = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Cross Chain Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'Anchor BTC']);
  const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
  const WRAP = /\b(wrapped|staked|staking)\b/i;
  const EX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;
  return !(pp.category && DERIV.has(pp.category)) && !VERSIONED.test(pp.name) && !WRAP.test(pp.name) && !EX.test(pp.name);
};
const same = snap.protocols.map((x) => ({ ...x, name: 'Protocol ' + x.slug.replace(/[^a-z0-9]/gi, '') }));
const cal2 = calibrate(parseSnapshot(JSON.stringify({ ...snap, protocols: same })));
console.log('cohort size before/after:', cal.cohort_size, cal2.cohort_size);
console.log('value_beta before:', JSON.stringify(cal.value_beta));
console.log('value_beta after :', JSON.stringify(cal2.value_beta));
console.log('beta identical:', JSON.stringify(cal.value_beta) === JSON.stringify(cal2.value_beta));
console.log('launch_beta identical:', JSON.stringify(cal.launch_beta) === JSON.stringify(cal2.launch_beta));
console.log('category_log identical:', JSON.stringify(cal.category_log) === JSON.stringify(cal2.category_log));
