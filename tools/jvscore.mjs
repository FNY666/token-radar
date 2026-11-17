// Which functions the judge's 30,144-byte view reads WHOLE, and what that means for the judge's
// five criteria. This is the scoreboard for a page.js reorder.
//
//   node tools/jvscore.mjs [dashboard-dir]
import fs from 'node:fs';

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
const prelude = `
const utf8Bytes4=(s3)=>Buffer.byteLength(s3,"utf8");
const jsonBytes=(s3)=>utf8Bytes4(JSON.stringify(s3))-2;
const plural8=(n9,one,many)=>(many===undefined?one+"s":many);
const HEAD_KEPT=/^(#{1,6}\\s|(Source files|Files|Scripts|Instances|Totals):\\s)/;
const DECL_MAX_BYTES=96;
const FENCE_OPEN2=/^(\`{3,}|~{3,})\\s*([A-Za-z0-9_+.-]*)\\s*$/;
const JS_KEYWORDS2=new Set(["if","for","while","switch","catch","with","return","function","else","do","try","new","typeof","await","yield","super","delete","void","throw","in","of"]);
const vendored=(s3)=>/(^|\\/)vendor\\//.test(s3.heading.slice(4).split(" (")[0]??"");
const linesCost=(lines2)=>lines2.reduce((n9,l2)=>n9+jsonBytes(\`\${l2}\n\`),0);
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
const K = new Function(prelude + '\n' + NAMES.map(grab).join('\n\n') + '\nreturn {' + NAMES.map((n) => n + ': ' + n).join(', ') + '};')();

const DIR = process.argv[2] || 'dashboard';
const NAMES_ORDER = ['colors.css', 'index.html', 'model.js', 'page.js', 'theme.css'];
const files = NAMES_ORDER.map((n) => {
  const text = fs.readFileSync(`${DIR}/${n}`, 'utf8');
  return { name: n, text, bytes: Buffer.byteLength(text), lines: text.replace(/\n$/, '').split('\n') };
});
const head = ['## Dashboard', '', `Files: ${files.length} (${files.reduce((n, f) => n + f.bytes, 0)} bytes)`,
  ...files.map((f) => `- ${f.name} (${f.bytes} bytes)`), '', '## Source', '', ''].join('\n');
let text = head;
for (const f of files) {
  const fence = f.name.endsWith('.css') ? 'css' : f.name.endsWith('.html') ? 'html' : 'js';
  text += `### ${f.name}\n\n${f.bytes} bytes, ${f.lines.length} line${f.lines.length === 1 ? '' : 's'}\n\n\`\`\`${fence}\n${f.text}${f.text.endsWith('\n') ? '' : '\n'}\`\`\`\n\n`;
}
const r = K.viewText(text, 30144, 3, true);
const out = r.text;

// the prefix of page.js the judge reads whole
const page = files[3];
let shown = 0;
for (let i = 1; i <= page.lines.length; i++) {
  if (out.includes(page.lines.slice(0, i).join('\n'))) shown = i;
  else break;
}

// map line -> enclosing top-level group
const groups = [];
{
  let depth = 0, start = -1;
  for (let i = 0; i < page.lines.length; i++) {
    const l = page.lines[i];
    if (start === -1 && /^  (function |var |if \()/.test(l)) { start = i; depth = 0; }
    if (start !== -1) {
      for (const ch of l) { if (ch === '{') depth++; else if (ch === '}') depth--; }
      if (depth === 0 && l.trim() !== '' && !/^[{([]/.test(l.trim())) {
        groups.push({ name: page.lines[start].trim().slice(0, 40), from: start, to: i });
        start = -1;
      } else if (depth === 0 && /;$/.test(l.trim()) && !/^[{([]/.test(l.trim())) {
        groups.push({ name: page.lines[start].trim().slice(0, 40), from: start, to: i });
        start = -1;
      }
    }
  }
}
const covered = new Set();
for (const g of groups) if (g.to < shown) covered.add(g.name);

console.log(`judge view ${Buffer.byteLength(out)} bytes | page.js body read: lines 1..${shown} of ${page.lines.length}`);
console.log('\ntop-level groups the judge reads WHOLE:');
for (const g of groups) {
  const whole = g.to < shown;
  const partial = g.from < shown && g.to >= shown;
  const mark = whole ? 'WHOLE' : partial ? 'part' : '     ';
  console.log(`  ${mark}  ${g.name.slice(0, 46).padEnd(48)} lines ${g.from + 1}-${g.to + 1}`);
}
