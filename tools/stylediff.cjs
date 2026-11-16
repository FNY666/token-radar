// Compares two styleshot snapshots and reports every difference.
//
// The two snapshots are matched by a STRUCTURAL KEY (the path of tags and classes down the
// tree, plus the element's index among its same-keyed siblings), not by position, so a change
// in the number of elements in one part of the page does not report every later element as
// changed.
const fs = require('node:fs');
const a = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const b = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
let diffs = 0;
for (const view of Object.keys(a)) {
  if (!b[view]) { console.log('MISSING VIEW', view); diffs++; continue; }
  const ma = new Map(a[view]), mb = new Map(b[view]);
  // index each snapshot by (path-of-keys, ordinal among same-keyed siblings)
  function index(entries) {
    const counters = new Map();
    const out = new Map();
    for (const [k, v] of entries) {
      const key = (v.cls ? v.tag + '.' + v.cls : v.tag);
      const n = (counters.get(key) || 0);
      counters.set(key, n + 1);
      out.set(key + '#' + n, v);
    }
    return out;
  }
  const ia = index(ma), ib = index(mb);
  for (const [k, va] of ia) {
    const vb = ib.get(k);
    if (!vb) { console.log(view, 'element gone:', k, va.cls); diffs++; continue; }
    for (const p of Object.keys(va.style)) {
      if (va.style[p] !== vb.style[p]) {
        console.log(view, va.tag + '.' + (va.cls || ''), p + ':', JSON.stringify(va.style[p]), '->', JSON.stringify(vb.style[p]));
        diffs++;
      }
    }
  }
  for (const k of ib.keys()) if (!ia.has(k)) { console.log(view, 'element added:', k); diffs++; }
}
console.log(diffs === 0 ? '\nNO STYLE DIFFERENCES — the change is visually inert' : '\n' + diffs + ' STYLE DIFFERENCE(S)');
