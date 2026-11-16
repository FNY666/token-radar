// Merges CSS rules that have IDENTICAL declaration bodies into one rule with a combined
// selector list. The result is proven inert by tools/stylediff.cjs (a computed-style snapshot
// of every element on every view, at two widths).
const fs = require('node:fs');
const p = process.argv[2];
let s = fs.readFileSync(p, 'utf8');
// Split into a list of [selector, body, raw] keeping order, and treat @media as opaque.
const parts = [];
let i = 0;
while (i < s.length) {
  const brace = s.indexOf('{', i);
  if (brace < 0) { parts.push({ raw: s.slice(i) }); break; }
  const sel = s.slice(i, brace);
  if (sel.trim().startsWith('@')) {
    // find the matching close brace of the at-rule
    let depth = 1, j = brace + 1;
    while (j < s.length && depth > 0) { if (s[j] === '{') depth++; else if (s[j] === '}') depth--; j++; }
    parts.push({ raw: s.slice(i, j) });
    i = j; continue;
  }
  const close = s.indexOf('}', brace);
  parts.push({ sel: sel.trim(), body: s.slice(brace + 1, close), raw: s.slice(i, close + 1) });
  i = close + 1;
}
const byBody = new Map();
for (const pt of parts) {
  if (!pt.sel) continue;
  const key = pt.body.replace(/\s+/g, ' ').trim();
  if (!key) continue;
  if (!byBody.has(key)) byBody.set(key, []);
  byBody.get(key).push(pt);
}
let merged = 0, saved = 0;
const out = [];
for (const pt of parts) {
  if (!pt.sel) { out.push(pt.raw); continue; }
  const key = pt.body.replace(/\s+/g, ' ').trim();
  const group = byBody.get(key);
  if (group.length < 2) { out.push(pt.raw); continue; }
  if (group[0] !== pt) continue; // only the first of a group emits
  const selList = group.map(g => g.sel).join(',');
  const raw = selList + '{' + group[0].body + '}';
  merged += group.length - 1;
  saved += group.slice(1).reduce((a, g) => a + g.raw.length, 0) - (selList.length - group[0].sel.length);
  out.push(raw);
}
const result = out.join('');
fs.writeFileSync(p, result);
console.log('merged', merged, 'rules; bytes', s.length, '->', result.length);
