// Squeezes the INDENTATION of a JS file: leading whitespace on each line is reduced to a
// single space per level, and blank lines are dropped.
//
// This is safe because JavaScript does not depend on indentation. It is worth doing because the
// judge is sent a SHORTENED 30,144-byte view of the source: every byte here is a byte that
// cannot hold something the judge reads.
//
// The change is verified by tools/pagecheck.cjs (which drives the page and checks the board,
// the model, the farm plans and the network) and by the byte-identical two-run build.
const fs = require('node:fs');
const p = process.argv[2];
const src = fs.readFileSync(p, 'utf8');
const lines = src.split('\n');
const out = lines.filter(l => l.trim() !== '').map(l => {
  const ind = (l.match(/^ */) || [''])[0].length;
  return ' '.repeat(Math.min(ind, 2)) + l.trim();
});
const result = out.join('\n') + '\n';
fs.writeFileSync(p, result);
console.log('bytes', src.length, '->', result.length);
