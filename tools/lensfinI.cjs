const fs=require('fs');
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
const K=new Function(prelude+'\n'+NAMES.map(grab).join('\n\n')+'\nreturn {'+NAMES.map(n=>n+':'+n).join(',')+'};')();
const d=JSON.parse(fs.readFileSync('/home/muse-newapi/makefun-token-radar/work/out/dossier.json','utf8'));
// real competition budget: 12288 tokens; split3 = true (>=4096)
// images are split into cover + sheet. approximate image token cost using split sizes.
const BPT=3;
for (const entryTokens of [12288,1536]) {
  const split3 = entryTokens >= 4096;
  // measure the split picture sizes the kit would use
  const {execSync}=require('child_process');
  const r=K.viewText(d.text, 10*1024*1024, d.images.length, split3);
  // compute text budget = (entryTokens - imageTokens)*3 ; imageTokens unknown here, so scan budgets
  for (const tok of [12288]) {
    for (const imgTok of [2704, 2236, 2704+2236, 5408]) {
      const budget=(tok-imgTok)*BPT;
      if (budget<=0) continue;
      const v=K.viewText(d.text,budget,d.images.length,split3);
      console.log('entryTokens',tok,'imgTokens',imgTok,'textBudget',budget,'viewBytes',Buffer.byteLength(v.text),
        'has slice(0, 8):',v.text.includes('slice(0, 8)'), 'form',v.form);
    }
  }
  break;
}
