// tests/shoot-r4p8.mjs — RUN4 phase 8 QA shots: shiny reveal, chest, badges.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/r4p8', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = (over = {}) => Object.assign({
  version: 4, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 137, byGame: {} },
  ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { trophyRetro: true }, trophies: { medal_stars_100: 'x' }, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch();
for (const [w, h, o] of [[1000, 625, 'landscape'], [625, 1000, 'portrait']]) {
  // shiny reveal via mercy (deterministic with fixed random)
  {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { Math.random = () => 0.5; });
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE({ boxes: 1, shinyDrops: 24, chest: { anchor: 137, opened: 0, welcome: false }, version: 5 }));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.hub');
    await page.screenshot({ path: `screenshots/r4p8/hub-chest-progress-${o}.png` });
    await page.click('.gift-btn', { force: true });
    await page.waitForSelector('.gift-box');
    for (let i = 0; i < 3; i++) { await page.click('.gift-box', { force: true }); await sleep(230); }
    await page.waitForSelector('.reveal-card.shiny', { timeout: 6000 });
    await sleep(900);
    await page.screenshot({ path: `screenshots/r4p8/shiny-reveal-${o}.png` });
    // collection badge + counter
    await page.evaluate(() => window.BooTown.go('collection'));
    await page.waitForSelector('.coll-grid');
    await sleep(300);
    await page.screenshot({ path: `screenshots/r4p8/collection-shiny-${o}.png` });
    await ctx.close();
  }
  // welcome chest ready on the hub + the golden ceremony
  {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.star-chest.ready');
    await sleep(400);
    await page.screenshot({ path: `screenshots/r4p8/hub-chest-ready-${o}.png` });
    await page.click('.star-chest');
    await page.waitForSelector('.gift-box');
    await sleep(400);
    await page.screenshot({ path: `screenshots/r4p8/chest-ceremony-box-${o}.png` });
    for (let i = 0; i < 3; i++) { await page.click('.gift-box', { force: true }); await sleep(230); }
    await page.waitForSelector('.reveal-card', { timeout: 6000 });
    await sleep(1200);
    await page.screenshot({ path: `screenshots/r4p8/chest-reveal-${o}.png` });
    await ctx.close();
  }
  console.log('shot', o);
}
await browser.close();
