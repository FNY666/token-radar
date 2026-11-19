const fs=require('fs');
const src=fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/out/data.js','utf8');
// find plans
const re=/of gas and nothing else/g;
const rows=[];
// crude: split on protocol boundaries by finding each "gas and nothing else" and the nearest following "a week, so $"
const idx=[...src.matchAll(/about \$(\d+) of gas and nothing else/g)].map(m=>({single:Number(m[1]),i:m.index}));
const wk=[...src.matchAll(/about \$(\d+) of gas a week, so \$(\d+) across/g)].map(m=>({weekly:Number(m[1]),month:Number(m[2]),i:m.index}));
console.log('single-count',idx.length,'weekly-count',wk.length);
let below=0,equal=0,above=0,badMonth=0;
for(const w of wk){
  // nearest preceding single
  let best=null;
  for(const s of idx){ if(s.i<w.i && (!best||s.i>best.i)) best=s; }
  if(!best) continue;
  if(w.weekly<best.single) below++;
  else if(w.weekly===best.single) equal++;
  else above++;
  if(w.month!==w.weekly*4) badMonth++;
}
console.log('weekly BELOW single:',below,'EQUAL:',equal,'ABOVE:',above);
console.log('month != 4*weekly:',badMonth);
