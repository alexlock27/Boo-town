// tests/shoot-r4p6.mjs — RUN4 phase 6 QA shots: construction site, reveal, upgrades.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/r4p6', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const BOOS = ['boo_inky', 'boo_plum', 'boo_pippin', 'boo_lolly', 'boo_chomp', 'boo_mallow', 'boo_curly', 'boo_wisp', 'boo_beam', 'boo_dot'];
const SAVE = (growth) => {
  const inv = {}; BOOS.forEach(b => { inv[b] = 1; });
  return { version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: inv, boxes: 0, meter: 0, opened: 10, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [{ zone: 'meadow', x: 0.5, item: 'boo_inky' }, { zone: 'meadow', x: 0.6, item: 'boo_plum' }], stars: { total: 60, byGame: {} }, ledger: {}, townGrowth: growth, settings: { sound: false, music: false, voice: false, content: 'full' }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'] }, trophies: { medal_boos_10: '2026-07-01' }, ageAsked: true, age: 8 };
};

const browser = await chromium.launch();
for (const [w, h, o] of [[1000, 625, 'landscape'], [625, 1000, 'portrait']]) {
  // construction site with hammering builders
  {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE({ done: [], pending: [1], site: { idx: 0, startedAt: Date.now() } }));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.hub');
    await page.evaluate(() => window.BooTown.go('town'));
    await page.waitForSelector('.t-consite');
    await sleep(900);
    await page.screenshot({ path: `screenshots/r4p6/consite-${o}.png` });
    await ctx.close();
  }
  // the reveal ceremony (fence mid-drop)
  {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE({ done: [], pending: [], site: { idx: 0, startedAt: Date.now() - 25 * 3600 * 1000 } }));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.hub');
    await page.evaluate(() => window.BooTown.go('town'));
    await page.waitForSelector('.growth-reveal');
    await sleep(1100);
    await page.screenshot({ path: `screenshots/r4p6/reveal-${o}.png` });
    await ctx.close();
  }
  // all five upgrades, day + night
  for (const [hour, label] of [[13, 'day'], [22, 'night']]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.addInitScript((hh) => { window.__bootownHour = hh; }, hour);
    await page.goto(BASE + '/index.html', { waitUntil: 'load' });
    await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE({ done: [0, 1, 2, 3, 4], pending: [], site: null }));
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.hub');
    await page.evaluate(() => window.BooTown.go('town'));
    await page.waitForSelector('.town2 .t-item');
    await sleep(1000);
    await page.screenshot({ path: `screenshots/r4p6/upgrades-${label}-${o}.png` });
    await ctx.close();
  }
  console.log('shot', o);
}
await browser.close();
