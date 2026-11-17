// What the judge reads of the CURRENT built dossier: the kit's own viewText over the real
// dossier.json, per file, in path order. Measures the README's and MODEL.md's claims about
// which files reach the judge whole.
import fs from 'node:fs';
const KIT = '/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs';
const kit = fs.readFileSync(KIT, 'utf8');
function grab(name) {
  const marker = 'function ' + name + '(';
  const i = kit.indexOf(marker);
  if (i < 0) throw new Error(name);
  const rest = kit.slice(i + marker.length);
  const m = /\n(?:function |var [A-Za-z_$][\w$]*, |var [A-Za-z_$][\w$]*;|\/\/ )/.exec(rest);
  const end = m ? i + marker.length + m.index + 1 : kit.length;
  return kit.slice(i, end).replace(/\nvar [^\n]*;\s*$/, '\n');
}
const NAMES = ['familyImageTokens','judgeImageTokens','sheetCell','restCell','languageOf2','readKitText','jsDeclares','declarationLines','capped','cutLine','firstLine15','fitLines','keptHead','viewText'];
const prelude = `
const utf8Bytes4=(s3)=>Buffer.byteLength(s3,"utf8");
const jsonBytes=(s3)=>utf8Bytes4(JSON.stringify(s3))-2;
const plural8=(n9,one,many)=>(many===undefined?one+"s":many);
const HEAD_KEPT=/^(#{1,6}\\s|(Source files|Files|Scripts|Instances|Totals):\\s)/;
const DECL_MAX_BYTES=96;
const FENCE_OPEN2=/^(\`{3,}|~{3,})\\s*([A-Za-z0-9_+.-]*)\\s*$/;
const JS_KEYWORDS2=new Set(["if","for","while","switch","catch","with","return","function","else","do","try","new","typeof","await","yield","super","delete","void","throw","in","of"]);
const vendored=(s3)=>/(^|\\/)vendor\\//.test(s3.heading.slice(4).split(" (")[0]??"");
const linesCost=(lines2)=>lines2.reduce((n9,l2)=>n9+jsonBytes(\`\${l2}\\n\`),0);
const DOSSIER_VIEW_ENTRY_TOKENS=1536;
const DOSSIER_VIEW_BUDGETS=Object.freeze({"token-radar-01":12288});
const SPLIT_ENTRY_TOKENS=4096;
const VIEW_PRICING_MODEL="superbot";
const SHEET_WIDTH=768;
const COVER_BOX={width:768,height:480};
const GAP=4;
const LARGE_COVER_BOX={width:1024,height:640};
const REST_BOX={width:1024,height:640};
const OPENAI_PATCH_MULTIPLIERS=[];
`;
const K = new Function(prelude + '\n' + NAMES.map(grab).join('\n\n') + '\nreturn {' + NAMES.map(n=>n+': '+n).join(', ')+'};')();

const dossier = JSON.parse(fs.readFileSync(process.argv[2] || '/home/muse-newapi/makefun-token-radar/work/out/dossier.json', 'utf8'));
const BUDGET = 30144;
const vt = K.viewText(dossier.text, BUDGET, dossier.images.length, true);
fs.writeFileSync('/tmp/jv_current.txt', vt.text);
console.log('view bytes', Buffer.byteLength(vt.text), 'form', vt.form, 'decls', vt.decls, 'bodies', vt.bodies);
console.log('dossier.text bytes', Buffer.byteLength(dossier.text));

// walk the view
const lines = vt.text.split('\n');
let cur = null, mode = 'none';
const seen = {};
for (const l of lines) {
  const m = /^### (\S+) \(/.exec(l);
  if (m) { cur = m[1]; mode = 'decl'; seen[cur] = { body: [], decl: [] }; continue; }
  if (/^\[Cut at /.test(l)) { if (cur) seen[cur].cut = l; mode = 'cut'; continue; }
  if (mode === 'cut') continue;
  if (cur === null) continue;
  if (mode === 'body') { seen[cur].body.push(l); continue; }
  if (l.startsWith('```')) { mode = 'body'; continue; }
  seen[cur].decl.push(l);
}
for (const [f, v] of Object.entries(seen)) {
  const src = fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/dashboard/' + f, 'utf8');
  const srcLines = src.replace(/\n$/, '').split('\n');
  // how much of the file body did the judge see
  const prefix = v.body.join('\n');
  let n = 0;
  for (let i = 1; i <= srcLines.length; i++) { if (prefix.includes(srcLines.slice(0, i).join('\n'))) n = i; else break; }
  console.log(`${f.padEnd(13)} body lines judge sees ${String(v.body.length).padStart(4)}  contiguous prefix of source ${n}/${srcLines.length}  declLines ${v.decl.length}`);
}
console.log('\n--- cut line:', (vt.text.match(/^\[Cut at .*/m) || ['(none)'])[0]);
console.log('\n--- first 3 lines of view:');
console.log(vt.text.split('\n').slice(0, 3).join('\n'));
