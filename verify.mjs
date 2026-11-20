// Checks the entry against every rule the sealed scorer states, from RULES.txt.
//   node verify.js <out-dir>
import fs from 'node:fs';
import path from 'node:path';


const out = path.resolve(process.argv[2] || 'out');
const kit = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../token-radar-01-kit');
const snapshot = JSON.parse(fs.readFileSync(path.join(kit, 'input/snapshot.json'), 'utf8'));

let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? '   ' + detail : ''));
}

// ---------------------------------------------------------------- board_file
const boardPath = path.join(out, 'board.json');
const raw = fs.readFileSync(boardPath);
const doc = JSON.parse(raw.toString('utf8'));
const rows = Array.isArray(doc) ? doc : doc.rows;
check('board.json is a JSON object with a rows array', Array.isArray(rows), `rows=${rows.length}`);
check('board.json row count 100..4000', rows.length >= 100 && rows.length <= 4000, `${rows.length}`);
check('board.json at most 8 MiB', raw.length <= 8 * 1024 * 1024, `${raw.length} bytes`);

const slugs = new Set(snapshot.protocols.map((p) => p.slug));
const seen = new Set();
let slugBad = 0;
let nameBad = 0;
let rankBad = 0;
let valueBad = 0;
let stepBad = 0;
let stepCountBad = 0;
let stepTextBad = 0;
for (const r of rows) {
  if (typeof r.slug !== 'string' || !slugs.has(r.slug)) slugBad++;
  if (seen.has(r.slug)) slugBad++;
  seen.add(r.slug);
  if (typeof r.name !== 'string' || r.name.length === 0) nameBad++;
  if (!Number.isSafeInteger(r.rank) || r.rank <= 0) rankBad++;
  if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14) valueBad++;
  if (!Array.isArray(r.farm_steps)) { stepCountBad++; continue; }
  if (r.farm_steps.length < 3 || r.farm_steps.length > 12) stepCountBad++;
  for (const s of r.farm_steps) {
    if (typeof s !== 'string') { stepTextBad++; continue; }
    const t = s.trim();
    if (t.length < 20 || t.length > 600) stepTextBad++;
  }
}
check('every slug is one of the snapshot protocols, once each', slugBad === 0, `${slugBad} bad`);
check('every name is a non-empty string', nameBad === 0, `${nameBad} bad`);
check('every rank is a positive whole number', rankBad === 0, `${rankBad} bad`);
check('every implied_value_usd is a positive whole number <= 1e14', valueBad === 0, `${valueBad} bad`);
check('every farm_steps holds 3..12 strings', stepCountBad === 0, `${stepCountBad} bad`);
check('every farm step is 20..600 characters trimmed', stepTextBad === 0, `${stepTextBad} bad`);

// the live rows travel in the dataset the page reads, not in board.json
function liveRows(outDir) {
  const src = fs.readFileSync(path.join(outDir, 'data.js'), 'utf8');
  const data = JSON.parse(src.slice(src.indexOf('{')).replace(/;\s*$/, ''));
  return data.live || [];
}

// ---------------------------------------------------------------- the live table's Cap/TVL// The "Already trading" table prints the market cap, the TVL and the multiple between them. A
// reader divides the two they can see and must land on the third -- so the published multiple
// has to be the quotient of the PUBLISHED operands, at the precision it is shown.
//
// The precision the page prints the operands at is read from the page's own source, so this
// check cannot be passed by editing the check: if the page's precision changes, the check
// follows it. And the check runs on the RENDERED cells, so it measures what a reader sees.
{
  const pageSrc = fs.readFileSync(path.join(out, 'dashboard', 'page.js'), 'utf8');
  const cellMatch = /money\(r\.mcap_usd,\s*(\d+)\)/.exec(pageSrc);
  const tvlMatch = /money\(r\.tvl_usd,\s*(\d+)\)/.exec(pageSrc);
  const osig = cellMatch ? Number(cellMatch[1]) : 0;
  const tsig = tvlMatch ? Number(tvlMatch[1]) : 0;
  // the page's own money(): the unit from the magnitude, then the mantissa to `sig` figures
  const shown = (n, sig) => {
    if (n === null || n === undefined) return null;
    const a = Math.abs(n);
    if (a >= 1e9) return Number((n / 1e9).toPrecision(sig)) * 1e9;
    if (a >= 1e6) return Number((n / 1e6).toPrecision(sig)) * 1e6;
    if (a >= 1e3) return Number((n / 1e3).toPrecision(sig)) * 1e3;
    return Math.round(n);
  };
  const live = liveRows(out);
  let liveBad = 0;
  let liveNoRows = live.length === 0;
  const ex = [];
  for (const r of live) {
    if (typeof r.ratio !== 'number') { liveBad++; continue; }
    const mv = shown(r.mcap_usd, osig);
    const tv = shown(r.tvl_usd, tsig);
    if (mv === null || tv === null || tv === 0) { liveBad++; continue; }
    const readerGets = Number((mv / tv).toFixed(2));
    if (readerGets !== Number(r.ratio.toFixed(2))) {
      liveBad++;
      if (ex.length < 4) ex.push(`${r.name}: reader gets ${readerGets}, page shows ${Number(r.ratio.toFixed(2))}`);
    }
  }
  check('the live table publishes a Cap/TVL a reader can divide out of the printed operands',
    !liveNoRows && liveBad === 0,
    liveNoRows ? 'no live rows in board.json' : `${live.length - liveBad}/${live.length} reproduce` + (ex.length ? ' | ' + ex.join(' | ') : ''));
}

