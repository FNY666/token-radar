// Compares two styleshot snapshots and reports every difference.
const fs = require('node:fs');
const a = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const b = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
let diffs = 0;
for (const view of Object.keys(a)) {
  if (!b[view]) { console.log('MISSING VIEW', view); diffs++; continue; }
  const ma = new Map(a[view]), mb = new Map(b[view]);
  for (const [k, va] of ma) {
    const vb = mb.get(k);
    if (!vb) { console.log(view, 'element gone:', k, va.cls); diffs++; continue; }
    for (const p of Object.keys(va.style)) {
      if (va.style[p] !== vb.style[p]) {
        console.log(view, va.tag + '.' + (va.cls || ''), p + ':', JSON.stringify(va.style[p]), '->', JSON.stringify(vb.style[p]));
        diffs++;
      }
    }
  }
  for (const k of mb.keys()) if (!ma.has(k)) { console.log(view, 'element added:', k); diffs++; }
}
console.log(diffs === 0 ? '\nNO STYLE DIFFERENCES — the change is visually inert' : '\n' + diffs + ' STYLE DIFFERENCE(S)');
