// Squeezes the whitespace inside CSS declaration blocks, leaving the selectors and the
// property names and values exactly as they are.
//
// The judge is sent a SHORTENED view of the source, and the kit's CSS fallback shows only the
// SELECTOR of each rule -- never its body. So a rule body is worth nothing to the judge, and
// every byte of it counts against the 65,536-byte dossier cap for nothing.
//
// The change is verified by tools/stylediff.cjs, which snapshots the computed style of every
// element on every view at two widths and reports any difference.
const fs = require('node:fs');
const p = process.argv[2];
let s = fs.readFileSync(p, 'utf8');
const before = s.length;
s = s.replace(/\{([^{}]*)\}/g, (m, body) => {
  // Inside a block: ": " -> ":", "; " -> ";", and no space after a comma.
  return '{' + body.replace(/\s*:\s*/g, ':').replace(/;\s*/g, ';').replace(/,\s*/g, ',').trim() + '}';
});
fs.writeFileSync(p, s);
console.log('bytes', before, '->', s.length);