// ---------------------------------------------------------------- sorted_by_value
const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
let rankSeq = true;
for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) { rankSeq = false; break; }
check('ranks are exactly 1..N once each', rankSeq, ranks.length ? `1..${ranks.length}` : '');
const byRank = rows.slice().sort((a, b) => a.rank - b.rank);
let rising = false;
for (let i = 1; i < byRank.length; i++) if (byRank[i].implied_value_usd > byRank[i - 1].implied_value_usd) { rising = true; break; }
check('implied value does not rise as rank ascends', !rising, rising ? 'a row outranks its predecessor' : '');
const distinct = new Set(rows.map((r) => r.implied_value_usd));
check('implied values are not all the same', distinct.size > 1, `${distinct.size} distinct values`);

// ---------------------------------------------------------------- coverage
const covered = snapshot.watchlist.filter((s) => seen.has(s));
check('every watchlist slug is on the board', covered.length === snapshot.watchlist.length,
  `${covered.length}/${snapshot.watchlist.length}`);
const outside = rows.length - snapshot.watchlist.filter((s) => seen.has(s)).length;
check('at least 60 rows name protocols outside the watchlist', outside >= 60, `${outside} outside`);

// ---------------------------------------------------------------- dashboard_files
const dashDir = path.join(out, 'dashboard');
function walk(dir, base) {
  const outf = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const rel = base ? base + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (e.name.startsWith('.')) throw new Error('dot-directory ' + rel);
      outf.push(...walk(p, rel));
    } else if (e.isFile()) outf.push({ path: rel, size: fs.statSync(p).size });
    else throw new Error('neither file nor directory: ' + rel);
  }
  return outf;
}
const dashFiles = walk(dashDir, '');
check('dashboard/ holds index.html', dashFiles.some((f) => f.path === 'index.html'), '');
check('dashboard/ holds at least one .css', dashFiles.some((f) => f.path.endsWith('.css')), '');
check('dashboard/ holds at least one .js', dashFiles.some((f) => f.path.endsWith('.js')), '');
check('dashboard/ holds at most 400 files', dashFiles.length <= 400, `${dashFiles.length}`);
const dashBytes = dashFiles.reduce((n, f) => n + f.size, 0);
check('dashboard/ totals at most 4 MiB', dashBytes <= 4 * 1024 * 1024, `${dashBytes} bytes`);
const nameBad2 = dashFiles.filter((f) => !/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/.test(f.path.split('/').pop()));
check('every dashboard file name is plain', nameBad2.length === 0, nameBad2.map((f) => f.path).join(', '));

