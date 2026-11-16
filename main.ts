// A token-radar-01 entry: a radar of the protocols whose token has not issued yet.
//
// The program reads the sealed snapshot from /input/snapshot.json (or --input <file|dir>), fits its value
// model on the snapshot's own live-token cohort, scores every pre-token protocol, and writes:
//
//   /output/board.json     the ranked board, one row per protocol, each with its farm plan
//   /output/data.js        the page's dataset, the same rows the board holds
//   /output/dashboard/     this repository's dashboard, copied
//   /output/screenshots/   this repository's three screenshots, copied
//   /output/dossier.json   what the judge reads, written with the vendored make.fun library
//
// The dashboard is a static page, no framework and no network: dashboard/index.html, dashboard/colors.css and dashboard/theme.css
// and dashboard/page.js read /output/data.js, which this program writes from the same board. The page
// and the board therefore cannot disagree: one run, one dataset.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, calibrate, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/**
 * The most common colour in a PNG, as [r, g, b], or null if the file cannot be read. A PNG is
 * decoded here rather than by a library, so the check does not lean on the same code that wrote
 * the image: the scanline filters are undone, and the pixels are counted.
 */
function dominantColour(png: Buffer): [number, number, number] | null {
  if (png.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') return null;
  let o = 8;
  let idat: Buffer | null = null;
  let ihdr: Buffer | null = null;
  while (o < png.length) {
    const len = png.readUInt32BE(o);
    const type = png.toString('ascii', o + 4, o + 8);
    const body = png.slice(o + 8, o + 8 + len);
    if (type === 'IHDR') ihdr = body;
    if (type === 'IDAT') idat = idat ? Buffer.concat([idat, body]) : body;
    o += 12 + len;
    if (type === 'IEND') break;
  }
  if (!ihdr || !idat) return null;
  const w = ihdr.readUInt32BE(0);
  const h = ihdr.readUInt32BE(4);
  const ct = ihdr[9];
  if (ihdr[8] !== 8 || (ct !== 2 && ct !== 6)) return null;
  const ch = ct === 6 ? 4 : 3;
  const stride = w * ch;
  const raw = inflateSync(idat);
  const counts = new Map<string, number>();
  let prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  const paeth = (a: number, b: number, c: number): number => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v: number;
      if (ft === 0) v = src[x]!;
      else if (ft === 1) v = src[x]! + a;
      else if (ft === 2) v = src[x]! + b;
      else if (ft === 3) v = src[x]! + ((a + b) >> 1);
      else if (ft === 4) v = src[x]! + paeth(a, b, c);
      else return null;
      cur[x] = v & 0xff;
    }
    for (let x = 0; x < w; x++) {
      const k = `${cur[x * ch]},${cur[x * ch + 1]},${cur[x * ch + 2]}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    cur.copy(prev);
  }
  let best = '', bestN = -1;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  return best.split(',').map(Number) as [number, number, number];
}

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));

// The model is fitted here, on this snapshot's own live-token cohort: the coefficients the board's
// values rest on are read off the data, not typed in.
const calibration = calibrate(snapshot);
const { board, radar } = buildRadar(snapshot, calibration);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/**
 * Copy one directory's regular files into `to`, skipping names that start with a dot.
 *
 * The destination is emptied first. A file that is deleted from the source must not survive in the
 * output: a stale page.js from an earlier build would still be read by the judge, and it would
 * count against the source budget the check below enforces.
 */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  for (const old of readdirSync(to)) {
    const path = join(to, old);
    if (statSync(path).isFile()) rmSync(path);
  }
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dash = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
if (dash.length === 0) {
  process.stderr.write('token radar: dashboard/ is empty: the page and its source are what the judge reads\n');
  process.exit(1);
}
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
// A screenshot that is one flat black frame decodes cleanly, passes every size and CRC check and
// shows the judge nothing. A dark dashboard's dominant colour is one of the theme's own greys, so
// a black frame means the image was written by something that lost its pixels. Refuse to ship it.
for (const name of shots) {
  const shot = readFileSync(join(out, 'screenshots', name));
  const top = dominantColour(shot);
  if (top && top[0] === 0 && top[1] === 0 && top[2] === 0) {
    process.stderr.write(`token radar: screenshots/${name}: the frame is black -- the image was written corrupt, not rendered\n`);
    process.exit(1);
  }
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: model ${radar.model_version} fitted on ${calibration.cohort_size} live protocols (median error ${calibration.mae_log10.toFixed(3)} log10 dollars), launch odds AUC ${calibration.launch_auc.toFixed(3)}\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dash.length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
