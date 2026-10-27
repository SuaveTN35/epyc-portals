#!/usr/bin/env node
// Generates the EPYC Driver app icons from public/images/logo.png.
//
//   node apps/web/scripts/generate-driver-icons.mjs
//
// Output (committed): public/icons/driver-192.png, driver-512.png,
// driver-maskable-512.png, driver-apple-touch-icon.png (180x180).
//
// sharp is not a direct dependency of epyc-web; it ships with next (same
// lockfile), so it is resolved through next's own dependency tree.
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve('next/package.json'))('sharp');

const SOURCE = path.join(webRoot, 'public/images/logo.png');
const OUT_DIR = path.join(webRoot, 'public/icons');
const BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 }; // the logo artwork is on white

// contentRatio = share of the square the logo may occupy (width-limited).
// Maskable icons get cropped to as small as an 80% circle, so the logo must
// sit well inside it.
const ICONS = [
  { file: 'driver-192.png', size: 192, contentRatio: 0.86 },
  { file: 'driver-512.png', size: 512, contentRatio: 0.86 },
  { file: 'driver-maskable-512.png', size: 512, contentRatio: 0.62 },
  { file: 'driver-apple-touch-icon.png', size: 180, contentRatio: 0.82 },
];

async function build({ file, size, contentRatio }) {
  const inner = Math.round(size * contentRatio);
  const logo = await sharp(SOURCE)
    .resize({ width: inner, height: inner, fit: 'inside', background: BACKGROUND })
    .flatten({ background: BACKGROUND })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: logo, gravity: 'center' }])
    .flatten({ background: BACKGROUND }) // opaque: iOS paints transparency black
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT_DIR, file));
  console.log(`wrote public/icons/${file} (${size}x${size})`);
}

await mkdir(OUT_DIR, { recursive: true });
for (const icon of ICONS) {
  await build(icon);
}
