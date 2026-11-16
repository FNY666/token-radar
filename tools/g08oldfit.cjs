// Fits the board under the OLD labelling (a row with a ticker counts as an issuer) and prints
// the result as JSON, so the before/after of G08's correction can be measured.
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = '/home/muse-newapi/makefun-token-radar/work';
const snap = require(path.join(ROOT, '..', 'token-radar-01-kit', 'input', 'snapshot.json'));

// The model module is TypeScript; the dashboard's model.js is the same fit in plain JS and it is
// importable, so the comparison runs against THAT — one implementation, two labellings.
global.window = {};
const src = fs.readFileSync(path.join(ROOT, 'dashboard', 'model.js'), 'utf8');
new Function('window', src)(global.window);
const RadarModel = global.window.RadarModel;

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

// The OLD universe: every eligible row, with the OLD label (a ticker means "issued").
const oldUniverse = snap.protocols.filter(eligible).map((p) => ({
  slug: p.slug, tvl_usd: p.tvl_usd, change_7d: p.change_7d, listed_at: p.listed_at,
  mcap_usd: p.mcap_usd, gecko_id: p.gecko_id, symbol: p.symbol,
  token: preToken(p) ? 0 : 1,
}));

// The NEW universe: the same rows minus the product rows, with the NEW label.
const issuedOwn = (p) => p.mcap_usd !== null || p.gecko_id !== null;
const newUniverse = oldUniverse.filter((p) => !(p.symbol !== null && !issuedOwn(p)))
  .map((p) => ({ ...p, token: issuedOwn(p) ? 1 : 0 }));

const cohort = snap.protocols.filter((p) => eligible(p) && !preToken(p) && (p.mcap_usd ?? 0) >= 1e6 && p.tvl_usd >= 1e6)
  .map((p) => ({ slug: p.slug, tvl_usd: p.tvl_usd, change_7d: p.change_7d, mcap_usd: p.mcap_usd, category: p.category }));

// The board's rows, under each labelling.
const boardRows = snap.protocols.filter((p) => eligible(p) && preToken(p)).map((p) => ({
  slug: p.slug, name: p.name, tvl_usd: p.tvl_usd, change_7d: p.change_7d,
  listed_at: p.listed_at, category: p.category, chains: p.chains || [],
}));

function fitFor(universe) {
  // Fit the launch model by hand with the SAME procedure, using the JS module's own pieces where
  // they are exported; otherwise fall back to a local implementation identical to model.js.
  const data = universe.map((p) => {
    const age = RadarModel.ageDays(snap.as_of, p.listed_at);
    return { x: null, y: p.token, p };
  });
  return data;
}

// Simpler and honest: run the page's own model.js twice by swapping the label semantics.
// model.js filters isTokenProduct, so for the OLD labelling we pass a universe whose symbol is
// nulled for product rows (making them "negatives") — no. Instead: implement the old fit here
// with the same maths, and assert it reproduces the NEW build's numbers via the page's own refit.

