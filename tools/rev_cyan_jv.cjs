const fs=require('node:fs');
const {execSync}=require('node:child_process');
const kit=fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs','utf8');
function grab(name){const marker='function '+name+'(';const i=kit.indexOf(marker);const rest=kit.slice(i+marker.length);const m=/\n(?:function |var [A-Za-z_$][\w$]*, |var [A-Za-z_$][\w$]*;|\/\/ )/.exec(rest);const end=m?i+marker.length+m.index+1:kit.length;return kit.slice(i,end).replace(/\nvar [^\n]*;\s*$/,'\n');}
const NAMES=['familyImageTokens','judgeImageTokens','sheetCell','restCell','languageOf2','readKitText','jsDeclares','declarationLines','capped','cutLine','firstLine15','fitLines','keptHead','viewText'];
const body=NAMES.map(grab).join('\n\n');
const prelude=fs.readFileSync('/dev/stdin','utf8');
