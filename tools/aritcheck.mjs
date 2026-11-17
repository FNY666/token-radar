// Verify the page's own displayed arithmetic: log10 line, implied = cond*odds, and the row table figures.
import fs from 'node:fs';
const raw = fs.readFileSync('/tmp/fz/data.js','utf8');
const D = JSON.parse(raw.slice(raw.indexOf('=')+1).replace(/;\s*$/,''));
const win={}; new Function('window', fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/dashboard/model.js','utf8'))(win);
const M=win.RadarModel; const fit=M.fit(D);
let bad=[];
for (const r of D.rows) {
  const cond = fit.conditional(r.tvl_usd, r.change_7d, r.category);
  const log10 = r.tvl_usd>0 ? Math.log10(cond/r.tvl_usd) - r.category_log : 0;
  const odds = fit.launchP(r.tvl_usd, r.change_7d, r.age_days);
  const expected = Math.round(cond*odds);
  // the page's displayed "Fitted log10(mcap/TVL) before the correction"
  if (Math.abs(log10 - Math.log10(cond/r.tvl_usd) + r.category_log) > 1e-9) bad.push(['sign',r.slug]);
  // implied_value_usd must equal cond*odds as published
  if (expected !== r.implied_value_usd) bad.push(['impl',r.slug,expected,r.implied_value_usd]);
}
console.log('arith mismatches:', bad.length); bad.slice(0,10).forEach(b=>console.log(b));
// Now: does implied_value_usd == conditional_value_usd * launch_probability as published?
let n=0;
for (const r of D.rows) { const c=r.conditional_value_usd*r.launch_probability; if (Math.abs(c-r.implied_value_usd)>1) {n++;} }
console.log('published implied != published cond*prob:', n, 'of', D.rows.length);
