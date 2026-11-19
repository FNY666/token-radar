// A quiet look at the dataset: a little JSON in, a little JSON out, so a shell command can ask
// the dataset a question without printing the whole of it.
//
//   node tools/peek.mjs '<js expression over D>'   e.g. "'chain:' + D.rows.filter(r=>r.category==='Chain').length"
import fs from 'node:fs';
const raw = fs.readFileSync(new URL('../out/data.js', import.meta.url), 'utf8');
const D = JSON.parse(raw.replace(/^window\.RADAR\s*=\s*/, '').replace(/;\s*$/, ''));
const expr = process.argv[2];
const out = new Function('D', 'return (' + expr + ');')(D);
console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
