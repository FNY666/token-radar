// Crop a region out of a PNG and write it as a new PNG, so a stored screenshot's text can be
// compared with the current render visually.
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
      else { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v = src[x] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[x] = v & 0xff;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, ch, data: out };
}

function crc32(buf) {
  let c, table = crc32.t;
  if (!table) {
    table = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(path, w, h, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  fs.writeFileSync(path, Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

const [src, out, X0, Y0, X1, Y1] = process.argv.slice(2);
const img = decodePNG(src);
const x0 = +X0, y0 = +Y0, x1 = +X1, y1 = +Y1;
const cw = Math.min(x1, img.w) - x0, chh = Math.min(y1, img.h) - y0;
const rgb = Buffer.alloc(cw * chh * 3);
for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
  const si = ((y + y0) * img.w + (x + x0)) * img.ch;
  const di = (y * cw + x) * 3;
  rgb[di] = img.data[si]; rgb[di + 1] = img.data[si + 1]; rgb[di + 2] = img.data[si + 2];
}
writePNG(out, cw, chh, rgb);
console.log('wrote', out, cw + 'x' + chh);
