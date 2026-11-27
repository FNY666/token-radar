// What the JUDGE reads, measured with the kit's own code.
//
// The kit hands the judge a VIEW of the dossier text: first each file's declaration lines,
// then each file's body in path order, until the budget runs out. A file that does not fit
// whole ends the walk -- so the last files in path order can get NO body at all, and the bytes
// they would have used are stranded.
//
// The budget is NOT a constant. It is (the entry's token budget - the tokens the composed
// images cost) x the bytes per token, and the image cost depends on the kit's own cover box.
// On 2026-11-27 the kit was refreshed and its cover box changed from 1024x640 to 1440x1440:
// the composed cover became 1440x900, which costs 1,716 tokens instead of 1,120, so the
// images cost 2,836 instead of 2,240 -- and the judge's text budget fell from 30,144 bytes to
// 28,356. Every number here is DERIVED from the kit, so a kit refresh changes the measurement
// instead of silently leaving it measuring a view the judge does not receive.
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
import { liftKitConstants } from './kitconst.mjs';

const KIT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../token-radar-01-kit/cli/makefun.mjs');

// The kit's own constants, lifted and run. They are the kit's, not ours: a kit refresh that
// changes the boxes or the pricing changes the measurement, and a lift that breaks THROWS.
const KC = liftKitConstants(KIT);

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
const NAMES = ['sheetCell', 'restCell',
  'languageOf2', 'languageOf3', 'readKitText', 'jsDeclares', 'declarationLines',
  'capped', 'capped4', 'cutLine', 'firstLine15', 'firstLine11', 'fitLines',
  'fitLines2', 'keptHead', 'prepareText', 'viewText'];
// The PRELUDE is the kit's own constants, written out from the lifted values -- so a kit
// refresh changes them here too, instead of leaving a stale copy measuring the old kit.
//
// A REGEX is written out as its own source text (String(re) gives the literal), because
// JSON.stringify turns a regex into "{}" and the prelude would carry an empty object where
// the kit has a pattern.
//
// The names are the kit's own, except where the kit's name is not the one the lifted code
// uses: the kit calls its gap GAP2, and the lifted sheetCell/restCell read GAP2, so GAP2 is
// what the prelude defines. (An earlier version defined GAP and left GAP2 undefined, and
// the sheet's geometry was computed from a gap of 0 -- which happened to be the same number.)
const PRELUDE = `
const utf8Bytes4=(s3)=>Buffer.byteLength(s3,"utf8");
const jsonBytes=(s3)=>utf8Bytes4(JSON.stringify(s3))-2;
const utf8Bytes5=(s3)=>Buffer.byteLength(s3,"utf8");
const jsonBytes4=(s3)=>utf8Bytes5(JSON.stringify(s3))-2;
const plural8=(n9,one,many)=>(many===undefined?one+"s":many);
const HEAD_KEPT=${String(KC.HEAD_KEPT)};
const DECL_MAX_BYTES=${KC.DECL_MAX_BYTES};
const FENCE_OPEN2=${String(KC.FENCE_OPEN2)};
const JS_KEYWORDS2=new Set(${JSON.stringify([...KC.JS_KEYWORDS3])});
const vendored=(s3)=>/(^|\\/)vendor\\//.test(s3.heading.slice(4).split(" (")[0]??"");
const linesCost=(lines2)=>lines2.reduce((n9,l2)=>n9+jsonBytes(l2+"\\n"),0);
const DOSSIER_VIEW_ENTRY_TOKENS=1536;
const DOSSIER_VIEW_BUDGETS=Object.freeze({"token-radar-01":12288});
const DOSSIER_VIEW_POLICY=${JSON.stringify(KC.DOSSIER_VIEW_POLICY)};
const DOSSIER_VIEW_POLICY_V2=${JSON.stringify(KC.DOSSIER_VIEW_POLICY_V2)};
const SPLIT_ENTRY_TOKENS=${KC.SPLIT_ENTRY_TOKENS};
const VIEW_PRICING_MODEL=${JSON.stringify(KC.VIEW_PRICING_MODEL)};
const SHEET_WIDTH=${KC.SHEET_WIDTH};
const COVER_BOX=${JSON.stringify(KC.COVER_BOX)};
const GAP2=${KC.GAP2};
const GAP=${KC.GAP2};
const LARGE_COVER_BOX=${JSON.stringify(KC.LARGE_COVER_BOX)};
const REST_BOX=${JSON.stringify(KC.REST_BOX)};
const CSS_PALETTE=${JSON.stringify(KC.CSS_PALETTE)};
const plural16=(n13,one3,many)=>{if(many===undefined)many=one3+"s";return n13+" "+(n13===1?one3:many);};
const JS_KEYWORDS3=new Set(${JSON.stringify([...KC.JS_KEYWORDS3])});
`;

