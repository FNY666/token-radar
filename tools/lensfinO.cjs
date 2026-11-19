const fs=require('fs');
const KIT='/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs';
const kit=fs.readFileSync(KIT,'utf8');
function grab(name){const marker='function '+name+'(';const i=kit.indexOf(marker);if(i<0)return null;const rest=kit.slice(i+marker.length);const m=/\n(?:function |var [A-Za-z_$][\w$]*, |var [A-Za-z_$][\w$]*;|\/\/ )/.exec(rest);const end=m?i+marker.length+m.index+1:kit.length;return kit.slice(i,end).replace(/\nvar [^\n]*;\s*$/,'\n');}
const NAMES=['familyImageTokens','judgeImageTokens','sheetCell','restCell','languageOf2','readKitText','jsDeclares','declarationLines','capped','cutLine','firstLine15','fitLines','keptHead','viewText','splitPictures','contactSheet','parseDossier','dossierJudgeViewAt'];
const bodies=NAMES.map(n=>grab(n)).filter(Boolean);
console.log('missing:',NAMES.filter(n=>!grab(n)).join(','));
fs.writeFileSync('/tmp/jvfuncs.txt',bodies.join('\n\n'));
console.log('bytes',bodies.join('\n\n').length);
