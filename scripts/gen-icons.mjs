// scripts/gen-icons.mjs — DEV-TIME ONLY. Renders the icon SVGs to PNGs with sharp.
// Nothing from npm ships to runtime; these PNGs are committed and served statically.
import sharp from 'sharp';
import { readFileSync } from 'fs';

const any = readFileSync('assets/icons/icon-src.svg');
const mask = readFileSync('assets/icons/icon-maskable-src.svg');

for (const size of [192, 512]) {
  await sharp(any, { density: 384 }).resize(size, size).png().toFile(`assets/icons/icon-${size}.png`);
  await sharp(mask, { density: 384 }).resize(size, size).png().toFile(`assets/icons/icon-${size}-maskable.png`);
  console.log('wrote icon-' + size + '.png and icon-' + size + '-maskable.png');
}
// a small favicon too
await sharp(any, { density: 384 }).resize(48, 48).png().toFile('assets/icons/favicon-48.png');
console.log('done');
