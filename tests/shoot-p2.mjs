import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'lilac', pattern: 'spots', patternColour: 'indigo', eyes: 'round', acc: 'bow', name: 'Twiggy' }, inventory: {}, boxes: 0, meter: 2, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, spellingMastery: {}, ledger: {}, trickyPile: [], settings: { sound: false, music: false, voice: false }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } } };
const b = await chromium.launch();
for (const [mode, vp] of [['landscape', { width: 1024, height: 768 }], ['portrait', { width: 768, height: 1024 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub');
  // picker with the "Pick for me!" card (RUN4 C2: one tap starts, so just shoot the picker)
  await page.evaluate(() => window.BooTown.go('bubblepop'));
  await page.waitForSelector('.picker');
  await page.waitForTimeout(150);
  await page.screenshot({ path: `screenshots/p2-mix-picker-${mode}.png` });
  // Tricky Pile: force a miss then reach the rescue on results
  await page.evaluate(() => window.BooTown.go('spellboo'));
  await page.waitForSelector('.picker');
  await page.click('.picker-choice:has-text("Th Words")');
  await page.click('.picker-levels .level-btn >> nth=0');
  await page.waitForSelector('.spell-stage'); await sleep(120);
  await page.evaluate(() => window.__spell.typeWrong()); await sleep(700);
  await page.screenshot({ path: `screenshots/p2-puzzled-${mode}.png` });
  for (let g = 0; g < 20; g++) { if (await page.$('.result-card')) break; await page.evaluate(() => window.__spell.typeCorrect()); await sleep(1500); }
  await page.waitForSelector('.rescue-panel', { timeout: 5000 }).catch(() => {});
  await sleep(400);
  await page.screenshot({ path: `screenshots/p2-rescue-${mode}.png` });
  console.log('WROTE', mode);
  await ctx.close();
}
await b.close();
