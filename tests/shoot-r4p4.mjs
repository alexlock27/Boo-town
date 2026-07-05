// tests/shoot-r4p4.mjs — RUN4 phase 4 QA shots: the Trophy Room + ceremonies.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/r4p4', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const boos = ['boo_inky', 'boo_plum', 'boo_pippin', 'boo_lolly', 'boo_chomp', 'boo_mallow', 'boo_curly', 'boo_wisp', 'boo_beam', 'boo_dot'];
const inv = { deco_pond: 1 }; for (const b of boos) inv[b] = 1;
const ledger = {}; for (let f = 1; f <= 12; f++) ledger['tmul2:' + f] = { rights: 5, misses: 0, lastSeen: 1 };
const SAVE = (seen) => ({ version: 4, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: inv, boxes: 0, meter: 0, opened: 12, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: { 'clockshop:l1': 3 }, town: [], stars: { total: 250, byGame: {} }, ledger, journal: { golden3: '2026-07-01' }, customs: [], settings: { sound: false, music: false, voice: false, content: 'full' }, seen, ageAsked: true, age: 8 });

const browser = await chromium.launch();
for (const [w, h, o] of [[1000, 625, 'landscape'], [625, 1000, 'portrait']]) {
  // retro cabinet-opening ceremony
  {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE({}));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.trophy-ceremony', { timeout: 8000 });
    await sleep(900);
    await page.screenshot({ path: `screenshots/r4p4/retro-ceremony-${o}.png` });
    await ctx.close();
  }
  // the cabinet, earned + silhouettes, per chip
  {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE({ trophyRetro: true }));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.hub');
    await page.evaluate(() => import('./js/trophies.js').then(m => m.evaluateTrophies()));
    await page.evaluate(() => window.BooTown.go('collection'));
    await page.click('.coll-tab:has-text("Troph")');
    await page.waitForSelector('.trophy-cabinet');
    await sleep(400);
    await page.screenshot({ path: `screenshots/r4p4/cabinet-maths-${o}.png` });
    await page.click('.troph-chip:has-text("Collector")');
    await sleep(300);
    await page.screenshot({ path: `screenshots/r4p4/cabinet-collector-${o}.png` });
    await ctx.close();
  }
  console.log('shot', o);
}
await browser.close();
