// WHAT THE JUDGE SEES: the kit's own judge view, per file, with the line at which each file stops.
//
// The live heat path (plannedHeatView -> dossierJudgeViewAt) sends the judge a COMPRESSED view:
// every file's declaration lines, then whole file bodies in path order as far as the 30,144-byte
// budget allows. A file that does not fit whole is shown as its declarations only.
//
//   node tools/jvview.mjs            -- report the current dashboard's judge view
//
// This reproduces the kit's own algorithm, lifted from cli/makefun.mjs at run time, so it cannot
// drift from what the house does.
import fs from 'node:fs';

const KIT = '/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs';
const kit = fs.readFileSync(KIT, 'utf8');

function grab(name) {
  const marker = 'function ' + name + '(';
  const i = kit.indexOf(marker);
  if (i < 0) throw new Error('kit function not found: ' + name);
  const rest = kit.slice(i + marker.length);
  const m = /\n(?:function |var [A-Za-z_$][\w$]*, |var [A-Za-z_$][\w$]*;|\/\/ )/.exec(rest);
  const end = m ? i + marker.length + m.index + 1 : kit.length;
  return kit.slice(i, end).replace(/\nvar [^\n]*;\s*$/, '\n');
}

const NAMES = [
  'familyImageTokens', 'judgeImageTokens', 'sheetCell', 'restCell', 'languageOf2',
  'readKitText', 'jsDeclares', 'declarationLines', 'capped', 'cutLine', 'firstLine15',
  'fitLines', 'keptHead', 'viewText',
];
const prelude = `
const utf8Bytes4 = (s3) => Buffer.byteLength(s3, "utf8");
const jsonBytes = (s3) => utf8Bytes4(JSON.stringify(s3)) - 2;
const plural8 = (n9, one, many) => (many === undefined ? one + "s" : many);
const HEAD_KEPT = /^(#{1,6}\\s|(Source files|Files|Scripts|Instances|Totals):\\s)/;
const DECL_MAX_BYTES = 96;
const FENCE_OPEN2 = /^(\`{3,}|~{3,})\\s*([A-Za-z0-9_+.-]*)\\s*$/;
const JS_KEYWORDS2 = new Set(["if","for","while","switch","catch","with","return","function","else","do","try","new","typeof","await","yield","super","delete","void","throw","in","of"]);
const vendored = (s3) => /(^|\\/)vendor\\//.test(s3.heading.slice(4).split(" (")[0] ?? "");
const linesCost = (lines2) => lines2.reduce((n9, l2) => n9 + jsonBytes(\`\${l2}\n\`), 0);
const DOSSIER_VIEW_ENTRY_TOKENS = 1536;
const DOSSIER_VIEW_BUDGETS = Object.freeze({ "token-radar-01": 12288 });
const SPLIT_ENTRY_TOKENS = 4096;
const VIEW_PRICING_MODEL = "superbot";
const SHEET_WIDTH = 768;
const COVER_BOX = { width: 768, height: 480 };
const GAP = 4;
const LARGE_COVER_BOX = { width: 1024, height: 640 };
const REST_BOX = { width: 1024, height: 640 };
const OPENAI_PATCH_MULTIPLIERS = [];
`;
const K = new Function(prelude + '\n' + NAMES.map(grab).join('\n\n') + '\nreturn {' + NAMES.map((n) => n + ': ' + n).join(', ') + '};')();

const DIR = process.argv[2] || 'dashboard';
const BUDGET = 30144;
const names = fs.readdirSync(DIR).filter(n => /\.(css|html|js)$/.test(n)).sort();

const files = names.map((n) => {
  const text = fs.readFileSync(`${DIR}/${n}`, 'utf8');
  return { name: n, text, bytes: Buffer.byteLength(text), lines: text.replace(/\n$/, '').split('\n') };
});
const head = [
  '## Dashboard', '',
  `Files: ${files.length} (${files.reduce((n, f) => n + f.bytes, 0)} bytes)`,
  ...files.map((f) => `- ${f.name} (${f.bytes} bytes)`), '', '## Source', '', '',
].join('\n');
let text = head;
for (const f of files) {
  const fence = f.name.endsWith('.css') ? 'css' : f.name.endsWith('.html') ? 'html' : 'js';
  text += `### ${f.name}\n\n${f.bytes} bytes, ${f.lines.length} line${f.lines.length === 1 ? '' : 's'}\n\n\`\`\`${fence}\n${f.text}${f.text.endsWith('\n') ? '' : '\n'}\`\`\`\n\n`;
}

const r = K.viewText(text, BUDGET, 3, true);
const out = r.text;
console.log(`judge view: ${Buffer.byteLength(out)} bytes, form ${r.form}, ${r.decls} declaration lines, ${r.bodies} files shown whole`);
for (const f of files) {
  let best = 0;
  for (let i = 1; i <= f.lines.length; i++) {
    if (out.includes(f.lines.slice(0, i).join('\n'))) best = i;
    else break;
  }
  const whole = best === f.lines.length;
  console.log(
    `  ${f.name.padEnd(13)} ${String(best).padStart(4)}/${String(f.lines.length).padEnd(4)} lines` +
    (whole ? '  (whole)' : best === 0 ? '  (declarations only)' : `  (body cut at line ${best + 1})`)
  );
  if (!whole && best > 0 && f.name === 'page.js') {
    console.log(`      next line: ${JSON.stringify(f.lines[best])}`);
  }
}
