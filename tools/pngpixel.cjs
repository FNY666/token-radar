// Prints the colour of one pixel, to locate a panel's edge in a PNG.
//
//   node tools/pngpixel.cjs <png> <x> <y>
const fs = require('node:fs');
const zlib = require('node:zlib');

function decodePNG(path) {
  const buf = fs.readFileSync(path);
  let o = 8, idat = [], ihdr = null;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const body = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') ihdr = body;
    if (type === 'IDAT') idat.push(body);
    o += 12 + len;
    if (type === 'IEND') break;
  }
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4);
  const ct = ihdr[9];
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v;
      if (ft === 0) v = src[x];
      else if (ft === 1) v = src[x] + a;
      else if (ft === 2) v = src[x] + b;
      else if (ft === 3) v = src[x] + ((a + b) >> 1);
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = src[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else v = src[x];
      cur[x] = v & 0xff;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, ch, data: out };
}

const [png, xs, ys] = process.argv.slice(2);
const { w, h, ch, data } = decodePNG(png);
const x = Number(xs), y = Number(ys);
const i = y * w * ch + x * ch;
console.log(`(${x},${y}) rgb=${data[i]},${data[i + 1]},${data[i + 2]}`);