let K = null;
export function kit() {
  if (!K) {
    K = new Function(PRELUDE + '\n' + NAMES.map(grab).join('\n\n') + '\nreturn {' +
      NAMES.map((n) => n + ':' + n).join(',') + '};')();
    // The kit's OWN image-token pricing, lifted verbatim from the kit's judge-call
    // module and run here. It was reimplemented in the PRELUDE before -- which is how a
    // formula drifts from the kit without anything failing: the copy and the kit agreed
    // on this entry's sizes, and would have disagreed on a size where they differ.
    K.judgeImageTokens = KC.judgeImageTokens;
    K.familyImageTokens = KC.familyImageTokens;
  }
  return K;
}

// The judge's TEXT budget, in bytes.
//
// The kit computes it as (entry tokens - the tokens the composed images cost) x the bytes per
// token. So it needs the COMPOSED image sizes, which need the kit's boxes and the entry's own
// image dimensions.
//
// The composed sizes are computed by the same arithmetic the kit uses, and the arithmetic is
// checked against sharp by the gate that uses this file: sharp's fit:'inside' is
// round(w x scale) in every case except an exact half, where libvips rounds to even. The
// check is a GATE, not a comment, because a geometry that is off by one pixel changes the
// image tokens and therefore the whole text budget.
export function imageGeometry(images) {
  const dims = images.map((im) => ({
    name: im.name,
    width: im.width,
    height: im.height,
  }));
  const cover = dims[0];
  const rest = dims.slice(1);
  const fit = (w, h, box) => {
    const s = Math.min(box.width / w, box.height / h, 1);
    return { width: Math.round(w * s), height: Math.round(h * s) };
  };
  const columns = Math.ceil(Math.sqrt(rest.length));
  const rows = Math.ceil(rest.length / columns);
  const cell = {
    columns,
    width: Math.floor((KC.REST_BOX.width - (columns - 1) * KC.GAP2) / columns),
    height: Math.floor((KC.REST_BOX.height - (rows - 1) * KC.GAP2) / rows),
  };
  const cells = rest.map((d) => fit(d.width, d.height, cell));
  const composed = (rowList) => ({
    width: Math.max(...rowList.map((r) => r.reduce((n, c) => n + c.width, 0) + KC.GAP2 * (r.length - 1))),
    height: rowList.reduce((n, r) => n + Math.max(...r.map((c) => c.height)), 0) + KC.GAP2 * (rowList.length - 1),
  });
  const rowList = [];
  for (let i = 0; i < cells.length; i += cell.columns) rowList.push(cells.slice(i, i + cell.columns));
  return [
    { name: 'the cover', ...composed([[fit(cover.width, cover.height, KC.LARGE_COVER_BOX)]]) },
    { name: 'the sheet of the others', ...composed(rowList) },
  ];
}

// The judge's text budget in bytes, for a given set of composed pictures.
export function textBudget(pictures, entryTokens = 12288) {
  const k = kit();
  const imageTokens = pictures.reduce((n, p) => n + k.judgeImageTokens(KC.VIEW_PRICING_MODEL, p), 0);
  return { bytes: (entryTokens - imageTokens) * KC.BYTES_PER_INPUT_TOKEN, imageTokens, entryTokens };
}

// The budget for the entry's own images, measured from the dossier's own image dimensions.
//
// The dimensions are read from the dossier's image bytes (the PNG/JPEG header), because the
// dossier holds the images as base64 -- the entry's own shots, at the size they were shipped.
export function budgetForDossier(dossier, entryTokens = 12288) {
  const images = dossier.images.map((im) => {
    const b = Buffer.from(im.base64, 'base64');
    return { name: im.name, width: pngWidth(b) || jpegWidth(b), height: pngHeight(b) || jpegHeight(b) };
  });
  return textBudget(imageGeometry(images), entryTokens);
}

function pngWidth(b) { return b.slice(1, 4).toString() === 'PNG' ? b.readUInt32BE(16) : 0; }
function pngHeight(b) { return b.slice(1, 4).toString() === 'PNG' ? b.readUInt32BE(20) : 0; }
function jpegSize(b) {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return { width: 0, height: 0 };
}
function jpegWidth(b) { return jpegSize(b).width; }
function jpegHeight(b) { return jpegSize(b).height; }

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
//
// The budget comes from the dossier's OWN images, through the kit's own boxes and pricing.
export function judgeView(dossierText, budget) {
  const k = kit();
  const images = 3;
  const b = budget ?? JUDGE_VIEW_BYTES;
  return k.viewText(dossierText, b, images, true).text;
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
