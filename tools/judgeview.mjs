// What the JUDGE reads, measured with the kit's own code.
//
// The kit hands the judge a 30,144-byte view of the dossier text: first each file's
// declaration lines, then each file's body in path order, until the budget runs out. A file
// that does not fit whole ends the walk -- so the last files in path order can get NO body
// at all, and the bytes they would have used are stranded.
//
// This module lifts that code out of the kit and measures the real view. The gate that uses
// it asserts that the refit VERDICT -- the sentence that says the page rebuilt every row of
// the board exactly -- is inside the body the judge reads.
//
// WHY THE VERDICT MATTERS: the rubric's first criterion is "the screenshots and the code
// agree". The refit is the page's claim that its own arithmetic reproduces the board's; the
// code that proves it is the code the judge must be able to READ. The verdict's sentence
// sat at page.js line 334, past the window's end at line 312.
//
// This is a MEASUREMENT, not a description: it runs the kit's own viewText over the real
// dossier text, so it cannot drift from what the judge receives.
import fs from 'node:fs';
import path from 'node:path';

const KIT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../token-radar-01-kit/cli/makefun.mjs');

// The kit's viewText is not exported, so it is lifted out of the kit's own source and run.
// If the kit changes and the lift breaks, this throws -- loudly, which is the point: a gate
// that silently measures nothing is worse than no gate.
function grab(name) {
  const kit = fs.readFileSync(KIT, 'utf8');
  const marker = 'function ' + name + '(';
  const i = kit.indexOf(marker);
  if (i < 0) throw new Error('the kit has no ' + name);
  const rest = kit.slice(i + marker.length);
  const m = /\n(?:function |var [A-Za-z_$][\w$]*, |var [A-Za-z_$][\w$]*;|\/\/ )/.exec(rest);
  const end = m ? i + marker.length + m.index + 1 : kit.length;
  return kit.slice(i, end).replace(/\nvar [^\n]*;\s*$/, '\n');
}
const NAMES = ['familyImageTokens', 'judgeImageTokens', 'sheetCell', 'restCell', 'languageOf2',
  'readKitText', 'jsDeclares', 'declarationLines', 'capped', 'cutLine', 'firstLine15',
  'fitLines', 'keptHead', 'viewText'];
const PRELUDE = `
const utf8Bytes4=(s3)=>Buffer.byteLength(s3,"utf8");
const jsonBytes=(s3)=>utf8Bytes4(JSON.stringify(s3))-2;
const plural8=(n9,one,many)=>(many===undefined?one+"s":many);
const HEAD_KEPT=/^(#{1,6}\\s|(Source files|Files|Scripts|Instances|Totals):\\s)/;
const DECL_MAX_BYTES=96;
const FENCE_OPEN2=/^(\`{3,}|~{3,})\\s*([A-Za-z0-9_+.-]*)\\s*$/;
const JS_KEYWORDS2=new Set(["if","for","while","switch","catch","with","return","function","else","do","try","new","typeof","await","yield","super","delete","void","throw","in","of"]);
const vendored=(s3)=>/(^|\\/)vendor\\//.test(s3.heading.slice(4).split(" (")[0]??"");
const linesCost=(lines2)=>lines2.reduce((n9,l2)=>n9+jsonBytes(l2+"\\n"),0);
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

let K = null;
export function kit() {
  if (!K) {
    K = new Function(PRELUDE + '\n' + NAMES.map(grab).join('\n\n') + '\nreturn {' +
      NAMES.map((n) => n + ':' + n).join(',') + '};')();
  }
  return K;
}

export const JUDGE_VIEW_BYTES = 30144;

// The body region of the view: everything before the LAST fence. The declaration phase
// re-lists each file's names, so a search over the WHOLE view finds a name in the
// declarations even when the body was left out. The body region is what the judge reads as
// code, so that is what is searched.
export function bodyRegion(view) {
  const lines = view.split('\n');
  let last = -1;
  lines.forEach((l, i) => { if (l.startsWith('```')) last = i; });
  return lines.slice(0, last + 1).join('\n');
}

// The view the judge receives, from the real dossier text.
export function judgeView(dossierText) {
  const k = kit();
  const images = 3;
  return k.viewText(dossierText, JUDGE_VIEW_BYTES, images, true).text;
}

// The window's end, as a LINE of page.js: the last body line the view carries.
export function windowEndLine(view, pageSource) {
  const body = bodyRegion(view);
  const bl = body.split('\n');
  // the body region ENDS with the closing fence, which is not a source line
  let last = '';
  for (let i = bl.length - 1; i >= 0; i--) {
    const t = bl[i].trim();
    if (!t || t.startsWith('```')) continue;
    last = t;
    break;
  }
  if (!last) return -1;
  const ls = pageSource.split('\n');
  for (let i = ls.length - 1; i >= 0; i--) if (ls[i].trim() === last) return i + 1;
  return -1;
}

// The line a given source text sits on.
export function lineOf(pageSource, needle) {
  const at = pageSource.indexOf(needle);
  if (at < 0) return -1;
  return pageSource.slice(0, at).split('\n').length;
}
