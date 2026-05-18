/**
 * generate-icons.cjs
 * Generates all Tauri icons from VAR.png using only built-in Node.js APIs.
 * No external dependencies needed.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const iconsDir = path.join(__dirname, 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

const source = path.join(__dirname, 'VAR.png');
if (!fs.existsSync(source)) {
  console.error('❌ VAR.png not found in project root!');
  process.exit(1);
}

console.log('Generating icons from VAR.png...');

// ── Minimal PNG decoder (handles RGBA 8-bit PNGs) ─────────────────────────
function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG');
  let i = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idatChunks = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i); i += 4;
    const type = buf.toString('ascii', i, i + 4); i += 4;
    const data = buf.slice(i, i + len); i += len + 4; // skip CRC
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    }
  }
  if (bitDepth !== 8) throw new Error(`Unsupported bit depth: ${bitDepth}`);
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * bytesPerPixel;
  // Reconstruct pixels with PNG filter
  const pixels = Buffer.alloc(width * height * 4);
  let rowStart = 0;
  for (let y = 0; y < height; y++) {
    const filterByte = raw[rowStart];
    const row = raw.slice(rowStart + 1, rowStart + 1 + stride);
    rowStart += 1 + stride;
    const prev = y > 0 ? pixels.slice((y - 1) * width * 4, y * width * 4) : null;
    for (let x = 0; x < width; x++) {
      let r, g, b, a;
      const ri = x * bytesPerPixel;
      if (colorType === 6) { r = row[ri]; g = row[ri+1]; b = row[ri+2]; a = row[ri+3]; }
      else if (colorType === 2) { r = row[ri]; g = row[ri+1]; b = row[ri+2]; a = 255; }
      else { r = g = b = row[ri]; a = 255; }
      // Apply filter
      if (filterByte === 1 && x > 0) { // Sub
        r = (r + pixels[(y * width + x - 1) * 4]) & 0xff;
        g = (g + pixels[(y * width + x - 1) * 4 + 1]) & 0xff;
        b = (b + pixels[(y * width + x - 1) * 4 + 2]) & 0xff;
        a = (a + pixels[(y * width + x - 1) * 4 + 3]) & 0xff;
      } else if (filterByte === 2 && prev) { // Up
        r = (r + prev[x * 4]) & 0xff;
        g = (g + prev[x * 4 + 1]) & 0xff;
        b = (b + prev[x * 4 + 2]) & 0xff;
        a = (a + prev[x * 4 + 3]) & 0xff;
      }
      const pi = (y * width + x) * 4;
      pixels[pi] = r; pixels[pi+1] = g; pixels[pi+2] = b; pixels[pi+3] = a;
    }
  }
  return { width, height, pixels };
}

// ── Bilinear resize ────────────────────────────────────────────────────────
function resizePixels(src, sw, sh, dw, dh) {
  const dst = Buffer.alloc(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const sx = (x / dw) * sw;
      const sy = (y / dh) * sh;
      const x0 = Math.min(Math.floor(sx), sw - 1);
      const y0 = Math.min(Math.floor(sy), sh - 1);
      const x1 = Math.min(x0 + 1, sw - 1);
      const y1 = Math.min(y0 + 1, sh - 1);
      const fx = sx - x0, fy = sy - y0;
      for (let c = 0; c < 4; c++) {
        const tl = src[(y0 * sw + x0) * 4 + c];
        const tr = src[(y0 * sw + x1) * 4 + c];
        const bl = src[(y1 * sw + x0) * 4 + c];
        const br = src[(y1 * sw + x1) * 4 + c];
        dst[(y * dw + x) * 4 + c] = Math.round(
          tl * (1 - fx) * (1 - fy) + tr * fx * (1 - fy) +
          bl * (1 - fx) * fy       + br * fx * fy
        );
      }
    }
  }
  return dst;
}

// ── Minimal PNG encoder ────────────────────────────────────────────────────
function encodePng(pixels, width, height) {
  const crc32 = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return (buf) => {
      let c = 0xffffffff;
      for (const b of buf) c = t[(c ^ b) & 0xff] ^ (c >>> 8);
      return (c ^ 0xffffffff) >>> 0;
    };
  })();

  function chunk(type, data) {
    const t = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  }

  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0); ihdr.writeUInt32BE(height,4);
  ihdr[8]=8; ihdr[9]=6; // 8-bit RGBA
  const rows = [];
  for (let y = 0; y < height; y++) {
    rows.push(Buffer.from([0])); // filter none
    rows.push(pixels.slice(y*width*4, (y+1)*width*4));
  }
  const idat = zlib.deflateSync(Buffer.concat(rows), { level: 6 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

// ── Proper BMP-format ICO builder (Windows RC safe) ───────────────────────
function buildIco(pixelsList, sizes) {
  const num = sizes.length;
  const icondir = Buffer.alloc(6);
  icondir.writeUInt16LE(0,0); icondir.writeUInt16LE(1,2); icondir.writeUInt16LE(num,4);

  const bmpFrames = pixelsList.map((pix, i) => {
    const w = sizes[i], h = sizes[i];
    const hdr = Buffer.alloc(40);
    hdr.writeUInt32LE(40,0);
    hdr.writeInt32LE(w,4);
    hdr.writeInt32LE(h*2,8); // double height for ICO
    hdr.writeUInt16LE(1,12);
    hdr.writeUInt16LE(32,14);
    // XOR mask (BGRA, bottom-up)
    const xor = Buffer.alloc(w*h*4);
    for (let y=0;y<h;y++) {
      for (let x=0;x<w;x++) {
        const si = (y*w+x)*4;
        const di = ((h-1-y)*w+x)*4;
        xor[di]=pix[si+2]; xor[di+1]=pix[si+1]; xor[di+2]=pix[si]; xor[di+3]=pix[si+3];
      }
    }
    // AND mask (all opaque)
    const andRowSz = Math.ceil(w/32)*4;
    const and = Buffer.alloc(andRowSz*h);
    return Buffer.concat([hdr, xor, and]);
  });

  let offset = 6 + num*16;
  const entries = bmpFrames.map((frame, i) => {
    const sz = sizes[i];
    const e = Buffer.alloc(16);
    e.writeUInt8(sz<256?sz:0,0); e.writeUInt8(sz<256?sz:0,1);
    e.writeUInt8(0,2); e.writeUInt8(0,3);
    e.writeUInt16LE(1,4); e.writeUInt16LE(32,6);
    e.writeUInt32LE(frame.length,8); e.writeUInt32LE(offset,12);
    offset += frame.length;
    return e;
  });

  return Buffer.concat([icondir, ...entries, ...bmpFrames]);
}

// ── ICNS builder (Apple) ───────────────────────────────────────────────────
function buildIcns(pngBufs) {
  // OSType tags for each size
  const tags = {16:'icp4',32:'icp5',64:'icp6',128:'ic07',256:'ic08',512:'ic09',1024:'ic10'};
  const chunks = [];
  for (const [sz, tag] of Object.entries(tags)) {
    if (pngBufs[sz]) {
      const t = Buffer.from(tag, 'ascii');
      const hdr = Buffer.alloc(4);
      hdr.writeUInt32BE(8 + pngBufs[sz].length);
      chunks.push(Buffer.concat([t, hdr, pngBufs[sz]]));
    }
  }
  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([header, body]);
}

// ── Main ───────────────────────────────────────────────────────────────────
const srcBuf = fs.readFileSync(source);
const { width: sw, height: sh, pixels: srcPix } = decodePng(srcBuf);
console.log(`  Source: ${sw}x${sh}`);

const pngBufs = {};
const iconSizes = [16, 32, 48, 64, 128, 256];

for (const sz of iconSizes) {
  const pix = resizePixels(srcPix, sw, sh, sz, sz);
  pngBufs[sz] = encodePng(pix, sz, sz);
}

// PNG icons
fs.writeFileSync(path.join(iconsDir, '32x32.png'), pngBufs[32]);
console.log('✅ 32x32.png');
fs.writeFileSync(path.join(iconsDir, '128x128.png'), pngBufs[128]);
console.log('✅ 128x128.png');
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), pngBufs[256]);
console.log('✅ 128x128@2x.png');
fs.writeFileSync(path.join(iconsDir, 'tray-icon.png'), pngBufs[32]);
console.log('✅ tray-icon.png');

// ICO (Windows) — proper BMP format, no RC2176
const icoSizes = [16, 32, 48, 64, 128, 256];
const icoPixels = icoSizes.map(sz => resizePixels(srcPix, sw, sh, sz, sz));
const ico = buildIco(icoPixels, icoSizes);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), ico);
console.log('✅ icon.ico');

// ICNS (macOS)
const icns = buildIcns(pngBufs);
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), icns);
console.log('✅ icon.icns');

console.log('\n🎨 All icons generated from VAR.png!');
