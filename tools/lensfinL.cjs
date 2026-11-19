const fs=require('fs');
(async()=>{
 const mod=await import('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs');
 const keys=Object.keys(mod).filter(k=>/dossier|judgeView|View/i.test(k));
 console.log(keys.join(', '));
})();
