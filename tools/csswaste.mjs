// How many bytes of each dashboard file reach the judge, and how many are wasted?
import fs from 'node:fs';
const KIT='/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs';
const kit=fs.readFileSync(KIT,'utf8');
function grab(name){const marker='function '+name+'(';const i=kit.indexOf(marker);const rest=kit.slice(i+marker.length);const m=/\n(?:function |var [A-Za-z_$][\w$]*, |var [A-Za-z_$][\w$]*;|\/\/ )/.exec(rest);const end=m?i+marker.length+m.index+1:kit.length;return kit.slice(i,end).replace(/\nvar [^\n]*;\s*$/,'\n');}
const NAMES=['languageOf2','readKitText','jsDeclares','declarationLines','capped','cutLine','firstLine15','fitLines','keptHead','viewText'];
const prelude=`
const utf8Bytes4=(s3)=>Buffer.byteLength(s3,"utf8");
const jsonBytes=(s3)=>utf8Bytes4(JSON.stringify(s3))-2;
const HEAD_KEPT=/^(#{1,6}\\s|(Source files|Files|Scripts|Instances|Totals):\\s)/;
const DECL_MAX_BYTES=96;
const FENCE_OPEN2=/^(\`{3,}|~{3,})\\s*([A-Za-z0-9_+.-]*)\\s*$/;
const JS_KEYWORDS2=new Set(["if","for","while","switch","catch","with","return","function","else","do","try","new","typeof","await","yield","super","delete","void","throw","in","of"]);
const vendored=(s3)=>/(^|\\/)vendor\\//.test(s3.heading.slice(4).split(" (")[0]??"");
const linesCost=(lines2)=>lines2.reduce((n9,l2)=>n9+jsonBytes(\`\${l2}\\n\`),0);
`;
const K=new Function(prelude+'\n'+NAMES.map(grab).join('\n\n')+'\nreturn {'+NAMES.map(n=>n+': '+n).join(', ')+'};')();
const d=JSON.parse(fs.readFileSync('/tmp/r1/dossier.json','utf8'));
const kitText=K.readKitText(d.text);
console.log('dossier text bytes:', Buffer.byteLength(d.text));
console.log('\nPer file: source bytes -> bytes in the dossier text');
let total=0;
for(const s of kitText.sections){
  const name=s.heading.slice(4);
  const src=Buffer.byteLength(s.lines.map(l=>l+'\n').join(''),'utf8');
  const inText=Buffer.byteLength(s.lines.map(l=>l+'\n').join(''),'utf8');
  console.log(`  ${name.padEnd(13)} src ${String(src).padStart(6)}  in dossier ${String(inText).padStart(6)}  (${s.lines.length} lines)`);
  total+=src;
}
console.log('sum of section source bytes:', total);
// The judge view (30,144 bytes)
const view=fs.readFileSync('/tmp/jv_ACTUAL.txt','utf8');
console.log('\njudge view bytes:', Buffer.byteLength(view));
// how many bytes of the judge view are theme.css selectors vs their rule bodies
const cssDecls=kitText.sections.find(s=>s.heading.includes('theme.css'));
const cssInView=cssDecls.lines.filter(l=>view.includes(l)).length;
console.log('theme.css lines whose SELECTOR reaches the judge:', cssInView, 'of', cssDecls.lines.length);
// The CSS rule bodies in the source that the judge never sees
const theme=fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/dashboard/theme.css','utf8');
const bodyBytes=theme.split('\n').filter(l=>l.includes('{')&&l.trim().endsWith('}')).reduce((n,l)=>n+Buffer.byteLength(l,'utf8'),0);
console.log('theme.css bytes in rule bodies (dropped for the judge, counted against the cap):', bodyBytes, 'of', Buffer.byteLength(theme,'utf8'));
