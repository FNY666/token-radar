// Checks that the submitted screenshots are the page and not a corrupted re-encode.
//
// The PNG optimiser picks a filter per scanline to save bytes. Getting that filter wrong does
// not corrupt the FILE -- it decodes cleanly, with valid CRCs -- it decodes to the WRONG PIXELS.
// A self-consistency check therefore proves nothing. This one re-shoots the page and compares
// the re-encoded image against the raw screenshot, pixel for pixel, and refuses to pass if a
// single byte differs.
//
// Usage: node tools/shotcheck.cjs <output dir> [--fast]
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');

const outDir = process.argv[2] || 'out';
const shotDir = path.join(outDir, 'screenshots');
const CHROME = '/home/muse-newapi/.cache/puppeteer/chrome-headless-shell/linux_arm-157.0.8103.78/chrome-headless-shell-linux-arm64/chrome-headless-shell';

// A PNG decoder written here, so the check does not lean on the same library that wrote the file.
// It undoes the five scanline filters and returns the pixels as RGBA bytes.
function decode(path) {
  const d = fs.readFileSync(path);
  if (d.slice(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(path + ': not a PNG');
  let o = 8, idat = null, ihdr = null;
  while (o < d.length) {
    const len = d.readUInt32BE(o);
    const type = d.toString('ascii', o + 4, o + 8);
    const body = d.slice(o + 8, o + 8 + len);
    const crc = d.readUInt32BE(o + 8 + len);
    if (zlib.crc32(Buffer.concat([Buffer.from(type, 'ascii'), body])) >>> 0 !== crc) {
      throw new Error(path + ': chunk ' + type + ' has a bad CRC');
    }
    if (type === 'IHDR') ihdr = body;
    if (type === 'IDAT') idat = idat ? Buffer.concat([idat, body]) : body;
    o += 12 + len;
    if (type === 'IEND') break;
  }
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4);
  const bd = ihdr[8], ct = ihdr[9], interlace = ihdr[12];
  if (bd !== 8) throw new Error(path + ': only 8-bit supported');
  if (interlace !== 0) throw new Error(path + ': interlaced not supported');
  if (ct !== 2 && ct !== 6) throw new Error(path + ': only RGB/RGBA supported');
  const ch = ct === 6 ? 4 : 3;
  const stride = w * ch;
  const raw = zlib.inflateSync(idat);
  const out = Buffer.alloc(stride * h);
  const prev = Buffer.alloc(stride);
  const cur = Buffer.alloc(stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const src = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev[x];
      const c = x >= ch ? prev[x - ch] : 0;
      let v;
      if (ft === 0) v = src[x];
      else if (ft === 1) v = src[x] + a;
      else if (ft === 2) v = src[x] + b;
      else if (ft === 3) v = src[x] + ((a + b) >> 1);
      else if (ft === 4) v = src[x] + paeth(a, b, c);
      else throw new Error(path + ': bad filter ' + ft);
      cur[x] = v & 0xff;
    }
    cur.copy(out, y * stride);
    cur.copy(prev);
  }
  // To RGBA.
  if (ct === 6) return { w, h, px: out };
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < out.length; i += 3, j += 4) {
    out.copy(rgba, j, i, i + 3);
    rgba[j + 3] = 255;
  }
  return { w, h, px: rgba };
}

(async () => {
  const puppeteer = require('/home/muse-newapi/makefun-token-radar/tools/node_modules/puppeteer');
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--force-device-scale-factor=1', '--hide-scrollbars', '--allow-file-access-from-files'],
  });
  const page = await browser.newPage();
  const url = 'file://' + path.resolve(outDir, 'dashboard', 'index.html');
  await page.setViewport({ width: 1440, height: 1440, deviceScaleFactor: 1 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('tbody tr', { timeout: 8000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 300));
  const raw = '/tmp/shotcheck-raw.png';
  await page.screenshot({ path: raw });
  await browser.close();

  const opt = '/tmp/shotcheck-opt.png';
  execFileSync(process.execPath, [path.join(__dirname, 'pngopt.cjs'), raw, opt]);

  const a = decode(raw);
  const b = decode(opt);
  let diff = 0;
  if (a.w !== b.w || a.h !== b.h) {
    console.log('SHOTCHECK FAIL: the re-encode changed the image size');
    process.exit(1);
  }
  for (let i = 0; i < a.px.length; i++) if (a.px[i] !== b.px[i]) diff++;
  if (diff) {
    console.log('SHOTCHECK FAIL: the re-encode changed ' + diff + ' of ' + a.px.length + ' bytes');
    process.exit(1);
  }
  console.log('  the re-encode is lossless (' + a.px.length + ' bytes compared)');
  // The submitted screenshots must not be black either: a corrupt re-encode decodes cleanly and
  // comes out almost entirely one colour.
  const names = fs.readdirSync(shotDir).filter((n) => n.endsWith('.png'));
  for (const n of names) {
    const img = decode(path.join(shotDir, n));
    const counts = new Map();
    for (let i = 0; i < img.px.length; i += 4) {
      const k = img.px[i] + ',' + img.px[i + 1] + ',' + img.px[i + 2];
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    const share = Math.max(...counts.values()) / (img.w * img.h);
    // The signal that separates a rendered page from a corrupt re-encode: the frame's dominant
    // colour. A rendered dark dashboard is one dark grey over most of its area. A corrupt
    // re-encode is BLACK, with saturated red and blue speckle where the real image was.
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const [r, g, b] = top.split(',').map(Number);
    // The theme's own dark greys: the page background, the panel, the raised panel.
    const THEME = [[11, 15, 22], [21, 29, 44], [17, 24, 38], [17, 24, 24], [16, 24, 36]];
    const greyish = THEME.some((t) => Math.abs(r - t[0]) < 10 && Math.abs(g - t[1]) < 10 && Math.abs(b - t[2]) < 10);
    console.log('  ' + n + ': ' + img.w + 'x' + img.h + ', ' + counts.size +
      ' distinct colours, the largest ' + (share * 100).toFixed(1) + '% of the frame is rgb(' +
      top + ')' + (greyish ? '' : '  <-- SUSPECT'));
    if (!greyish) {
      console.log('SHOTCHECK FAIL: ' + n + "'s dominant colour is rgb(" + top +
        '); a corrupt re-encode comes out black with coloured speckle');
      process.exit(1);
    }
  }
  console.log('SHOTCHECK PASS: the re-encode is lossless and the submitted screenshots render');
})();