function fitLaunch(rows, asOf) {
  const DAY = 86400000;
  const AGE = [[0, 182], [182, 365], [365, 730], [730, 1460], [1460, Infinity]];
  const TVL = [[0, 1e7], [1e7, 5e7], [5e7, 2e8], [2e8, Infinity]];
  const ageOf = (listed) => {
    if (!listed) return 365;
    const a = Date.parse(asOf + 'T00:00:00Z'), b = Date.parse(listed + 'T00:00:00Z');
    return isFinite(b) ? Math.max(0, Math.floor((a - b) / DAY)) : 365;
  };
  const clamp = (g) => g === null || g === undefined ? 0 : Math.max(-60, Math.min(120, g));
  const band = (v, B) => { for (let i = 0; i < B.length; i++) if (v >= B[i][0] && v < B[i][1]) return i; return B.length - 1; };
  const row = (p) => {
    const x = [1];
    const ab = band(ageOf(p.listed_at), AGE);
    const tb = band(p.tvl_usd, TVL);
    for (let i = 0; i < AGE.length; i++) x.push(i === ab ? 1 : 0);
    for (let j = 0; j < TVL.length; j++) x.push(j === tb ? 1 : 0);
    x.push(clamp(p.change_7d) / 10);
    return x;
  };
  const data = rows.map((p) => ({ x: row(p), y: p.token }));
  const k = data[0].x.length;
  const beta = new Array(k).fill(0);
  for (let it = 0; it < 400; it++) {
    const g = new Array(k).fill(0);
    for (const r of data) {
      let z = 0;
      for (let j = 0; j < k; j++) z += beta[j] * r.x[j];
      const err = r.y - 1 / (1 + Math.exp(-z));
      for (let i = 0; i < k; i++) g[i] += err * r.x[i];
    }
    for (let j = 0; j < k; j++) beta[j] += (0.6 * g[j]) / data.length;
  }
  const pos = data.filter((r) => r.y === 1), neg = data.filter((r) => r.y === 0);
  let hits = 0;
  for (const p of pos) {
    let zp = 0; for (let i = 0; i < k; i++) zp += beta[i] * p.x[i];
    for (const n of neg) { let zn = 0; for (let j = 0; j < k; j++) zn += beta[j] * n.x[j]; hits += zp > zn ? 1 : (zp === zn ? 0.5 : 0); }
  }
  return { beta, auc: pos.length && neg.length ? hits / (pos.length * neg.length) : 0.5 };
}

// The OLD fit, and the OLD launch probability per board row.
const oldFit = fitLaunch(oldUniverse, snap.as_of);
const newFit = fitLaunch(newUniverse, snap.as_of);

function launchP(fit, p) {
  const DAY = 86400000;
  const AGE = [[0, 182], [182, 365], [365, 730], [730, 1460], [1460, Infinity]];
  const TVL = [[0, 1e7], [1e7, 5e7], [5e7, 2e8], [2e8, Infinity]];
  const ageOf = (listed) => {
    if (!listed) return 365;
    const a = Date.parse(snap.as_of + 'T00:00:00Z'), b = Date.parse(listed + 'T00:00:00Z');
    return isFinite(b) ? Math.max(0, Math.floor((a - b) / DAY)) : 365;
  };
  const clamp = (g) => g === null || g === undefined ? 0 : Math.max(-60, Math.min(120, g));
  const band = (v, B) => { for (let i = 0; i < B.length; i++) if (v >= B[i][0] && v < B[i][1]) return i; return B.length - 1; };
  const x = [1];
  const ab = band(ageOf(p.listed_at), AGE), tb = band(p.tvl_usd, TVL);
  for (let i = 0; i < AGE.length; i++) x.push(i === ab ? 1 : 0);
  for (let j = 0; j < TVL.length; j++) x.push(j === tb ? 1 : 0);
  x.push(clamp(p.change_7d) / 10);
  let z = 0;
  for (let j = 0; j < fit.beta.length; j++) z += fit.beta[j] * x[j];
  return Math.max(0.05, Math.min(0.95, 1 / (1 + Math.exp(-z))));
}

// The value model: reuse the page's own model.js via its exported fit? It needs the cohort with
// mcap_usd. Build it the same way main.ts does.
const cohortRows = cohort.map((p) => ({ ...p, mcap_usd: p.mcap_usd }));
const model = RadarModel.fit({ cohort: cohortRows, universe: newUniverse.map((p) => ({ ...p })), as_of: snap.as_of });

const rows = boardRows.map((p) => {
  const oldP = Math.round(launchP(oldFit, p) * 1e6) / 1e6;
  const newP = Math.round(launchP(newFit, p) * 1e6) / 1e6;
  const cond = model.conditional(p.tvl_usd, p.change_7d, p.category);
  return {
    slug: p.slug, name: p.name,
    launch_probability: oldP,
    implied_value_usd: Math.round(cond * oldP),
    conditional_value_usd: cond,
  };
});
// rank by implied value, the way the board is ranked
const ranked = rows.slice().sort((a, b) => b.implied_value_usd - a.implied_value_usd);
ranked.forEach((r, i) => { r.rank = i + 1; });

console.log(JSON.stringify({
  calibration: { launch_auc: oldFit.auc, universe_size: oldUniverse.length },
  rows: ranked,
}));
