// Simulate the seven scorer rows from RULES.txt against a built /output.
import fs from 'node:fs';
const OUT=process.argv[2]||'/tmp/f1';
const SNAP=JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/input/snapshot.json','utf8'));
const probs=[];
const ok=(n,c,d)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':'   '+d)); if(!c)probs.push(n);};
// 1 dashboard_files
const dashDir=OUT+'/dashboard';
const walk=(d,pre='')=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name,pre+e.name+'/'):[pre+e.name]);
const dashFiles=walk(dashDir);
const allFiles=[...dashFiles, ...fs.readdirSync(OUT+'/screenshots').filter(n=>!n.startsWith('.')).map(n=>'screenshots/'+n)];
const plain=/^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;
ok('dashboard_files: names plain', dashFiles.every(f=>plain.test(f.split('/').pop())), dashFiles.join(','));
const dashBytes=dashFiles.reduce((n,f)=>n+fs.statSync(dashDir+'/'+f).size,0);
ok('dashboard_files: <=400 files, <=4MiB', dashFiles.length<=400&&dashBytes<=4*1024*1024, `${dashFiles.length} files ${dashBytes} bytes`);
ok('dashboard_files: has index.html + css + js', fs.existsSync(dashDir+'/index.html')&&dashFiles.some(f=>f.endsWith('.css'))&&dashFiles.some(f=>f.endsWith('.js')),'');
const netHits=[];
for(const f of dashFiles){const t=fs.readFileSync(dashDir+'/'+f,'utf8');
  if(/https?:\/\//.test(t) && !/\/\/|\/\*/.test(t.split('\n').filter(l=>!l.trim().startsWith('//')&&!l.trim().startsWith('/*')).join('\n'))) netHits.push(f);}
ok('dashboard_files: no network addresses', netHits.length===0, netHits.join(','));
// 2 board_file
const b=JSON.parse(fs.readFileSync(OUT+'/board.json','utf8'));
const rows=Array.isArray(b)?b:b.rows;
const slugs=new Set(SNAP.protocols.map(p=>p.slug));
ok('board_file: 100..4000 rows', rows.length>=100&&rows.length<=4000, String(rows.length));
ok('board_file: every slug is a snapshot protocol', rows.every(r=>slugs.has(r.slug)), rows.filter(r=>!slugs.has(r.slug)).map(r=>r.slug).slice(0,3).join(','));
ok('board_file: slugs unique', new Set(rows.map(r=>r.slug)).size===rows.length, '');
ok('board_file: names non-empty', rows.every(r=>typeof r.name==='string'&&r.name.length>0),'');
ok('board_file: rank positive whole', rows.every(r=>Number.isInteger(r.rank)&&r.rank>0),'');
ok('board_file: implied_value positive whole <=1e14', rows.every(r=>Number.isInteger(r.implied_value_usd)&&r.implied_value_usd>0&&r.implied_value_usd<=1e14), rows.filter(r=>!Number.isInteger(r.implied_value_usd)).map(r=>r.slug).slice(0,3).join(','));
ok('board_file: not all values equal', !(rows.length>=2&&rows[0].implied_value_usd===rows[rows.length-1].implied_value_usd),'');
ok('board_file: <=8MiB', fs.statSync(OUT+'/board.json').size<=8*1024*1024, '');
// 3 sorted_by_value
const ranks=rows.map(r=>r.rank).sort((a,b)=>a-b);
ok('sorted_by_value: ranks are 1..N once each', ranks.every((v,i)=>v===i+1),'');
ok('sorted_by_value: implied value does not rise with rank', rows.every((r,i)=>i===0||rows[i-1].implied_value_usd>=r.implied_value_usd), '');
// 4 coverage
const rowSlugs=new Set(rows.map(r=>r.slug));
const missing=SNAP.watchlist.filter(s=>!rowSlugs.has(s));
ok('coverage: every watchlist slug present', missing.length===0, missing.slice(0,5).join(','));
const outside=rows.filter(r=>!SNAP.watchlist.includes(r.slug)).length;
ok('coverage: >=60 rows outside the watchlist', outside>=60, String(outside));
// 5 farm_steps
let fsBad=[];
for(const r of rows){ const st=r.farm_steps||[];
  if(st.length<3||st.length>12) fsBad.push([r.slug,'count '+st.length]);
  for(const s of st){const t=s.trim(); if(t.length<20||t.length>600) fsBad.push([r.slug,'len '+t.length]);}}
ok('farm_steps: 3..12 steps of 20..600 chars', fsBad.length===0, fsBad.slice(0,3).map(x=>x.join(' ')).join(' | '));
// 6 screenshots
const shots=fs.readdirSync(OUT+'/screenshots').filter(n=>!n.startsWith('.'));
ok('screenshots: 3 or 4', shots.length>=3&&shots.length<=4, shots.join(','));
let shBad=[];
for(const s of shots){const p=OUT+'/screenshots/'+s; const b2=fs.readFileSync(p);
  if(b2.length>512*1024) shBad.push(s+' >512KiB');
  const png=b2.slice(0,8).toString('hex')==='89504e470d0a1a0a'; const jpg=b2[0]===0xff&&b2[1]===0xd8;
  if(!png&&!jpg) shBad.push(s+' not png/jpeg');
  const dim=png?{w:b2.readUInt32BE(16),h:b2.readUInt32BE(20)}:null;
  if(dim){const long=Math.max(dim.w,dim.h),short=Math.min(dim.w,dim.h);
    if(long>1440) shBad.push(s+' long side '+long);
    if(short<800) shBad.push(s+' short side '+short);}
}
ok('screenshots: within caps', shBad.length===0, shBad.join(','));
// 7 dossier_matches
const {buildDossier}=await import('/home/muse-newapi/makefun-token-radar/work/vendor/makefun-board.ts');
const rebuilt=Buffer.from(buildDossier(OUT,{text_max_bytes:65536,screenshots:{max:4,max_bytes:524288},dashboard:{max_files:400,max_bytes:4194304}}));
const written=fs.readFileSync(OUT+'/dossier.json');
ok('dossier_matches: byte-for-byte what buildDossier writes', rebuilt.equals(written), `${rebuilt.length} vs ${written.length}`);
ok('dossier_matches: <=1.5MiB', written.length<=1.5*1024*1024, String(written.length));
console.log('\n'+(probs.length? probs.length+' GATE ROW(S) FAILED': 'ALL SEVEN GATE ROWS PASS'));