// No network address in an HTML attribute, a CSS file, or a JS import specifier.
const netHits = [];
for (const f of dashFiles) {
  const text = fs.readFileSync(path.join(dashDir, f.path), 'utf8');
  if (f.path.endsWith('.html')) {
    for (const m of text.matchAll(/<[^>]*>/g)) {
      const tag = m[0];
      for (const a of tag.matchAll(/([a-zA-Z-]+)\s*=\s*"([^"]*)"/g)) {
        if (/https?:\/\//.test(a[2])) netHits.push(`${f.path}: attribute ${a[1]}`);
      }
    }
    if (/<style[\s>]/i.test(text)) netHits.push(`${f.path}: inline <style>`);
    if (/<script[^>]*\bsrc\s*=\s*['"]https?:/i.test(text)) netHits.push(`${f.path}: script src`);
  }
  if (f.path.endsWith('.css') && /https?:\/\//.test(text)) netHits.push(`${f.path}: css url`);
  if (f.path.endsWith('.js')) {
    for (const m of text.matchAll(/(?:^|[\s;=(])(?:import|export)[^;'"]*?from\s*['"]([^'"]+)['"]/g)) {
      if (/https?:\/\//.test(m[1])) netHits.push(`${f.path}: import ${m[1]}`);
    }
    for (const m of text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (/https?:\/\//.test(m[1])) netHits.push(`${f.path}: dynamic import ${m[1]}`);
    }
    for (const m of text.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      if (/https?:\/\//.test(m[1])) netHits.push(`${f.path}: require ${m[1]}`);
    }
  }
}
check('no http:// or https:// in any dashboard attribute, CSS or import', netHits.length === 0, netHits.join(' | '));
const sourceBytes = dashFiles.filter((f) => /\.(html|css|js|json|mjs|svg|md|txt)$/.test(f.path)).reduce((n, f) => n + f.size, 0);
check('dashboard source stays under 64 KB (so the judge reads it whole)', sourceBytes < 65536, `${sourceBytes} bytes`);

// ---------------------------------------------------------------- screenshots
const shotDir = path.join(out, 'screenshots');
const shots = fs.readdirSync(shotDir).filter((n) => !n.startsWith('.')).sort();
check('screenshots/ holds 3 or 4 images', shots.length >= 3 && shots.length <= 4, `${shots.length}: ${shots.join(', ')}`);
for (const name of shots) {
  const p = path.join(shotDir, name);
  const st = fs.statSync(p);
  const b = fs.readFileSync(p);
  const isPng = b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const isJpg = b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const whole = isPng ? b.slice(-12).toString('binary').indexOf('IEND') !== -1 : isJpg && b[b.length - 2] === 0xff && b[b.length - 1] === 0xd9;
  let w = 0;
  let h = 0;
  if (isPng) { w = b.readUInt32BE(16); h = b.readUInt32BE(20); }
  check(`${name} is a whole PNG or JPEG`, isPng || isJpg, isPng ? 'PNG' : 'JPEG');
  check(`${name} is at most 512 KiB`, st.size <= 524288, `${st.size} bytes`);
  check(`${name} long side <= 1440 and short side >= 800`,
    Math.max(w, h) <= 1440 && Math.min(w, h) >= 800, `${w}x${h}`);
  check(`${name} is 300-350 KB (the dossier's target)`,
    st.size >= 300 * 1024 && st.size <= 350 * 1024, `${st.size} bytes`);
}

// ---------------------------------------------------------------- dossier_matches
const dossierPath = path.join(out, 'dossier.json');
const dossier = fs.readFileSync(dossierPath);
check('dossier.json is at most 1.5 MiB', dossier.length <= 1.5 * 1024 * 1024, `${dossier.length} bytes`);
const parsed = JSON.parse(dossier.toString('utf8'));
check('dossier schema is makefun/dossier/v1', parsed.schema === 'makefun/dossier/v1', parsed.schema);
check('dossier holds the three screenshots', parsed.images.length === shots.length, `${parsed.images.length}`);
check('dossier text names every dashboard file', dashFiles.every((f) => parsed.text.includes('- ' + f.path + ' (')),
  `${dashFiles.length} files`);
const cut = parsed.text.match(/\[Cut at (\d+) bytes/);
check('the dossier text holds the whole source (no cut)', cut === null, cut ? cut[0] : 'no cut line');

// Rebuild the dossier with the vendored library and compare byte for byte.
const { buildDossier } = await import(path.join(process.cwd(), 'vendor/makefun-board.ts'));
const rebuilt = Buffer.from(buildDossier(out, {
  text_max_bytes: 65536,
  screenshots: { max: 4, max_bytes: 524288 },
  dashboard: { max_files: 400, max_bytes: 4194304 }
}));
check('dossier.json is byte for byte what buildDossier writes', rebuilt.equals(dossier),
  rebuilt.equals(dossier) ? 'identical' : `rebuilt ${rebuilt.length} vs dossier ${dossier.length}`);

console.log('');
console.log(failures === 0 ? 'ALL GATES PASS' : `${failures} GATE(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
