const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const iconsDir = path.join(__dirname, 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

const source = path.join(__dirname, 'VAR.png');
if (!fs.existsSync(source)) {
  console.error('VAR.png not found in project root!');
  process.exit(1);
}

console.log('Generating icons from VAR.png...');

// Use sharp if available, otherwise fall back to jimp
try {
  const sharp = require('sharp');

  async function run() {
    // 32x32
    await sharp(source).resize(32, 32).png().toFile(path.join(iconsDir, '32x32.png'));
    console.log('✅ 32x32.png');

    // 128x128
    await sharp(source).resize(128, 128).png().toFile(path.join(iconsDir, '128x128.png'));
    console.log('✅ 128x128.png');

    // 128x128@2x (256x256)
    await sharp(source).resize(256, 256).png().toFile(path.join(iconsDir, '128x128@2x.png'));
    console.log('✅ 128x128@2x.png');

    // icon.icns (macOS) - use 256px png, Tauri accepts this
    await sharp(source).resize(256, 256).png().toFile(path.join(iconsDir, 'icon.icns'));
    console.log('✅ icon.icns');

    // icon.ico (Windows) - build proper PNG-compressed ICO
    const struct = require('struct') || null;
    const sizes = [16, 32, 48, 256];
    const pngBuffers = await Promise.all(
      sizes.map(s => sharp(source).resize(s, s).png().toBuffer())
    );

    const num = sizes.length;
    const headerBuf = Buffer.alloc(6);
    headerBuf.writeUInt16LE(0, 0);
    headerBuf.writeUInt16LE(1, 2);
    headerBuf.writeUInt16LE(num, 4);

    let dataOffset = 6 + num * 16;
    const entryBufs = pngBuffers.map((png, i) => {
      const sz = sizes[i];
      const w = sz >= 256 ? 0 : sz;
      const entry = Buffer.alloc(16);
      entry.writeUInt8(w, 0);
      entry.writeUInt8(w, 1);
      entry.writeUInt8(0, 2);
      entry.writeUInt8(0, 3);
      entry.writeUInt16LE(1, 4);
      entry.writeUInt16LE(32, 6);
      entry.writeUInt32LE(png.length, 8);
      entry.writeUInt32LE(dataOffset, 12);
      dataOffset += png.length;
      return entry;
    });

    const ico = Buffer.concat([headerBuf, ...entryBufs, ...pngBuffers]);
    fs.writeFileSync(path.join(iconsDir, 'icon.ico'), ico);
    console.log('✅ icon.ico');

    console.log('\n🎨 All icons generated successfully!');
  }

  run().catch(err => { console.error(err); process.exit(1); });

} catch (e) {
  // fallback: just copy VAR.png to all slots (Tauri will handle the rest)
  console.log('sharp not found, using direct copy fallback...');
  const src = fs.readFileSync(source);
  fs.writeFileSync(path.join(iconsDir, '32x32.png'), src);
  fs.writeFileSync(path.join(iconsDir, '128x128.png'), src);
  fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), src);
  fs.writeFileSync(path.join(iconsDir, 'icon.icns'), src);

  // build minimal ICO
  const num = 1;
  const hdr = Buffer.alloc(6);
  hdr.writeUInt16LE(0,0); hdr.writeUInt16LE(1,2); hdr.writeUInt16LE(num,4);
  const entry = Buffer.alloc(16);
  entry.writeUInt8(0,0); entry.writeUInt8(0,1); entry.writeUInt8(0,2); entry.writeUInt8(0,3);
  entry.writeUInt16LE(1,4); entry.writeUInt16LE(32,6);
  entry.writeUInt32LE(src.length,8); entry.writeUInt32LE(22,12);
  fs.writeFileSync(path.join(iconsDir, 'icon.ico'), Buffer.concat([hdr, entry, src]));
  console.log('✅ Icons ready (fallback mode)!');
}
