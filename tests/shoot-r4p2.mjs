// tests/shoot-r4p2.mjs — RUN4 phase 2 QA shots: Pick for me + kid-readable set cards.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/r4p2', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = (tier) => ({ version: 4, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: { 'spellboo:big': 3 }, town: [], stars: { total: 60, byGame: {} }, ledger: {}, settings: { sound: false, music: false, voice: false, content: tier }, seen: {}, ageAsked: true, age: 8 });

const browser = await chromium.launch();
for (const [w, h, o] of [[1000, 625, 'landscape'], [625, 1000, 'portrait']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE('full'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');

  await page.evaluate(() => window.BooTown.go('spellboo'));
  await page.waitForSelector('.picker'); await sleep(300);
  await page.screenshot({ path: `screenshots/r4p2/spell-full-collapsed-${o}.png`, fullPage: false });
  await page.$$eval('.pg-head', hs => hs.forEach(h => h.dataset.open === 'true' || h.click()));
  await sleep(300);
  await page.screenshot({ path: `screenshots/r4p2/spell-full-expanded-${o}.png`, fullPage: false });

  await page.evaluate(() => window.BooTown.go('bubblepop'));
  await page.waitForSelector('.picker'); await sleep(300);
  await page.screenshot({ path: `screenshots/r4p2/bubble-samples-${o}.png` });

  await page.evaluate(() => window.BooTown.go('blocks'));
  await page.waitForSelector('.start-card'); await sleep(300);
  await page.screenshot({ path: `screenshots/r4p2/blocks-pickforme-${o}.png` });

  // medium tier: feed topic cards with samples + light spellboo names
  await page.evaluate(() => window.BooTown.State.mutate(s => { s.settings.content = 'medium'; }));
  await page.evaluate(() => window.BooTown.go('feedboos'));
  await page.waitForSelector('.picker'); await sleep(300);
  await page.screenshot({ path: `screenshots/r4p2/feed-medium-samples-${o}.png` });

  console.log('shot', o);
  await ctx.close();
}
await browser.close();
