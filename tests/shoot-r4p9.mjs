// tests/shoot-r4p9.mjs — RUN4 phase 9 QA shots: hide-and-seek, Boo of the Day, Parade.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/r4p9', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1, deco_tree: 1, deco_stage: 1, acc_bow: 1 }, boxes: 0, meter: 0, opened: 5, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [{ zone: 'meadow', x: 0.3, item: 'deco_tree' }, { zone: 'meadow', x: 0.5, item: 'deco_stage' }, { zone: 'meadow', x: 0.62, item: 'boo_inky' }, { zone: 'meadow', x: 0.72, item: 'boo_plum' }], stars: { total: 60, byGame: {} }, ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full', requests: false }, seen: { trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'] }, ageAsked: true, age: 8 };

const browser = await chromium.launch();
for (const [w, h, o] of [[1000, 625, 'landscape'], [625, 1000, 'portrait']]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__bootownParadeMs = 20000; });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await sleep(400);
  await page.screenshot({ path: `screenshots/r4p9/hub-booday-${o}.png` });
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.t-hide-ears', { timeout: 5000 }).catch(() => {});
  await sleep(700);
  await page.screenshot({ path: `screenshots/r4p9/town-hide-ears-${o}.png` });
  // the parade mid-march
  await page.click('.t-item[data-item="deco_stage"]', { force: true });
  await page.waitForSelector('.plot-menu');
  await page.click('.plot-menu button:has-text("Parade")', { force: true });
  await sleep(2600);
  await page.screenshot({ path: `screenshots/r4p9/parade-march-${o}.png` });
  await sleep(1300);
  await page.screenshot({ path: `screenshots/r4p9/parade-march2-${o}.png` });
  await ctx.close();
  console.log('shot', o);
}
await browser.close();
