#!/usr/bin/env node
// Generates the EPYC Driver app icons from public/images/logo.png.
//
//   node apps/web/scripts/generate-driver-icons.mjs
//
// Output (committed): public/icons/driver-192.png, driver-512.png,
// driver-maskable-512.png, driver-apple-touch-icon.png (180x180), and
// store-assets/driver-store-icon-1024.png and driver-splash-2732.png.
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
  // App store listing and native app shell sources (not served by the site).
  // App Store: 1024x1024, opaque, no alpha channel. Splash: 2732x2732 square,
  // logo small in the middle so every phone and tablet crop keeps it.
  { file: 'driver-store-icon-1024.png', size: 1024, contentRatio: 0.82, dir: 'store-assets', noAlpha: true },
  { file: 'driver-splash-2732.png', size: 2732, contentRatio: 0.3, dir: 'store-assets', noAlpha: true },
];

async function build({ file, size, contentRatio, dir, noAlpha }) {
  const inner = Math.round(size * contentRatio);
  const logo = await sharp(SOURCE)
    .resize({ width: inner, height: inner, fit: 'inside', background: BACKGROUND })
    .flatten({ background: BACKGROUND })
    .png()
    .toBuffer();
  const canvas = sharp({ create: { width: size, height: size, channels: 4, background: BACKGROUND } })
    .composite([{ input: logo, gravity: 'center' }])
    .flatten({ background: BACKGROUND }); // opaque: iOS paints transparency black
  // The App Store refuses an icon file that has an alpha channel at all.
  await (noAlpha ? canvas.removeAlpha().toColourspace('srgb') : canvas)
    .png({ compressionLevel: 9 })
    .toFile(path.join(dir ? path.join(webRoot, dir) : OUT_DIR, file));
  console.log(`wrote ${dir ?? 'public/icons'}/${file} (${size}x${size})${noAlpha ? ', no alpha' : ''}`);
}

await mkdir(OUT_DIR, { recursive: true });
await mkdir(path.join(webRoot, 'store-assets'), { recursive: true });
for (const icon of ICONS) {
  await build(icon);
}
