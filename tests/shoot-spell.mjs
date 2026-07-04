// tests/shoot-spell.mjs — screenshot the new Spell Boo screens (seeded save), both orientations.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SAVE = { version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'lilac', pattern: 'spots', patternColour: 'indigo', eyes: 'round', acc: 'bow', name: 'Twiggy' }, inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, spellingMastery: {}, settings: { sound: false, music: false, voice: false }, seen: {} };
const browser = await chromium.launch();
for (const [mode, vp] of [['landscape', { width: 1024, height: 768 }], ['portrait', { width: 768, height: 1024 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  // Spell Boo picker (shows Sound Twins + Tricky Sounds choices)
  await page.evaluate(() => window.BooTown.go('spellboo'));
  await page.waitForSelector('.picker');
  await page.screenshot({ path: `screenshots/spell-picker-${mode}.png` });
  // Sound Twins in the pick phase
  await page.click('.picker-choice:has-text("Sound Twins")');
  await page.click('.picker-levels .level-btn >> nth=0');
  await page.waitForSelector('.twin-options');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `screenshots/spell-twins-pick-${mode}.png` });
  // Sound Twins spell phase (after a correct pick)
  await page.evaluate(() => window.__spell.pick(window.__spell.item().answer));
  await page.waitForSelector('.spell-area .tile');
  await page.waitForTimeout(200);
  await page.screenshot({ path: `screenshots/spell-twins-spell-${mode}.png` });
  console.log('WROTE', mode);
  await ctx.close();
}
await browser.close();
