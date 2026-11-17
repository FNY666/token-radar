// Does the page's OWN model (dashboard/model.js) reproduce the numbers lib/model.ts published?
import fs from 'node:fs';
const WORK='/home/muse-newapi/makefun-token-radar/work';
const raw = fs.readFileSync('/tmp/fz/data.js','utf8');
const D = JSON.parse(raw.slice(raw.indexOf('=')+1).replace(/;\s*$/,''));
const win = { };
const code = fs.readFileSync(WORK+'/dashboard/model.js','utf8');
new Function('window', code)(win);
const M = win.RadarModel;
const fit = M.fit(D);
console.log('page-fit value_beta ', JSON.stringify(fit.value_beta));
console.log('board  value_beta  ', JSON.stringify(D.calibration.value_beta));
console.log('page-fit launch_beta', JSON.stringify(fit.launch_beta));
console.log('board  launch_beta ', JSON.stringify(D.calibration.launch_beta));
console.log('page mae', fit.mae_log10, 'board mae', D.calibration.mae_log10);
console.log('page auc', fit.launch_auc, 'board auc', D.calibration.launch_auc);
let maxCond=0, maxP=0, nP=0, nC=0;
for (const r of D.rows) {
  const c = fit.conditional(r.tvl_usd, r.change_7d, r.category);
  const p = fit.launchP(r.tvl_usd, r.change_7d, r.age_days);
  const dc = Math.abs(c - r.conditional_value_usd)/Math.max(1,r.conditional_value_usd);
  const dp = Math.abs(p - r.launch_probability);
  if (dc>0.005) nC++;
  if (dp>0.01) nP++;
  if (dc>maxCond) maxCond=dc;
  if (dp>maxP) maxP=dp;
}
console.log('rows', D.rows.length, 'cond mismatches(>0.5%):', nC, 'max rel dev', maxCond);
console.log('prob mismatches(>0.01):', nP, 'max abs dev', maxP);
// category corrections
let catBad=0;
for (const [k,v] of Object.entries(D.calibration.category_log)) {
  const pv = fit.category_log[k];
  if (pv===undefined || Math.abs(pv-v)>0.001) { catBad++; console.log('cat',k,'board',v,'page',pv); }
}
console.log('category mismatches:', catBad, 'of', Object.keys(D.calibration.category_log).length);
