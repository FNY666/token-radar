// Renders the judge's ACTUAL image frames, with the kit's OWN composition code.
//
//   node tools/judgeframes.mjs [<out-dir>] [<shots-dir>]
//
// The kit does not hand the judge the entry's PNGs: it fits the cover into 1024x640, fits the
// other two into 510x640 cells on a second sheet, and sends THAT. So a shot's usefulness is a
// property of the composed view, and the composed view has to be looked at.
//
// This renders it by running the kit's own `dossierJudgeViewAt` against the real
// out/dossier.json at the entry's token budget. Nothing here re-implements the kit: the kit's
// own fit2 (sharp, lanczos3, withoutEnlargement), sheetCell, restCell, composed and JPEG
// options do the work.
//
// The kit bundles sharp, and the bundle loads sharp's NATIVE binary through a bundler-internal
// require. That binary is not installed here, so the kit is copied next to an installed sharp
// and loaded from there -- the composition code is the kit's either way.
//
//   sharp:  npm install --os=linux --cpu=arm64 sharp --prefix <dir>
//
// If sharp cannot be found, this says so and exits 2. It is a TOOL, not a gate: it writes
// pictures, and nothing in the entry's verification depends on it.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(here, '../../token-radar-01-kit/cli/makefun.mjs');
const WORK = path.resolve(here, '..');
const outDir = process.argv[2] || path.join(WORK, 'out');
const shotsDir = path.resolve(process.argv[3] || '/tmp/judge-frames');

// The output directory must NOT be the entry's own screenshots/ directory.
//
// main.ts copies the whole screenshots/ directory into the built output, and buildDossier
// takes the PNG and JPEG files in NAME ORDER with cover: 0. So anything written into the
// source screenshots/ becomes a judge-visible image -- and a file whose name sorts before
// the numbered shots becomes the COVER, which is the entry's face.
//
// This tool was once run as `node tools/judgeframes.mjs out screenshots`, and it wrote
// judge-view-cover.jpg, judge-view-sheet.jpg and judge-view.txt there. That directory is
// the entry's, and the judge would have been shown a verification artefact as the cover.
// The tool is a TOOL: it writes pictures for a human to look at, and its output belongs
// outside the entry.
//
// So the check is here, and it is a refusal rather than a warning: the tool does not run.
{
  const srcShots = path.resolve(WORK, 'screenshots');
  if (shotsDir === srcShots || shotsDir.startsWith(srcShots + path.sep)) {
    process.stderr.write(
      `judgeframes: refusing to write into the entry's screenshots directory.\n` +
      `  ${srcShots} is COPIED into the built output, and buildDossier takes its\n` +
      `  images sorted by name -- so a PNG or JPEG written there becomes a\n` +
      `  judge-visible image, and a file of any other kind makes buildDossier\n` +
      `  refuse the whole dossier. Write somewhere else, e.g. /tmp/judge-frames.\n`);
    process.exit(2);
  }
}

// sharp, from wherever it is installed
const sharpRoots = [
  process.env.MAKEFUN_SHARP_DIR,
  '/tmp/sharptest',
  path.join(WORK, 'tools', 'node_modules'),
].filter(Boolean);
let sharpRoot = null;
for (const r of sharpRoots) {
  if (fs.existsSync(path.join(r, 'node_modules', 'sharp', 'package.json'))) { sharpRoot = r; break; }
}
if (!sharpRoot) {
  process.stderr.write('judgeframes: no sharp found. Install one with:\n' +
    '  npm install --os=linux --cpu=arm64 sharp --prefix /tmp/sharptest\n' +
    'or set MAKEFUN_SHARP_DIR to an install that has one.\n');
  process.exit(2);
}

// The kit, copied beside the sharp so its internal require resolves the native binary.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'judgeframes-'));
const kitCopy = path.join(sharpRoot, 'node_modules', 'makefun-judgeframes.mjs');
fs.copyFileSync(KIT, kitCopy);
let kit = fs.readFileSync(kitCopy, 'utf8');
kit += '\nexport { dossierJudgeViewAt, init_dist9, init_dossier, init_dossier_view };\n';
const kitExport = path.join(sharpRoot, 'node_modules', 'makefun-judgeframes-exp.mjs');
fs.writeFileSync(kitExport, kit);

const mod = await import(kitExport);
mod.init_dist9();
mod.init_dossier();
mod.init_dossier_view();

const dossier = path.join(outDir, 'dossier.json');
if (!fs.existsSync(dossier)) {
  process.stderr.write(`judgeframes: no ${dossier}. Build the entry first.\n`);
  process.exit(2);
}
const bytes = fs.readFileSync(dossier);
const budget = Number(process.env.MAKEFUN_ENTRY_TOKENS || 12288);
const r = await mod.dossierJudgeViewAt(bytes, budget);

fs.mkdirSync(shotsDir, { recursive: true });
const view = JSON.parse(Buffer.from(r.view).toString('utf8'));
for (const im of view.images) {
  const file = path.join(shotsDir, im.name.replace(/\.[^.]+$/, '') + '.jpg');
  fs.writeFileSync(file, Buffer.from(im.base64, 'base64'));
  process.stdout.write(`  ${im.name} -> ${file}\n`);
}
fs.writeFileSync(path.join(shotsDir, 'judge-view.txt'), view.text);

process.stdout.write('the kit\'s own figures for this view:\n');
for (const [k, v] of Object.entries(r.figures)) process.stdout.write(`  ${k}: ${v}\n`);
process.stdout.write(`  policy: ${r.policy}\n  form: ${r.text_form}\n`);
process.stdout.write(`the text view: ${view.text.length} chars -> ${path.join(shotsDir, 'judge-view.txt')}\n`);

fs.rmSync(kitCopy, { force: true });
fs.rmSync(kitExport, { force: true });
fs.rmSync(tmp, { recursive: true, force: true });
