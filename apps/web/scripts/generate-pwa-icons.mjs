import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");
mkdirSync(publicDir, { recursive: true });

// Matches the existing .logo-mark identity used throughout the app shell
// (apps/web/src/app/globals.css): linear-gradient(145deg,#927eff,#5d3ff3), white "P".
function iconSvg({ size, safeZonePadding = 0 }) {
  const inner = size - safeZonePadding * 2;
  const radius = safeZonePadding > 0 ? 0 : size * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#927eff"/>
      <stop offset="1" stop-color="#5d3ff3"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <text x="${safeZonePadding + inner / 2}" y="${safeZonePadding + inner / 2}" text-anchor="middle" dominant-baseline="central"
    font-family="Arial, sans-serif" font-weight="800" font-size="${inner * 0.55}" fill="#ffffff">P</text>
</svg>`;
}

const targets = [
  { name: "icon-192.png", size: 192, safeZonePadding: 0 },
  { name: "icon-512.png", size: 512, safeZonePadding: 0 },
  { name: "icon-maskable-192.png", size: 192, safeZonePadding: 192 * 0.1 },
  { name: "icon-maskable-512.png", size: 512, safeZonePadding: 512 * 0.1 },
  { name: "apple-touch-icon.png", size: 180, safeZonePadding: 0 },
];

for (const target of targets) {
  const svg = iconSvg(target);
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(path.join(publicDir, target.name), buffer);
  console.log(`wrote ${target.name} (${buffer.length} bytes)`);
}
