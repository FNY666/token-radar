// Compacts theme.css: shortens the CUSTOM PROPERTY names that this file defines, so the
// file's own bytes fall while every computed value stays exactly the same.
//
// The renames are applied to the whole file at once, so a definition and every use of it move
// together. A use that still pointed at an old name would resolve to nothing and show up in
// the computed style, which tools/stylediff.cjs checks on every element of every view.
const fs = require('node:fs');
const p = process.argv[2];
let s = fs.readFileSync(p, 'utf8');

const renames = {
  '--value-07': '--v07', '--value-08': '--v08', '--value-14': '--v14', '--value-28': '--v28',
  '--value-40': '--v40', '--value-45': '--v45', '--odds-12': '--o12', '--odds-40': '--o40',
  '--odds-45': '--o45', '--live-13': '--l13',
  '--ink-2': '--i2', '--ink-3': '--i3', '--bg-2': '--b2', '--panel-2': '--p2',
  '--line-2': '--l2', '--r-sm': '--rs', '--r-md': '--rm',
};
// Only a property DEFINED in this file may be renamed here: the others live in colors.css.
const definedHere = new Set([...s.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]));
const local = {};
for (const [from, to] of Object.entries(renames)) if (definedHere.has(from)) local[from] = to;

const before = s.length;
for (const [from, to] of Object.entries(local)) {
  // A word boundary so --ink-2 is not renamed inside --ink-3.
  s = s.replace(new RegExp(from + '(?![a-z0-9-])', 'g'), to);
}
fs.writeFileSync(p, s);
console.log('renamed', Object.keys(local).length, 'properties; bytes', before, '->', s.length);
