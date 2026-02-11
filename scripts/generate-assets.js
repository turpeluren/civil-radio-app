#!/usr/bin/env node
/**
 * Generate app icon and splash-screen PNG assets from an SVG sound-wave logo.
 *
 * The logo is a set of vertically-centred, fully-rounded pill bars that form
 * a playful audio-waveform silhouette.
 *
 * These source PNGs live in src/assets/ and are referenced by app.json.
 * Expo prebuild (npx expo prebuild --clean) reads app.json and generates
 * the platform-specific native assets in ios/ and android/ automatically.
 *
 * Usage:  node scripts/generate-assets.js   (or: npm run generate-assets)
 * Requires: sharp (npm i -D sharp)
 */

const sharp = require('sharp');
const path = require('path');

const PRIMARY = '#1D9BF0';
const WHITE = '#FFFFFF';
const ASSETS_DIR = path.resolve(__dirname, '..', 'src', 'assets');

/**
 * Bar height proportions – creates a fun, bouncy waveform shape.
 * Each value is the fraction of the maximum bar height.
 * Bars are centred vertically so they extend equally above & below the midline.
 */
const BAR_HEIGHTS = [0.30, 0.55, 0.80, 0.50, 1.00, 0.45, 0.90, 0.60, 0.35];

/**
 * Build an SVG string of the waveform logo.
 *
 * @param {number} size         Canvas width & height
 * @param {string} bgColor      Background fill (use 'none' for transparent)
 * @param {string} barColor     Bar fill colour
 * @param {number} logoScale    0-1, how much of the canvas the logo occupies
 * @param {number} cornerRadius Rounding for background rect (0 = none)
 */
function buildSvg(size, bgColor, barColor, logoScale = 0.5, cornerRadius = 0) {
  const barCount = BAR_HEIGHTS.length;

  // Logo bounding box
  const logoW = size * logoScale;
  const logoH = size * logoScale;
  const originX = (size - logoW) / 2;
  const centreY = size / 2;

  // Bar sizing – thinner bars with generous gaps for a light, airy feel
  const gapRatio = 0.35; // gap as fraction of bar width
  const barW = logoW / (barCount + (barCount - 1) * gapRatio);
  const gap = barW * gapRatio;
  const r = barW / 2; // full pill radius

  let bars = '';
  for (let i = 0; i < barCount; i++) {
    const h = logoH * BAR_HEIGHTS[i];
    const x = originX + i * (barW + gap);
    const y = centreY - h / 2;

    // Fully-rounded pill (rect with rx = ry = half the bar width)
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="${r}" ry="${r}" fill="${barColor}"/>`;
  }

  const bgRect =
    bgColor === 'none'
      ? ''
      : `<rect width="${size}" height="${size}" rx="${cornerRadius}" ry="${cornerRadius}" fill="${bgColor}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bgRect}
  ${bars}
</svg>`;
}

async function generate() {
  // 1. App icon (iOS + Android fallback) – 1024×1024, blue bg, white bars
  const iconSvg = buildSvg(1024, PRIMARY, WHITE, 0.50, 0);
  await sharp(Buffer.from(iconSvg))
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon.png'));
  console.log('✔  icon.png (1024×1024)');

  // 2. Android adaptive icon foreground – 1024×1024, blue bg, white bars
  const adaptiveSvg = buildSvg(1024, PRIMARY, WHITE, 0.42, 0);
  await sharp(Buffer.from(adaptiveSvg))
    .png()
    .toFile(path.join(ASSETS_DIR, 'adaptive-icon.png'));
  console.log('✔  adaptive-icon.png (1024×1024)');

  // 3. Splash icon – 200×200, transparent bg, white bars only
  //    (expo-splash-screen plugin applies backgroundColor from app.json)
  const splashSvg = buildSvg(200, 'none', WHITE, 0.80, 0);
  await sharp(Buffer.from(splashSvg))
    .png()
    .toFile(path.join(ASSETS_DIR, 'splash-icon.png'));
  console.log('✔  splash-icon.png (200×200)');

  // 4. Favicon – 48×48, blue bg, white bars
  const faviconSvg = buildSvg(48, PRIMARY, WHITE, 0.60, 6);
  await sharp(Buffer.from(faviconSvg))
    .png()
    .toFile(path.join(ASSETS_DIR, 'favicon.png'));
  console.log('✔  favicon.png (48×48)');

  console.log('\nAll source assets generated in src/assets/');
  console.log('Run "npx expo prebuild --clean" to sync into native ios/ and android/ directories.');
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
