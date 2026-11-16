// G08's claim, measured against the real snapshot:
//   rows that carry a ticker's symbol but no market cap or CoinGecko id of their own are
//   PRODUCTS of whoever issued, not issuers — so they must not be labelled 1 in the launch fit.
const snap = require('../../token-radar-01-kit/input/snapshot.json');

const DERIV = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Cross Chain Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'Anchor BTC']);
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED = /\b(wrapped|staked|staking)\b/i;
const EXCHANGE = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

const eligible = (p) => {
  if (p.category !== null && DERIV.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED.test(p.name)) return false;
  if (EXCHANGE.test(p.name)) return false;
  return true;
};
const preToken = (p) => p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
const issuedOwn = (p) => p.mcap_usd !== null || p.gecko_id !== null;
const isProduct = (p) => p.symbol !== null && !issuedOwn(p);

const all = snap.protocols;
const el = all.filter(eligible);

console.log('=== THE UNIVERSE ===');
console.log('all protocols                ', all.length);
console.log('eligible (the launch universe)', el.length);

const oldLabel = (p) => (preToken(p) ? 0 : 1);
const oldPos = el.filter((p) => oldLabel(p) === 1);
const oldNeg = el.filter((p) => oldLabel(p) === 0);

const newU = el.filter((p) => !isProduct(p));
const newPos = newU.filter((p) => issuedOwn(p));
const newNeg = newU.filter((p) => !issuedOwn(p));

console.log('\n=== LABELS ===');
console.log('OLD  positives (labelled 1)  ', oldPos.length);
console.log('OLD  negatives (labelled 0)  ', oldNeg.length);
console.log('OLD  positives that are really PRODUCTS (a ticker, no mcap/id of its own):',
  oldPos.filter(isProduct).length);
console.log('NEW  positives               ', newPos.length);
console.log('NEW  negatives               ', newNeg.length);
console.log('NEW  rows left out           ', el.length - newU.length);

console.log('\n=== WHICH ROWS CHANGE LABEL ===');
const changed = oldPos.filter(isProduct);
const byName = {};
for (const p of changed) byName[p.symbol] = (byName[p.symbol] || 0) + 1;
console.log('the wrongly-labelled issuers, by ticker:');
for (const [sym, n] of Object.entries(byName).sort((a, b) => b[1] - a[1])) {
  console.log('  ' + sym.padEnd(10), n, 'rows');
}
console.log('\nsamples:', changed.slice(0, 14).map((p) => p.name).join(' | '));

console.log('\n=== HOW MUCH DOES THE POSITIVE RATE MOVE? ===');
console.log('OLD base rate', (oldPos.length / el.length * 100).toFixed(1) + '%');
console.log('NEW base rate', (newPos.length / newU.length * 100).toFixed(1) + '%');

// --- WHICH WAY DOES THE BIAS GO? ---
// A product row is old and big by construction (a pool of a protocol that already issued).
// If those are labelled as issuers, the fit learns "old and big => issues", which is exactly
// what the board is trying to measure.
const prod = el.filter(isProduct);
const real = el.filter(p => issuedOwn(p));
const pre = el.filter(preToken);
function med(a){const s=a.slice().sort((x,y)=>x-y);return s.length?s[Math.floor(s.length/2)]:0;}
function ageOf(p){if(!p.listed_at)return null;const a=Date.parse(snap.as_of+'T00:00:00Z'),b=Date.parse(p.listed_at+'T00:00:00Z');return isFinite(b)?Math.floor((a-b)/86400000):null;}
function stats(rows,label){
  const ages=rows.map(ageOf).filter(x=>x!==null);
  const tvls=rows.map(p=>p.tvl_usd);
  console.log(label.padEnd(28), 'n='+String(rows.length).padStart(3),
    'median age='+String(med(ages)).padStart(5)+'d',
    'median TVL=$'+Math.round(med(tvls)/1e6)+'M');
}
console.log('\n=== WHICH WAY THE BIAS GOES ===');
stats(real,'really issued');
stats(prod,'product rows (mislabelled)');
stats(pre,'pre-token (real negatives)');
