// Compare the stored screenshots with a fresh render of the current page, region by region,
// by pixel content. Pure PNG decode in node (no libs): parse IHDR/IDAT, unfilter, compare.
const fs = require('node:fs');
const zlib = require('node:zlib');

function decodePNG(path) {
  const buf = fs.readFileSync(path);
  let o = 8, idat = [], ihdr = null;
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.toString('ascii', o + 4, o + 8);
    const body = buf.slice(o + 8, o + 8 + len);
    if (type === 'IHDR') ihdr = body;
    if (type === 'IDAT') idat.push(body);
    o += 12 + len;
    if (type === 'IEND') break;
  }
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4);
  const depth = ihdr[8], ct = ihdr[9];
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : 1;
  if (depth !== 8) throw new Error('depth ' + depth);
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
      else { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = src[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[x] = v & 0xff;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, ch, data: out };
}

function regionSignature(img, y0, y1) {
  // a crude fingerprint: per-row set of distinct colours, so a layout change shows up
  const rows = [];
  for (let y = y0; y < Math.min(y1, img.h); y++) {
    const set = new Set();
    for (let x = 0; x < img.w; x += 3) {
      const i = y * img.w * img.ch + x * img.ch;
      set.add(img.data[i] + ',' + img.data[i + 1] + ',' + img.data[i + 2]);
    }
    rows.push(set.size);
  }
  return rows;
}

const a = decodePNG(process.argv[2]);
const b = decodePNG(process.argv[3]);
console.log('A', process.argv[2], a.w + 'x' + a.h, 'ch', a.ch);
console.log('B', process.argv[3], b.w + 'x' + b.h, 'ch', b.ch);
const W = Math.min(a.w, b.w), H = Math.min(a.h, b.h);
// per-band difference
for (let y0 = 0; y0 < H; y0 += 120) {
  const y1 = Math.min(y0 + 120, H);
  let diff = 0, tot = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < W; x += 2) {
      const ia = y * a.w * a.ch + x * a.ch, ib = y * b.w * b.ch + x * b.ch;
      const d = Math.abs(a.data[ia] - b.data[ib]) + Math.abs(a.data[ia + 1] - b.data[ib + 1]) + Math.abs(a.data[ia + 2] - b.data[ib + 2]);
      diff += d; tot += 3;
    }
  }
  console.log(`rows ${String(y0).padStart(4)}-${String(y1).padStart(4)}: mean abs channel diff ${(diff / (tot / 3)).toFixed(2)}`);
}
