import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const WORK = '/home/muse-newapi/makefun-token-radar/work';
const src = JSON.parse(readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json', 'utf8'));

// deterministic PRNG so the test itself is reproducible
let seed = 12345;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function shuffleKeys(o) {
  if (Array.isArray(o)) return o.map(shuffleKeys);
  if (o && typeof o === 'object') {
    const ks = shuffle(Object.keys(o));
    const r = {}; for (const k of ks) r[k] = shuffleKeys(o[k]); return r;
  }
  return o;
}

const variants = {
  base: src,
  shuffled_protocols: { ...src, protocols: shuffle([...src.protocols]) },
  shuffled_watchlist: { ...src, watchlist: shuffle([...src.watchlist]) },
  shuffled_both: { ...src, protocols: shuffle([...src.protocols]), watchlist: shuffle([...src.watchlist]) },
  shuffled_keys: shuffleKeys(src),
};

const results = {};
for (const [name, v] of Object.entries(variants)) {
  const dir = `/tmp/shuf/${name}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/snapshot.json`, JSON.stringify(v));
  execFileSync('node', ['main.ts', '--input', `${dir}/snapshot.json`], { cwd: WORK, env: { ...process.env, MAKEFUN_OUTPUT_DIR: `${dir}/out` }, stdio: 'pipe' });
  const board = readFileSync(`${dir}/out/board.json`);
  const data = readFileSync(`${dir}/out/data.js`);
  results[name] = {
    board: createHash('sha256').update(board).digest('hex').slice(0, 16),
    data: createHash('sha256').update(data).digest('hex').slice(0, 16),
    rows: JSON.parse(board).rows.length,
    firstRow: JSON.parse(board).rows[0].slug,
  };
  console.log(name, JSON.stringify(results[name]));
}
