// A faithful copy of the kit's viewText (token-radar-01-kit/cli/makefun.mjs:298010)
// with logging added at every accounting step. Copied VERBATIM except for the log lines,
// so the numbers it prints are the kit's numbers.
import fs from 'node:fs';
import { kit } from './judgeview.mjs';

const utf8Bytes4 = (s) => Buffer.byteLength(s, 'utf8');
const jsonBytes = (s) => utf8Bytes4(JSON.stringify(s)) - 2;
const linesCost = (lines) => lines.reduce((n, l) => n + jsonBytes(l + '\n'), 0);
const vendored = (s) => /(^|\/)vendor\//.test(s.heading.slice(4).split(' (')[0] ?? '');

const K = kit();

// The copy must agree with the kit. If the kit's viewText changes and this copy does not,
// every number it prints is a number about the OLD kit -- so the copy's own view is compared
// with the kit's, here, and the suite fails if they differ.
export function agreesWithKit(text, budget = 30144, images = 3) {
  const kitText = K.viewText(text, budget, images, true).text;
  const mine = instrument(text, budget, images).view;
  return { same: mine === kitText, kitBytes: Buffer.byteLength(kitText, 'utf8'),
    mineBytes: mine === undefined ? -1 : Buffer.byteLength(mine, 'utf8') };
}

