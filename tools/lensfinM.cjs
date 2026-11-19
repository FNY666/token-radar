const fs=require('fs');
const kit=fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs','utf8');
// find the __esm init for dossier_view and its exports object
const i=kit.indexOf('"server/judging/dossier-view.ts"');
console.log(kit.slice(i-200,i+1500));
