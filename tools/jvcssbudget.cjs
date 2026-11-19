// What the judge reads of each CSS allocation, using the kit's own viewText over the
// entry's real dossier text. Reproduces the numbers behind the theme.css budget claim.
//
//   node tools/jvcssbudget.cjs [budget]   (default 30144, the kit's budget for token-radar-01)
const fs = require('node:fs');
const KIT = '/home/muse-newapi/makefun-token-radar/token-radar-01-kit/cli/makefun.mjs';
const kit = fs.readFileSync(KIT, 'utf8');
function grab(n) {
  const m = 'function ' + n + '('; const i = kit.indexOf(m); const r = kit.slice(i + m.length);
  const x = /\n(?:function |var [A-Za-z_$][\w$]*, |var [A-Za-z_$][\w$]*;|\/\/ )/.exec(r);
  return kit.slice(i, x ? i + m.length + x.index + 1 : kit.length).replace(/\nvar [^\n]*;\s*$/, '\n');
}
const NAMES = ['familyImageTokens','judgeImageTokens','sheetCell','restCell','languageOf2','readKitText','jsDeclares','declarationLines','capped','cutLine','firstLine15','fitLines','keptHead','viewText'];
const pre = `const utf8Bytes4=(s)=>Buffer.byteLength(s,"utf8");const jsonBytes=(s)=>utf8Bytes4(JSON.stringify(s))-2;const plural8=(n,o,m=\`\${o}s\`)=>\`\${n} \${n===1?o:m}\`;const HEAD_KEPT=/^(#{1,6}\\s|(Source files|Files|Scripts|Instances|Totals):\\s)/;const DECL_MAX_BYTES=96;const FENCE_OPEN2=/^(\`{3,}|~{3,})\\s*([A-Za-z0-9_+.-]*)\\s*$/;const JS_KEYWORDS2=new Set(["if","for","while","switch","catch","with","return","function","else","do","try","new","typeof","await","yield","super","delete","void","throw","in","of"]);const vendored=(s)=>/(^|\\/)vendor\\//.test(s.heading.slice(4).split(" (")[0]??"");const linesCost=(l)=>l.reduce((n,x)=>n+jsonBytes(\`\${x}\\n\`),0);`;
const K = new Function(pre + '\n' + NAMES.map(grab).join('\n\n') + '\nreturn {' + NAMES.map(n => n + ': ' + n).join(', ') + '};')();
const fence = (n) => n.endsWith('.css') ? 'css' : n.endsWith('.html') ? 'html' : 'js';
function build(files) {
  const s = [...files].sort(); const t = s.reduce((n, f) => n + Buffer.byteLength(f[1]), 0);
  let x = '## Dashboard\n\nFiles: ' + s.length + ' (' + t + ' bytes)\n';
  for (const f of s) x += '- ' + f[0] + ' (' + Buffer.byteLength(f[1]) + ' bytes)\n';
  x += '\n## Source\n\n';
  for (const f of s) {
    const L = f[1].replace(/\n$/, '').split('\n');
    x += '### ' + f[0] + '\n\n' + Buffer.byteLength(f[1]) + ' bytes, ' + L.length + ' line' + (L.length === 1 ? '' : 's') + '\n\n';
    x += '```' + fence(f[0]) + '\n' + f[1] + (f[1].endsWith('\n') ? '' : '\n') + '```\n\n';
  }
  return x;
}
function prefix(view, page) {
  const pl = page.replace(/\n$/, '').split('\n'); let p = 0;
  for (let i = 1; i <= pl.length; i++) { if (view.includes(pl.slice(0, i).join('\n'))) p = i; else break; }
  return p;
}
const D = '/home/muse-newapi/makefun-token-radar/work/dashboard/';
const c = {}; for (const n of ['colors.css','index.html','model.js','page.js','theme.css']) c[n] = fs.readFileSync(D + n, 'utf8');
const B = Number(process.argv[2] || 30144);
console.log('budget', B, '| theme.css', Buffer.byteLength(c['theme.css']), 'bytes |', (c['theme.css'].match(/\{/g) || []).length, 'rules');
const V = {
  'HEAD (theme.css last)':      [['colors.css',c['colors.css']],['index.html',c['index.html']],['model.js',c['model.js']],['page.js',c['page.js']],['theme.css',c['theme.css']]],
  'rename theme->z-theme.css':  [['colors.css',c['colors.css']],['index.html',c['index.html']],['model.js',c['model.js']],['page.js',c['page.js']],['z-theme.css',c['theme.css']]],
  'BOTH css -> z-theme.css':     [['index.html',c['index.html']],['model.js',c['model.js']],['page.js',c['page.js']],['z-theme.css',c['colors.css']+'\n'+c['theme.css']]],
  'BOTH css -> a-theme.css':     [['a-theme.css',c['colors.css']+'\n'+c['theme.css']],['index.html',c['index.html']],['model.js',c['model.js']],['page.js',c['page.js']]],
  'drop theme.css (unstyled)':   [['colors.css',c['colors.css']],['index.html',c['index.html']],['model.js',c['model.js']],['page.js',c['page.js']]],
  'no CSS at all (unstyled)':    [['index.html',c['index.html']],['model.js',c['model.js']],['page.js',c['page.js']]],
};
for (const [k, files] of Object.entries(V)) {
  const r = K.viewText(build(files), B, 3, true); const v = r.text;
  const hex = ['#f2b544','#49c6e8','#e06c9a','--rs:6px','--font:system-ui'].filter(h => v.includes(h)).length;
  const cssBody = /```css\n([\s\S]*?)\n```/.exec(v);
  console.log('  ' + k.padEnd(30) + ' page.js whole-prefix ' + String(prefix(v, c['page.js'])).padStart(4)
    + ' | palette facts ' + hex + '/5 | css body ' + String(cssBody ? Buffer.byteLength(cssBody[1]) : 0).padStart(6) + 'B | view ' + Buffer.byteLength(v));
}