export function instrument(text, budget = 30144, images = 3) {
  const pictures = { images, split: true };
  const log = [];
  const whole = `${K.firstLine15('whole', pictures)}\n${text}`;
  if (jsonBytes(whole) <= budget) return { form: 'whole', log };
  const kitTxt = K.readKitText(text);
  if (kitTxt === null) return { form: 'head', log };
  const outlineFirst = K.firstLine15('outline', pictures);
  const head = K.keptHead(kitTxt.head);
  const before = head.length === 0 ? [] : [...head, ''];
  const headings = kitTxt.sections.map((s) =>
    s.facts === null ? s.heading : `${s.heading} (${s.facts})`
  );
  const decls = kitTxt.sections.map((s) =>
    K.declarationLines(s.language, s.lines).map((d) => ({ line: d.line, ...K.capped(d.text) }))
  );
  const totalDecls = decls.reduce((n, d) => n + d.length, 0);
  const sourceBytes = kitTxt.sections.reduce((n, s) => n + s.bytes, 0);
  const reserve = jsonBytes(K.cutLine(budget, kitTxt.sections.length, totalDecls, sourceBytes));
  const fixedCost = linesCost([outlineFirst, ...before, ...headings, ...kitTxt.tail]);
  log.push(['reserve (bytes held back for the cut notice)', reserve]);
  log.push(['fixedCost (the view header + the head + the section headings + the tail)', fixedCost]);
  if (fixedCost + reserve > budget) return { form: 'outline', log };
  let room = budget - fixedCost - reserve;
  log.push(['room for the declaration phase', room]);
  const kept = decls.map(() => 0);
  const open = decls.map((d) => d.length > 0);
  let guard = 0;
  while (open.some(Boolean)) {
    if (++guard > 100000) throw new Error('the declaration phase did not terminate');
    for (let f = 0; f < decls.length; f++) {
      if (!open[f]) continue;
      const cost = jsonBytes(`${decls[f][kept[f]].text}\n`);
      if (cost > room) { open[f] = false; continue; }
      room -= cost;
      kept[f]++;
      if (kept[f] === decls[f].length) open[f] = false;
    }
  }
  log.push(['room left after the declaration phase', room]);
  log.push(['declarations kept per section', kept.join(', ')]);
  log.push(['declaration bytes per section', decls.map((d, f) =>
    d.slice(0, kept[f]).reduce((n, x) => n + jsonBytes(`${x.text}\n`), 0)).join(', ')]);
  const shownLines = kitTxt.sections.map(() => null);
  let bodies = 0;
  const bodiesFirst = K.firstLine15('bodies', pictures);
  if (kept.every((k, f) => k === decls[f].length)) {
    let left = room - (jsonBytes(`${bodiesFirst}\n`) - jsonBytes(`${outlineFirst}\n`));
    log.push(['left for the body phase', left]);
    for (let f = 0; f < kitTxt.sections.length; f++) {
      const s = kitTxt.sections[f];
      if (vendored(s)) continue;
      let cost = jsonBytes(`${s.fence}${s.info}\n`) + jsonBytes(`${s.fence}\n`);
      let k = 0;
      let d = 0;
      const ds = decls[f];
      for (; k < s.lines.length; k++) {
        let next = cost + jsonBytes(`${s.lines[k]}\n`);
        let e = d;
        while (e < ds.length && ds[e].line === k) next -= jsonBytes(`${ds[e++].text}\n`);
        if (next > left) break;
        cost = next;
        d = e;
      }
      log.push([
        `section ${f} ${s.heading}`,
        `lines shown ${k} of ${s.lines.length}`,
        `body bytes ${cost}`,
        `left after it ${left - cost}`,
        k < s.lines.length ? 'DID NOT FIT WHOLE -> the walk breaks here' : 'fit whole'
      ]);
      if (k === 0) break;
      shownLines[f] = k;
      bodies++;
      left -= cost;
      if (k < s.lines.length) break;
    }
    log.push(['left at the end of the body phase (UNREACHABLE by later sections)', left]);
  } else {
    log.push(['the declaration phase did not finish; there is NO body phase']);
  }
  let shownDecls = 0;
  let shownBytes = 0;
  const tailParts = [];
  const body = kitTxt.sections.flatMap((s, f) => {
    const k = shownLines[f];
    if (shownLines[f] === null) {
      const ds = decls[f].slice(0, kept[f]);
      shownDecls += ds.length;
      shownBytes += ds.reduce((n, x) => n + x.shown, 0);
      if (f === kitTxt.sections.length - 1 || kitTxt.sections[f + 1].facts !== null) {
        tailParts.push([`${s.heading}: ${ds.length} declarations`, ds.reduce((n, x) => n + jsonBytes(`${x.text}\n`), 0)]);
      }
      return [headings[f], ...ds.map((x) => x.text)];
    }
    const rest = decls[f].filter((x) => x.line >= k);
    shownDecls += decls[f].length;
    shownBytes += s.lines.slice(0, k).reduce((n, l) => n + utf8Bytes4(l) + 1, 0)
      + rest.reduce((n, x) => n + x.shown, 0);
    tailParts.push([`${s.heading}: ${rest.length} declarations past the body`, rest.reduce((n, x) => n + jsonBytes(`${x.text}\n`), 0)]);
    return [headings[f], `${s.fence}${s.info}`, ...s.lines.slice(0, k), s.fence, ...rest.map((x) => x.text)];
  });
  for (const [a, b] of tailParts) log.push(['tail: ' + a, b]);
  const cut = K.cutLine(budget, 0, totalDecls - shownDecls, sourceBytes - shownBytes);
  log.push(['the cut notice', jsonBytes(`${cut}\n`), JSON.stringify(cut)]);
  const out = [
    bodies > 0 ? bodiesFirst : outlineFirst,
    ...before, ...body, ...kitTxt.tail, cut
  ];
  log.push(['the view, as the kit counts it', linesCost(out)]);
  log.push(['the view, as raw bytes', utf8Bytes4(out.join('\n'))]);
  log.push(['the budget', budget]);
  log.push(['UNSPENT (the kit\'s count)', budget - linesCost(out)]);
  log.push(['the double quotes in the view, which the escape doubles',
    (out.join('\n').match(/"/g) || []).length]);
  return { form: 'outline', log, view: out.join('\n'), decls: shownDecls, bodies };
}

// The CLI: print the instrumented view of a dossier.
//
// This block runs ONLY when this file is the program being run. It used to run whenever the
// module was imported, and that was a trap: verify.mjs imports this module to call
// agreesWithKit(), and verify.mjs's OWN first argument is the OUTPUT DIRECTORY -- so
// `node verify.mjs <out-dir>` put a directory into process.argv[2], this block read it as a
// dossier file, and the suite died with:
//
//     Error: EISDIR: illegal operation on a directory, read
//
// which killed the import and with it every gate. The finalize chain runs exactly that form
// (`node verify.mjs "$TMP/out"`), so the chain could not get past its own step 2 -- it was
// the gate suite failing to START, not a gate failing.
//
// The fix is the entry-point test: an imported module does not run its CLI.
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(new URL(import.meta.url).pathname)) {
  const arg = process.argv[2];
  if (arg) {
    const text = JSON.parse(fs.readFileSync(arg, 'utf8')).text;
    const r = instrument(text);
    for (const row of r.log) console.log(row[0], '=', row.slice(1).join(' | '));
  }
}
