// tests/shoot-hub-fix.mjs — deterministic hub screenshots for the DASH_PATCH job-1 gate.
// Usage: node tests/shoot-hub-fix.mjs <prefix>
// Captures the hub at the tablet set (1000x625, 625x1000) and phone (390x844) with a
// seeded Math.random + prefers-reduced-motion, so two runs of the SAME wide-viewport CSS
// are pixel-identical and any diff is a real layout change.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const prefix = process.argv[2] || 'shot';
mkdirSync('screenshots/dashpatch', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SAVE = { version: 4, name: 'Ada', guide: { species: 'giraffe', body: 'lilac', pattern: 'spots', patternColour: 'indigo', eyes: 'round', acc: 'bow', name: 'Twiggy' }, inventory: { boo_inky: 1, boo_disco: 1 }, boxes: 1, meter: 4, opened: 2, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 120, byGame: { bubblepop: { best: 2, plays: 3 }, spellboo: { best: 3, plays: 2 } } }, spellingMastery: {}, ledger: {}, trickyPile: [], golden: { words: [{ w: 'because' }], choices: [] }, goldenLastDouble: '', quests: { day: '', list: [], done: [], progress: {}, boxDay: '' }, journal: {}, customs: [], studioSeen: false, easelArt: '', request: { active: null, lastResolvedAt: 0 }, routines: {}, settings: { sound: false, music: false, voice: false, mic: true, requests: true, content: 'light' }, seen: {} };

const SIZES = [
  ['tab-land', { width: 1000, height: 625 }],
  ['tab-port', { width: 625, height: 1000 }],
  ['phone', { width: 390, height: 844 }]
];

const browser = await chromium.launch();
for (const [tag, vp] of SIZES) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  // deterministic Math.random (mulberry32, fixed seed) BEFORE app boot
  await page.addInitScript(() => {
    let a = 0xB00B00;
    Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    window.__bootownDay = '2026-07-04';
  });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `screenshots/dashpatch/${prefix}-${tag}.png` });
  console.log('WROTE', `${prefix}-${tag}`);
  await ctx.close();
}
await browser.close();
