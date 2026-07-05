// tests/shoot-r4p7.mjs — RUN4 phase 7 QA shots: Boo Pop board, levels, mid-pop.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/r4p7', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' }, seen: { trophyRetro: true }, ageAsked: true, age: 8 };

const browser = await chromium.launch();
for (const [w, h, o] of [[1000, 625, 'landscape'], [625, 1000, 'portrait']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.screenshot({ path: `screenshots/r4p7/hub-with-boopop-${o}.png` });
  await page.evaluate(() => window.BooTown.go('boopop'));
  await page.waitForSelector('.start-card');
  await sleep(250);
  await page.screenshot({ path: `screenshots/r4p7/start-card-${o}.png` });
  await page.click('.level-btn:has-text("Make 10")');
  await page.waitForSelector('.bp-board .bp-gem');
  await sleep(600);
  await page.screenshot({ path: `screenshots/r4p7/board-make10-${o}.png` });
  // catch a pop mid-flight
  const mv = await page.evaluate(() => window.__boopop.findMove());
  if (mv) {
    await page.evaluate((m) => window.__boopop.swap(m.from[0], m.from[1], m.to[0], m.to[1]), mv);
    await sleep(330);
    await page.screenshot({ path: `screenshots/r4p7/mid-pop-${o}.png` });
  }
  // fraction friends board
  await page.evaluate(() => window.BooTown.go('boopop'));
  await page.waitForSelector('.start-card');
  await page.click('.level-btn:has-text("Fraction Friends")');
  await page.waitForSelector('.bp-board .bp-gem');
  await sleep(500);
  await page.screenshot({ path: `screenshots/r4p7/board-fractions-${o}.png` });
  await ctx.close();
  console.log('shot', o);
}
await browser.close();
