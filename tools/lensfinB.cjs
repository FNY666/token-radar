const fs=require('fs');
global.window={}; eval(fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/out/data.js','utf8'));
const R=window.RADAR;
const over=R.rows.filter(r=>(r.chains||[]).length>8);
console.log('rows with >8 chains:',over.length);
console.log(over.map(r=>r.name+' n='+r.chains.length+' wl='+r.on_watchlist).join('\n'));
console.log('watchlist rows total:',R.rows.filter(r=>r.on_watchlist).length);
console.log('watchlist rows with >8:',R.rows.filter(r=>r.on_watchlist&&r.chains.length>8).length);
console.log('watchlist names with >8:',R.rows.filter(r=>r.on_watchlist&&r.chains.length>8).map(r=>r.name).join(', '));
