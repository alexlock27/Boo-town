// tests/shoot-r4p1.mjs — RUN4 phase 1 QA shots: the near-unlock nudge on the hub
// (both tablet orientations) and the four-slot bottom bar on phone widths.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/r4p1', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SAVE = { version: 4, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 95, byGame: {} }, ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' }, seen: {}, ageAsked: true, age: 8 };

const browser = await chromium.launch();
for (const [w, h, name] of [[1000, 625, 'hub-nudge-landscape'], [625, 1000, 'hub-nudge-portrait'], [390, 844, 'hub-phone-390'], [360, 740, 'hub-phone-360-icons']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub .speech-bubble');
  await new Promise(r => setTimeout(r, 600));
  await page.screenshot({ path: `screenshots/r4p1/${name}.png` });
  console.log('shot', name);
  await ctx.close();
}
await browser.close();
