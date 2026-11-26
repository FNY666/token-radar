// Is any shot's EDGE cutting a line of text?
//
//   node tools/shotedges.cjs <screenshots-dir>
//
// The detail shot is clipped to the drawer at a hard edge, so a line of text can be drawn half
// in and half out. The other two shots are full-page renders, so their edges are the page's own
// -- but the COVER is the page at 1280x800, and the page scrolls, so whatever is at the fold is
// what the judge sees.
//
// A row is "lit" if any pixel in it is well above the panel's background.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

function decodePng(p) {
  const d = fs.readFileSync(p);
  let o = 8, idat = null, ihdr = null;
  while (o < d.length) {
    const len = d.readUInt32BE(o);
    const type = d.toString('ascii', o + 4, o + 8);
    const body = d.slice(o + 8, o + 8 + len);
    if (type === 'IHDR') ihdr = body;
    if (type === 'IDAT') idat = idat ? Buffer.concat([idat, body]) : body;
    o += 12 + len;
    if (type === 'IEND') break;
  }
  if (!ihdr) return null;
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4);
  if (ihdr[8] !== 8 || ihdr[12] !== 0) return null;
  const ch = ihdr[9] === 6 ? 4 : ihdr[9] === 2 ? 3 : 0;
  if (!ch) return null;
  const stride = w * ch;
  const raw = zlib.inflateSync(idat);
  const out = Buffer.alloc(stride * h);
  let prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const rv = raw[y * (stride + 1) + 1 + x];
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v;
      if (ft === 0) v = rv;
      else if (ft === 1) v = rv + a;
      else if (ft === 2) v = rv + b;
      else if (ft === 3) v = rv + ((a + b) >> 1);
      else if (ft === 4) v = rv + paeth(a, b, c);
      else return null;
      cur[x] = v & 255;
    }
    cur.copy(out, y * stride);
    prev.set(cur);
  }
  return { w, h, ch, stride, px: out };
}

const dir = process.argv[2] || 'screenshots';
for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.png')).sort()) {
  const img = decodePng(path.join(dir, name));
  if (!img) { console.log(name, 'unreadable'); continue; }
  const litInRow = (y) => {
    const r = y * img.stride;
    let lit = 0;
    for (let x = 0; x < img.w; x++) {
      const i = r + x * img.ch;
      if (img.px[i] + img.px[i + 1] + img.px[i + 2] > 150) lit++;
    }
    return lit;
  };
  const litInCol = (x) => {
    let lit = 0;
    for (let y = 0; y < img.h; y++) {
      const i = y * img.stride + x * img.ch;
      if (img.px[i] + img.px[i + 1] + img.px[i + 2] > 150) lit++;
    }
    return lit;
  };
  const lastRow = litInRow(img.h - 1), firstRow = litInRow(0);
  const lastCol = litInCol(img.w - 1), firstCol = litInCol(0);
  console.log(
    name.padEnd(16), `${img.w}x${img.h}`.padEnd(10),
    'top=' + String(firstRow).padStart(5),
    'bottom=' + String(lastRow).padStart(5),
    'left=' + String(firstCol).padStart(5),
    'right=' + String(lastCol).padStart(5)
  );
}
