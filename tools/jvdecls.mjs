// What the judge reads, per file: the declaration lines it sees and the body lines it loses.
//
//   node tools/jvdecls.mjs <judge-view-file>
//
// The judge is told: "When you speak of code, name the function." So the function names in the
// view are the handles a judge uses to talk about the entry.
import fs from 'node:fs';

const view = fs.readFileSync(process.argv[2] || '/tmp/judgeview.txt', 'utf8');
const files = [...view.matchAll(/^### (\S+) \(([^)]*)\)$/gm)].map((m) => m[1]);
console.log('files in the view:', files.join(', '));
for (const f of files) {
  const i = view.indexOf(`### ${f} `);
  const start = view.indexOf('\n', view.indexOf('```', i)) + 1;
  const end = view.indexOf('```', start);
  const seg = view.slice(start, end);
  const lines = seg.split('\n');
  const decls = lines.filter((l) => /^\s*(function |var |const |let |class |[A-Za-z_$][\w$]*\s*[:=]\s*function|[A-Za-z_$][\w$]*\s*:\s*function)/.test(l));
  console.log(`\n--- ${f}: ${lines.length} lines in the view`);
  for (const d of decls) console.log('    ' + d.trim().slice(0, 110));
}
