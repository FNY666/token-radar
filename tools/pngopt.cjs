// Re-encodes a PNG with a per-scanline filter chosen by the minimum-sum-of-absolute-differences
// heuristic, and deflate level 9. This is the standard lossless PNG optimiser and it makes the
// file smaller without changing a single pixel.
//
// The filter candidates are computed against the RECONSTRUCTED pixels of the row above, not
// against the filtered bytes on disk: the decoder reconstructs first and filters second, so the
// encoder must reconstruct first too. Doing it the other way round silently writes a PNG that
// decodes to different pixels -- the image looks corrupted, not merely re-compressed.
const fs = require('node:fs');
const zlib = require('node:zlib');

function readChunks(b) {
  let o = 8; const chunks = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o);
    const type = b.toString('ascii', o + 4, o + 8);
    const data = b.slice(o + 8, o + 8 + len);
    const crc = b.slice(o + 8 + len, o + 12 + len);
    chunks.push({ type, data, crc });
    o += 12 + len;
  }
  return chunks;
}
// The PNG chunk CRC: the CRC-32 of zlib, over the chunk's type and data.
function crc32(buf) {
  return zlib.crc32(buf) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function paeth(a, b, c) {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

const path = process.argv[2];
const b = fs.readFileSync(path);
const chunks = readChunks(b);
const ihdr = chunks.find(c => c.type === 'IHDR').data;
const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4);
const bd = ihdr[8], ct = ihdr[9];
if (bd !== 8) throw new Error('only 8-bit supported');
if (ct !== 2 && ct !== 6) throw new Error('only RGB/RGBA supported');
const channels = ct === 6 ? 4 : 3;
const idat = Buffer.concat(chunks.filter(c => c.type === 'IDAT').map(c => c.data));
const raw = zlib.inflateSync(idat);
const stride = w * channels;
const out = Buffer.alloc((stride + 1) * h);
// The reconstructed row: what the decoder will see once the filter is undone.
const prev = Buffer.alloc(stride);
const cur = Buffer.alloc(stride);
const cand = [0, 1, 2, 3, 4].map(() => Buffer.alloc(stride));
for (let y = 0; y < h; y++) {
  // Undo the source's filter to recover the true pixels of this row.
  const ft = raw[y * (stride + 1)];
  const src = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
  for (let x = 0; x < stride; x++) {
    const a = x >= channels ? cur[x - channels] : 0;
    const bb = prev[x];
    const c = x >= channels ? prev[x - channels] : 0;
    let v;
    if (ft === 0) v = src[x];
    else if (ft === 1) v = src[x] + a;
    else if (ft === 2) v = src[x] + bb;
    else if (ft === 3) v = src[x] + ((a + bb) >> 1);
    else if (ft === 4) v = src[x] + paeth(a, bb, c);
    else throw new Error('bad filter ' + ft);
    cur[x] = v & 0xff;
  }
  // Now encode that row with each filter, against the reconstructed row above.
  for (let x = 0; x < stride; x++) {
    const a = x >= channels ? cur[x - channels] : 0;
    const bb = prev[x];
    const c = x >= channels ? prev[x - channels] : 0;
    cand[0][x] = cur[x];
    cand[1][x] = (cur[x] - a) & 0xff;
    cand[2][x] = (cur[x] - bb) & 0xff;
    cand[3][x] = (cur[x] - ((a + bb) >> 1)) & 0xff;
    cand[4][x] = (cur[x] - paeth(a, bb, c)) & 0xff;
  }
  let best = 0, bestSum = Infinity;
  for (let f = 0; f < 5; f++) {
    let sum = 0;
    for (let x = 0; x < stride; x++) { const v = cand[f][x]; sum += v < 128 ? v : 256 - v; }
    if (sum < bestSum) { bestSum = sum; best = f; }
  }
  out[y * (stride + 1)] = best;
  cand[best].copy(out, y * (stride + 1) + 1);
  prev.set(cur);
}
const newIdat = zlib.deflateSync(out, { level: 9, memLevel: 9 });
const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])];
parts.push(chunk('IHDR', ihdr));
for (const c of chunks) {
  if (c.type === 'IDAT' || c.type === 'IHDR') continue;
  if (c.type === 'IEND') break;
  parts.push(chunk(c.type, c.data));
}
parts.push(chunk('IDAT', newIdat));
parts.push(chunk('IEND', Buffer.alloc(0)));
const res = Buffer.concat(parts);
fs.writeFileSync(process.argv[3] || path, res);
console.log(path, b.length, '->', res.length);
