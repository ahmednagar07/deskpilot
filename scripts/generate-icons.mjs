/**
 * Generate DeskPilot app icons
 *
 * Creates:
 *   resources/icon.ico  — multi-size Windows icon (16, 32, 48, 256)
 *   resources/icon.png  — 256x256 PNG (used by electron-builder for Linux/Mac)
 *   resources/tray-icon.png — 32x32 tray icon
 *
 * Design: Purple gradient circle with "DP" monogram
 */
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'resources');

// DeskPilot brand colors
const ACCENT = '#7C5CFC';    // Purple accent
const ACCENT2 = '#A78BFA';   // Lighter purple
const BG_DARK = '#0a0a14';   // Dark background

/**
 * Create SVG icon at given size
 * Design: Rounded square with gradient background, "DP" monogram
 */
function createIconSvg(size) {
  const r = Math.round(size * 0.22); // corner radius
  const fontSize = Math.round(size * 0.38);
  const strokeWidth = Math.max(1, Math.round(size * 0.015));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1a1040"/>
      <stop offset="50%" stop-color="#0a0a14"/>
      <stop offset="100%" stop-color="#12082a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${ACCENT2}"/>
      <stop offset="100%" stop-color="${ACCENT}"/>
    </linearGradient>
    <linearGradient id="glow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${ACCENT2}" stop-opacity="0.1"/>
    </linearGradient>
  </defs>

  <!-- Background rounded square -->
  <rect x="${strokeWidth}" y="${strokeWidth}"
        width="${size - strokeWidth * 2}" height="${size - strokeWidth * 2}"
        rx="${r}" ry="${r}"
        fill="url(#bg)"
        stroke="url(#accent)" stroke-width="${strokeWidth}"/>

  <!-- Inner glow -->
  <rect x="${strokeWidth * 3}" y="${strokeWidth * 3}"
        width="${size - strokeWidth * 6}" height="${size - strokeWidth * 6}"
        rx="${r - strokeWidth * 2}" ry="${r - strokeWidth * 2}"
        fill="url(#glow)"/>

  <!-- "DP" monogram -->
  <text x="50%" y="54%"
        font-family="'Segoe UI', 'SF Pro Display', sans-serif"
        font-size="${fontSize}"
        font-weight="800"
        fill="url(#accent)"
        text-anchor="middle"
        dominant-baseline="middle"
        letter-spacing="${Math.round(size * -0.02)}">DP</text>

  <!-- Subtle bottom shine line -->
  <line x1="${size * 0.25}" y1="${size * 0.82}"
        x2="${size * 0.75}" y2="${size * 0.82}"
        stroke="url(#accent)" stroke-width="${Math.max(1, Math.round(size * 0.01))}"
        stroke-linecap="round" opacity="0.5"/>
</svg>`;
}

async function main() {
  console.log('Generating DeskPilot icons...');

  // Generate PNGs at various sizes
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = {};

  for (const size of sizes) {
    const svg = createIconSvg(size);
    pngBuffers[size] = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
  }

  // Save 256px PNG (for electron-builder)
  fs.writeFileSync(path.join(OUT, 'icon.png'), pngBuffers[256]);
  console.log('  ✓ icon.png (256x256)');

  // Save tray icon (32x32)
  fs.writeFileSync(path.join(OUT, 'tray-icon.png'), pngBuffers[32]);
  console.log('  ✓ tray-icon.png (32x32)');

  // Generate ICO with multiple sizes
  const icoSizes = [16, 32, 48, 256];
  const icoPngs = icoSizes.map(s => pngBuffers[s]);
  const icoBuffer = await pngToIco(icoPngs);
  fs.writeFileSync(path.join(OUT, 'icon.ico'), icoBuffer);
  console.log('  ✓ icon.ico (16/32/48/256)');

  console.log('\nDone! All icons saved to resources/');
}

main().catch(err => {
  console.error('Failed to generate icons:', err);
  process.exit(1);
});
