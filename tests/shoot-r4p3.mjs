// tests/shoot-r4p3.mjs — RUN4 phase 3 QA shots: brave + cosy results screens.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/r4p3', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { version: 4, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' }, seen: {}, ageAsked: true, age: 8 };

const browser = await chromium.launch();
for (const [w, h, o] of [[1000, 625, 'landscape'], [625, 1000, 'portrait']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');

  // brave: Level 2 above default comfort
  await page.evaluate(() => window.BooTown.go('results', { game: 'spellboo', gameName: 'Spell Boo', stars: 3, cat: 'big', level: 2 }));
  await page.waitForSelector('.result-card'); await sleep(2800);
  await page.screenshot({ path: `screenshots/r4p3/results-brave-${o}.png` });

  // cosy: mastered content at comfort
  await page.evaluate(() => import('./data/spellingBanks.js').then(m => {
    const th = m.BANKS.find(b => b.id === 'trickyTh');
    window.BooTown.State.mutate(s => { th.words.forEach(w => { s.ledger[w.w] = { rights: 5, misses: 0, lastSeen: 1 }; }); });
    window.BooTown.State.beginRoundTally();
    th.words.slice(0, 8).forEach(w => window.BooTown.State.recordResult(w.w, true));
    window.BooTown.go('results', { game: 'spellboo', gameName: 'Spell Boo', stars: 3, cat: 'trickyTh', level: 1 });
  }));
  await page.waitForSelector('.result-card'); await sleep(2800);
  await page.screenshot({ path: `screenshots/r4p3/results-cosy-${o}.png` });
  console.log('shot', o);
  await ctx.close();
}
await browser.close();
