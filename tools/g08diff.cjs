// What G08's label correction did to the board: the ranks before and after, and the rows
// that moved. Compares the current build against the build that preceded the correction.
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = '/home/muse-newapi/makefun-token-radar/work';
const OUT = path.join(ROOT, 'out');

function load(dir) {
  global.window = {};
  delete require.cache[require.resolve(path.join(dir, 'data.js'))];
  require(path.join(dir, 'data.js'));
  return global.window.RADAR;
}

const now = load(OUT);

// Rebuild the old labelling from the same data: relabel the universe and refit.
const { execFileSync } = require('node:child_process');
const old = JSON.parse(execFileSync('node', [path.join(ROOT, 'tools', 'g08oldfit.cjs')], { encoding: 'utf8' }));

const before = new Map(old.rows.map((r) => [r.slug, r]));
const after = new Map(now.rows.map((r) => [r.slug, r]));

console.log('=== THE BOARD BEFORE AND AFTER ===');
console.log('rows:', before.size, '->', after.size);
console.log('AUC :', old.calibration.launch_auc, '->', now.calibration.launch_auc);

const moved = [];
for (const [slug, r] of after) {
  const b = before.get(slug);
  if (!b) continue;
  if (b.rank !== r.rank) moved.push({ name: r.name, from: b.rank, to: r.rank, shift: b.rank - r.rank,
    pBefore: b.launch_probability, pAfter: r.launch_probability,
    vBefore: b.implied_value_usd, vAfter: r.implied_value_usd });
}
moved.sort((a, b) => a.to - b.to);
console.log('\nrows whose rank changed:', moved.length, 'of', after.size);

console.log('\n=== THE BIGGEST CLIMBERS (a smaller rank is a higher place) ===');
for (const m of moved.slice(0, 12)) {
  console.log(String(m.from).padStart(4), '->', String(m.to).padStart(4), '  ' + m.name.padEnd(28),
    'odds', m.pBefore.toFixed(3), '->', m.pAfter.toFixed(3),
    ' value $' + Math.round(m.vBefore / 1e6) + 'M -> $' + Math.round(m.vAfter / 1e6) + 'M');
}
console.log('\n=== THE BIGGEST FALLERS ===');
for (const m of moved.slice(-8).reverse()) {
  console.log(String(m.from).padStart(4), '->', String(m.to).padStart(4), '  ' + m.name.padEnd(28),
    'odds', m.pBefore.toFixed(3), '->', m.pAfter.toFixed(3),
    ' value $' + Math.round(m.vBefore / 1e6) + 'M -> $' + Math.round(m.vAfter / 1e6) + 'M');
}

// How many of the watchlist's 40 moved?
const wl = now.rows.filter((r) => r.on_watchlist);
const wlMoved = wl.filter((r) => before.get(r.slug) && before.get(r.slug).rank !== r.rank);
console.log('\nwatchlist rows that moved:', wlMoved.length, 'of', wl.length);

// The odds level: did the whole board shift, or only some of it?
const pbs = now.rows.map((r) => before.get(r.slug) ? before.get(r.slug).launch_probability : 0);
const pas = now.rows.map((r) => r.launch_probability);
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
console.log('mean launch probability:', avg(pbs).toFixed(4), '->', avg(pas).toFixed(4));
