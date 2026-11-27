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
const NAMES = ['familyImageTokens', 'judgeImageTokens', 'sheetCell', 'restCell',
  'languageOf2', 'languageOf3', 'readKitText', 'jsDeclares', 'declarationLines',
  'capped', 'capped4', 'cutLine', 'firstLine15', 'firstLine11', 'fitLines',
  'fitLines2', 'keptHead', 'prepareText', 'viewText'];
const PRELUDE = `
const utf8Bytes4=(s3)=>Buffer.byteLength(s3,"utf8");
const jsonBytes=(s3)=>utf8Bytes4(JSON.stringify(s3))-2;
const utf8Bytes5=(s3)=>Buffer.byteLength(s3,"utf8");
const jsonBytes4=(s3)=>utf8Bytes5(JSON.stringify(s3))-2;
const plural8=(n9,one,many)=>(many===undefined?one+"s":many);
const HEAD_KEPT=/^(#{1,6}\\s|(Source files|Files|Scripts|Instances|Totals):\\s)/;
const DECL_MAX_BYTES=96;
const FENCE_OPEN2=/^(\`{3,}|~{3,})\\s*([A-Za-z0-9_+.-]*)\\s*$/;
const JS_KEYWORDS2=new Set(["if","for","while","switch","catch","with","return","function","else","do","try","new","typeof","await","yield","super","delete","void","throw","in","of"]);
const vendored=(s3)=>/(^|\\/)vendor\\//.test(s3.heading.slice(4).split(" (")[0]??"");
const linesCost=(lines2)=>lines2.reduce((n9,l2)=>n9+jsonBytes(l2+"\\n"),0);
const DOSSIER_VIEW_ENTRY_TOKENS=1536;
const DOSSIER_VIEW_BUDGETS=Object.freeze({"token-radar-01":12288});
const DOSSIER_VIEW_POLICY="dossier-view/v1";
const DOSSIER_VIEW_POLICY_V2="dossier-view/v2";
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
//
// The kit's body phase emits the source's lines VERBATIM (kit.mjs: s3.lines.slice(0, k3)),
// so the carried count is read off the fenced block directly -- no text matching, and so no
// trap from a line that occurs more than once in the source.
//
// Matching backwards from the end was wrong: a line like " ])," occurs on several lines of
// the source, and a backward search finds the LAST of them and reads the window's end as
// further along than it is -- which once made a measurement report 256 lines where there
// were 2.
export function windowEndLine(view, pageSource) {
  const body = bodyRegion(view);
  const bl = body.split('\n');
  // the page.js section's heading, then its opening fence, then the lines, then the fence
  let hi = -1;
  for (let i = 0; i < bl.length; i++) {
    if (bl[i].indexOf('### page.js') >= 0) { hi = i; break; }
  }
  if (hi < 0) return -1;
  let open = -1;
  for (let i = hi + 1; i < bl.length; i++) {
    if (bl[i].trim().startsWith('```')) { open = i; break; }
  }
  if (open < 0) return -1;
  let close = -1;
  for (let i = open + 1; i < bl.length; i++) {
    if (bl[i].trim() === '```') { close = i; break; }
  }
  if (close < 0) return -1;
  const carried = close - open - 1;
  const ls = pageSource.split('\n');
  if (carried > ls.length) return -1;
  // and the carried lines must BE the source's first lines: the walk is in order, so if the
  // block's content does not match the source line for line, this measurement is not
  // measuring what it claims and must say so.
  for (let i = 0; i < carried; i++) {
    if (bl[open + 1 + i] !== ls[i]) return -1;
  }
  return carried;
}

// The line a given source text sits on.
export function lineOf(pageSource, needle) {
  const at = pageSource.indexOf(needle);
  if (at < 0) return -1;
  return pageSource.slice(0, at).split('\n').length;
}
