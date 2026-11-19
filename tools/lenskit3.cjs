const fs=require('fs');
const kit=fs.readFileSync('/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs','utf8');
function grab(name){const marker='function '+name+'(';const i=kit.indexOf(marker);if(i<0)return null;const rest=kit.slice(i+marker.length);const m=/\n(?:function |var [A-Za-z_$][\w$]*, |var [A-Za-z_$][\w$]*;|\/\/ )/.exec(rest);const end=m?i+marker.length+m.index+1:kit.length;return kit.slice(i,end).replace(/\nvar [^\n]*;\s*$/,'\n');}
const names=['parseDossier','viewText','judgeImageTokens','familyImageTokens','sheetCell','restCell','languageOf2','readKitText','jsDeclares','declarationLines','capped','cutLine','firstLine15','fitLines','keptHead'];
const bodies=names.map(n=>grab(n)).filter(Boolean);
const pre=`
const utf8Bytes4=(s3)=>Buffer.byteLength(s3,"utf8");
const jsonBytes=(s3)=>utf8Bytes4(JSON.stringify(s3))-2;
const plural8=(n9,one,many)=>(many===undefined?one+"s":many);
const HEAD_KEPT=/^(#{1,6}\\s|(Source files|Files|Scripts|Instances|Totals):\\s)/;
const DECL_MAX_BYTES=96;
const FENCE_OPEN2=/^(\`{3,}|~{3,})\\s*([A-Za-z0-9_+.-]*)\\s*$/;
const JS_KEYWORDS2=new Set(["if","for","while","switch","catch","with","return","function","else","do","try","new","typeof","await","yield","super","delete","void","throw","in","of"]);
const vendored=(s3)=>/(^|\\/)vendor\\//.test(s3.heading.slice(4).split(" (")[0]??"");
const linesCost=(lines2)=>lines2.reduce((n9,l2)=>n9+jsonBytes(l2+"\\n"),0);
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
const K=new Function(pre+'const sha256Hex11=(b)=>require("node:crypto").createHash("sha256").update(b).digest("hex");\n'+bodies.join('\n\n')+'\nreturn {'+names.map(n=>n+':'+n).join(',')+'};')();
const d=JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/out/dossier.json','utf8'));
for (const imgTok of [2240,1120]) {
  const budget=(12288-imgTok)*3;
  const v=K.viewText(d.text,budget,d.images.length,true);
  fs.writeFileSync('/home/muse-newapi/makefun-token-radar/work/tools/_jvkit_'+imgTok+'.txt',v.text);
  console.log('imgTokens',imgTok,'textBudget',budget,'viewBytes',Buffer.byteLength(v.text),
    'has slice(0, 8):',v.text.includes('slice(0, 8)'),
    'has "var kids = [head, chips]":',v.text.includes('var kids = [head, chips];'),
    'has Chains line:',v.text.includes("line('Chains'"));
}
