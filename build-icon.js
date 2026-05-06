const sharp = require('sharp');
const { default: pngToIco } = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const SIZE = 256;
const ACCENT = { r: 10, g: 132, b: 255, alpha: 1 };
const WHITE  = { r: 255, g: 255, b: 255, alpha: 1 };

async function build() {
  const base = await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: ACCENT }
  }).png().toBuffer();

  const inner = await sharp({
    create: { width: 128, height: 128, channels: 4, background: WHITE }
  }).png().toBuffer();

  const pngBuf = await sharp(base)
    .composite([{ input: inner, top: 64, left: 64 }])
    .png()
    .toBuffer();

  const pngPath = path.join(__dirname, 'icon.png');
  fs.writeFileSync(pngPath, pngBuf);
  console.log('icon.png created');

  const icoBuf = await pngToIco(pngPath);
  fs.writeFileSync(path.join(__dirname, 'icon.ico'), icoBuf);
  console.log('icon.ico created');
}

build().catch(e => { console.error(e); process.exit(1); });
