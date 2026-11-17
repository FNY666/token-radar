// Judge view computed from the ACTUAL dossier text (as the house does), vs from an uncut text.
import fs from 'node:fs';
const KIT='/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs';
const kit=fs.readFileSync(KIT,'utf8');
function grab(name){const marker='function '+name+'(';const i=kit.indexOf(marker);if(i<0)throw new Error(name);const rest=kit.slice(i+marker.length);const m=/\n(?:function |var [A-Za-z_$][\w$]*, |var [A-Za-z_$][\w$]*;|\/\/ )/.exec(rest);const end=m?i+marker.length+m.index+1:kit.length;return kit.slice(i,end).replace(/\nvar [^\n]*;\s*$/,'\n');}
const NAMES=['familyImageTokens','judgeImageTokens','sheetCell','restCell','languageOf2','readKitText','jsDeclares','declarationLines','capped','cutLine','firstLine15','fitLines','keptHead','viewText'];
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
const DOSSIER_VIEW_ENTRY_TOKENS=1536;
const DOSSIER_VIEW_BUDGETS=Object.freeze({"token-radar-01":12288});
const SPLIT_ENTRY_TOKENS=4096;
const VIEW_PRICING_MODEL="superbot";
const SHEET_WIDTH=768;
const COVER_BOX={width:768,height:480};
const GAP=4;
const LARGE_COVER_BOX={width:1024,height:640};
const REST_BOX={width:1024,height:640};
const OPENAI_PATCH_MULTIPLIERS=[];
`;
const K=new Function(prelude+'\n'+NAMES.map(grab).join('\n\n')+'\nreturn {'+NAMES.map(n=>n+': '+n).join(', ')+'};')();
const BUDGET=30144;
const actual=fs.readFileSync('/tmp/dossier_text.txt','utf8');
// uncut: rebuild the text from the dashboard dir the way buildDossier would with a huge cap
const {buildDossier}=await import('/home/muse-newapi/makefun-token-radar/work/vendor/makefun-board.ts');
const big=buildDossier('/tmp/rep1',{text_max_bytes:10000000,screenshots:{max:4,max_bytes:524288},dashboard:{max_files:400,max_bytes:4194304}});
const uncut=JSON.parse(Buffer.from(big).toString('utf8')).text;
for (const [label,text] of [['ACTUAL (cut at 65536)',actual],['UNCUT (all source)',uncut]]) {
  const r=K.viewText(text,BUDGET,3,true);
  console.log(label+': view bytes',Buffer.byteLength(r.text),'form',r.form,'decls',r.decls,'bodies',r.bodies);
  fs.writeFileSync('/tmp/jv_'+label.split(' ')[0]+'.txt', r.text);
}

// per-file breakdown of the ACTUAL judge view
const names=['colors.css','index.html','model.js','page.js','theme.css'];
for (const n of names) {
  const t=fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/dashboard/'+n,'utf8');
  const lines=t.replace(/\n$/,'').split('\n');
  let best=0;
  for(let i=1;i<=lines.length;i++){ if(actual.includes(lines.slice(0,i).join('\n'))) best=i; else break; }
  console.log('  ACTUAL '+n.padEnd(13)+best+'/'+lines.length+' lines'+(best===lines.length?' (whole)':best===0?' (declarations only)':''));
}
