// Reports exactly which lines of each dashboard file the JUDGE sees whole, and where the
// judge view falls back to declarations only.
const fs = require('node:fs');
const { execSync } = require('node:child_process');
const KIT = '/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs';
const kit = fs.readFileSync(KIT, 'utf8');
function grab(name) {
  const marker = 'function ' + name + '(';
  const i = kit.indexOf(marker);
  const rest = kit.slice(i + marker.length);
  const m = /\n(?:function |var [A-Za-z_$][\w$]*, |var [A-Za-z_$][\w$]*;|\/\/ )/.exec(rest);
  const end = m ? i + marker.length + m.index + 1 : kit.length;
  return kit.slice(i, end).replace(/\nvar [^\n]*;\s*$/, '\n');
}
const NAMES = ['familyImageTokens','judgeImageTokens','sheetCell','restCell','languageOf2','readKitText','jsDeclares','declarationLines','capped','cutLine','firstLine15','fitLines','keptHead','viewText'];
const body = NAMES.map(grab).join('\n\n');
const prelude = `
const utf8Bytes4 = (s3) => Buffer.byteLength(s3, "utf8");
const jsonBytes = (s3) => utf8Bytes4(JSON.stringify(s3)) - 2;
const plural8 = (n9, one, many = \`\${one}s\`) => \`\${n9} \${n9 === 1 ? one : many}\`;
const HEAD_KEPT = /^(#{1,6}\\s|(Source files|Files|Scripts|Instances|Totals):\\s)/;
const DECL_MAX_BYTES = 96;
const FENCE_OPEN2 = /^(\`{3,}|~{3,})\\s*([A-Za-z0-9_+.-]*)\\s*$/;
const JS_KEYWORDS2 = new Set(["if","for","while","switch","catch","with","return","function","else","do","try","new","typeof","await","yield","super","delete","void","throw","in","of"]);
const vendored = (s3) => /(^|\\/)vendor\\//.test(s3.heading.slice(4).split(" (")[0] ?? "");
const linesCost = (lines2) => lines2.reduce((n9, l2) => n9 + jsonBytes(\`\${l2}\\n\`), 0);
const DOSSIER_VIEW_ENTRY_TOKENS = 1536;
const DOSSIER_VIEW_BUDGETS = Object.freeze({ "token-radar-01": 12288, "roblox-game-02": 1792 });
const SPLIT_ENTRY_TOKENS = 4096;
const VIEW_PRICING_MODEL = "superbot";
const SHEET_WIDTH = 768;
const COVER_BOX = { width: 768, height: 480 };
const GAP = 4;
const LARGE_COVER_BOX = { width: 1024, height: 640 };
const REST_BOX = { width: 1024, height: 640 };
const OPENAI_PATCH_MULTIPLIERS = [];
`;
const fn = new Function(prelude + '\n' + body + '\nreturn {' + NAMES.map(n=>n+': '+n).join(', ') + '};');
const K = fn();
const dossier = JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const budget = Number(process.argv[3] || 30144);
const vt = K.viewText(dossier.text, budget, dossier.images.length, true);
require('node:fs').writeFileSync('/home/muse-newapi/makefun-token-radar/work/tools/rev_judge_view.txt', vt.text);
const lines = vt.text.split('\n');
// A file block starts at "### name (N bytes, M lines)". Walk it and classify each source line.
let cur = null, mode = 'none';
const seen = {};
for (const l of lines) {
  const m = /^### (\S+) \(/.exec(l);
  if (m) { cur = m[1]; mode = 'decl'; seen[cur] = {body:[], decl:[], cut:null}; continue; }
  if (/^\[Cut at /.test(l)) { if (cur) seen[cur].cut = l; mode='cut'; continue; }
  if (mode === 'cut') continue;
  if (cur === null) continue;
  if (mode === 'body') { seen[cur].body.push(l); continue; }
  // decl mode: a ``` fence starts the body
  if (l.startsWith('```')) { mode = 'body'; continue; }
  seen[cur].decl.push(l);
}
for (const [f, v] of Object.entries(seen)) {
  console.log(`\n=== ${f}`);
  console.log(`  body lines the judge sees : ${v.body.length}`);
  console.log(`  decl-only lines           : ${v.decl.length}`);
  if (v.cut) console.log(`  cut note                  : ${v.cut}`);
  if (v.body.length) {
    console.log(`  --- last 3 body lines:`);
    for (const l of v.body.slice(-3)) console.log('    ' + l.slice(0,110));
  }
}

// Where exactly does the judge's body view of page.js stop?
{
  require('node:fs').writeFileSync('/home/muse-newapi/makefun-token-radar/work/tools/rev_judge_view.txt', vt.text);
const lines = vt.text.split('\n');
  const f = lines.findIndex(l => l.startsWith('### page.js'));
  const fence = lines.findIndex((l,i) => i>f && l.startsWith('```'));
  let last = -1;
  for (let i = fence+1; i < lines.length; i++) {
    if (lines[i].startsWith('### ') || lines[i].startsWith('[Cut at ')) break;
    if (lines[i].startsWith('```')) break;
    last = i;
  }
  console.log('\n### page.js: judge sees source lines 1..' + (last-fence) + ' in full');
  console.log('   last shown line:', JSON.stringify(lines[last]));
  console.log('   then:', JSON.stringify(lines[last+1]), JSON.stringify(lines[last+2]));
}
