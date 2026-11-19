// Independently verify the page's refit claim: recompute every board row from data.js's cohort
// and universe using dashboard/model.js's own fit() (the page's code), and compare with the
// board's published implied values.
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/dashboard/model.js', 'utf8');
const D = JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/out/data.js', 'utf8')
  .replace(/^window\.RADAR=/, '').replace(/;\n$/, ''));

const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const MODEL = ctx.window.RadarModel.fit(D);

let exact = 0, worst = 0, worstSlug = '';
for (const r of D.rows) {
  const cond = MODEL.conditional(r.tvl_usd, r.change_7d, r.category);
  const odds = MODEL.launchP(r.tvl_usd, r.change_7d, r.age_days);
  const ev = Math.round(cond * odds);
  if (ev === r.implied_value_usd) exact++;
  const gap = r.implied_value_usd > 0 ? Math.abs(ev - r.implied_value_usd) / r.implied_value_usd : 0;
  if (gap > worst) { worst = gap; worstSlug = r.slug; }
}
console.log('rows:', D.rows.length, 'reproduce exactly:', exact, 'worst relative gap:', (worst * 100).toFixed(4) + '%', worstSlug);
console.log('page value_beta :', JSON.stringify(MODEL.value_beta));
console.log('board value_beta:', JSON.stringify(D.calibration.value_beta));
console.log('page launch_beta :', JSON.stringify(MODEL.launch_beta.map((b) => Math.round(b * 1e6) / 1e6)));
console.log('board launch_beta:', JSON.stringify(D.calibration.launch_beta));
console.log('page auc:', MODEL.launch_auc, 'board auc:', D.calibration.launch_auc);
console.log('page mae:', MODEL.mae_log10, 'board mae:', D.calibration.mae_log10);
