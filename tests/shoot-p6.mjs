import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { version: 4, name: 'Ada', guide: { species: 'giraffe', body: 'lilac', pattern: 'spots', patternColour: 'indigo', eyes: 'round', acc: 'bow', name: 'Twiggy' }, inventory: { boo_inky: 1, boo_disco: 1 }, boxes: 0, meter: 2, opened: 2, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 200, byGame: {} }, spellingMastery: {}, ledger: {}, trickyPile: [], golden: null, goldenLastDouble: '', quests: { day: '', list: [], done: [], progress: {}, boxDay: '' }, journal: {}, customs: [], studioSeen: false, easelArt: '', settings: { sound: false, music: false, voice: false }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } } };
const b = await chromium.launch();
for (const [mode, vp] of [['landscape', { width: 1024, height: 768 }], ['portrait', { width: 768, height: 1024 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('studio')); await page.waitForSelector('.studio-grid'); await sleep(150);
  await page.screenshot({ path: `screenshots/p6-studio-${mode}.png` });
  await page.evaluate(() => window.BooTown.go('buildaboo')); await page.waitForSelector('.build-preview'); await sleep(250);
  await page.screenshot({ path: `screenshots/p6-build-${mode}.png` });
  await page.evaluate(() => window.BooTown.go('paint')); await page.waitForSelector('.paint-canvas'); await sleep(250);
  await page.screenshot({ path: `screenshots/p6-paint-${mode}.png` });
  console.log('WROTE', mode);
  await ctx.close();
}
await b.close();
