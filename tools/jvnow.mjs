// What does the kit's own viewText show for the CURRENT dossier at the judge's 30,144 budget?
import fs from 'node:fs';
const KIT='/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs';
const kit=fs.readFileSync(KIT,'utf8');
function grab(name){const marker='function '+name+'(';const i=kit.indexOf(marker);const rest=kit.slice(i+marker.length);const m=/\n(?:function |var [A-Za-z_$][\w$]*, |var [A-Za-z_$][\w$]*;|\/\/ )/.exec(rest);const end=m?i+marker.length+m.index+1:kit.length;return kit.slice(i,end).replace(/\nvar [^\n]*;\s*$/,'\n');}
const NAMES=['languageOf2','readKitText','jsDeclares','declarationLines','capped','cutLine','firstLine15','fitLines','keptHead','viewText'];
const prelude=`
const utf8Bytes4=(s3)=>Buffer.byteLength(s3,"utf8");
const jsonBytes=(s3)=>utf8Bytes4(JSON.stringify(s3))-2;
const plural8=(n9,one,many)=>(many===undefined?one+"s":many);
const HEAD_KEPT=/^(#{1,6}\\s|(Source files|Files|Scripts|Instances|Totals):\\s)/;
const DECL_MAX_BYTES=96;
const FENCE_OPEN2=/^(\`{3,}|~{3,})\\s*([A-Za-z0-9_+.-]*)\\s*$/;
const JS_KEYWORDS2=new Set(["if","for","while","switch","catch","with","return","function","else","do","try","new","typeof","await","yield","super","delete","void","throw","in","of"]);
const vendored=(s3)=>/(^|\\/)vendor\\//.test(s3.heading.slice(4).split(" (")[0]??"");
const linesCost=(lines2)=>lines2.reduce((n9,l2)=>n9+jsonBytes(\`\${l2}\\n\`),0);
`;
const K=new Function(prelude+'\n'+NAMES.map(grab).join('\n\n')+'\nreturn {'+NAMES.map(n=>n+': '+n).join(', ')+'};')();
const actual=JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/out/dossier.json','utf8')).text;
const v=K.viewText(actual,30144,3,true);
console.log('view bytes:', Buffer.byteLength(v.text));
for (const s of ['.missing','.missing h1','.chips','.chip-static','@media (max-width: 1000px)','@media (max-width: 420px)']) {
  console.log(s, '-> in judge view:', v.text.includes(s));
}
console.log('view tail:', JSON.stringify(v.text.slice(-300)));
