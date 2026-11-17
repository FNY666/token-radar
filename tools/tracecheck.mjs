import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const snap = JSON.parse(readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json','utf8'));
const board = JSON.parse(readFileSync('/tmp/fz/board.json','utf8')).rows;
const dataRaw = readFileSync('/tmp/fz/data.js','utf8');
const D = JSON.parse(dataRaw.slice(dataRaw.indexOf('=')+1).replace(/;\s*$/,''));

const problems = [];
// 1. board rows vs snapshot
for (const r of board) {
  const p = snap.protocols.find(p => p.slug === r.slug);
  if (!p) { problems.push(['no snapshot protocol', r.slug]); continue; }
  for (const k of ['name','category','tvl_usd','change_7d','listed_at','mcap_usd','gecko_id','symbol']) {
    if (JSON.stringify(p[k]) !== JSON.stringify(r[k])) problems.push([`board.${k} mismatch`, r.slug, JSON.stringify(p[k]), JSON.stringify(r[k])]);
  }
  if (JSON.stringify(p.chains) !== JSON.stringify(r.chains)) problems.push(['chains', r.slug]);
}
// 2. data.js rows vs board rows
const boardBySlug = new Map(board.map(r=>[r.slug,r]));
let checked = 0;
for (const dr of D.rows) {
  const br = boardBySlug.get(dr.slug);
  if (!br) { problems.push(['data row not in board', dr.slug]); continue; }
  checked++;
  for (const k of ['rank','name','tvl_usd','implied_value_usd','conditional_value_usd','launch_probability','category_log','change_7d','listed_at','age_days','on_watchlist','token_status']) {
    if (JSON.stringify(br[k]) !== JSON.stringify(dr[k])) problems.push([`data.${k} != board.${k}`, dr.slug, JSON.stringify(br[k]), JSON.stringify(dr[k])]);
  }
  if (JSON.stringify(br.farm_steps) !== JSON.stringify(dr.farm_steps)) problems.push(['farm_steps differ', dr.slug]);
  if (JSON.stringify(br.model) !== JSON.stringify(dr.model)) problems.push(['model differs', dr.slug]);
}
// 3. implied_value == conditional * probability (within rounding)
for (const r of board) {
  const calc = r.conditional_value_usd * r.launch_probability;
  const diff = Math.abs(calc - r.implied_value_usd);
  if (diff > Math.max(2, r.implied_value_usd*0.001)) problems.push(['implied != cond*p', r.slug, r.implied_value_usd, calc.toFixed(2)]);
}
// 4. rank order matches implied value desc
for (let i=1;i<board.length;i++) if (board[i].implied_value_usd > board[i-1].implied_value_usd) problems.push(['rank order', i]);
// 5. growth_pct vs change_7d
for (const r of board) if (Math.abs(r.growth_pct - r.change_7d) > 1e-9) problems.push(['growth != change7d', r.slug]);
// 6. age_days vs listed_at
const asOf = Date.parse(snap.as_of + 'T00:00:00Z');
for (const r of board) {
  const d = Math.round((asOf - Date.parse(r.listed_at+'T00:00:00Z'))/86400000);
  if (d !== r.age_days) problems.push(['age_days', r.slug, r.age_days, d]);
}
console.log('board rows', board.length, 'data rows checked', checked);
console.log('problems:', problems.length);
for (const p of problems.slice(0,40)) console.log(' ', p.join(' | '));
