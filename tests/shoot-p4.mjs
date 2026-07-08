import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const journal = { firstRare: '2026-07-01', firstUltra: '2026-07-02', 'star3_bubblepop': '2026-07-03', 'zone_riverside': '2026-07-03', golden3: '2026-07-04', 'allQuests:2026-07-04': '2026-07-04' };
const SAVE = { version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'lilac', pattern: 'spots', patternColour: 'indigo', eyes: 'round', acc: 'bow', name: 'Twiggy' }, inventory: { boo_inky: 1, boo_disco: 1 }, boxes: 0, meter: 2, opened: 2, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 120, byGame: {} }, spellingMastery: {}, ledger: {}, trickyPile: [], golden: null, goldenLastDouble: '', quests: { day: '', list: [], done: [], progress: {}, boxDay: '' }, journal, settings: { sound: false, music: false, voice: false }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true }, trophies: { medal_stars_100: '2026-07-01' } };
const b = await chromium.launch();
for (const [mode, vp] of [['landscape', { width: 1024, height: 768 }], ['portrait', { width: 768, height: 1024 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub');
  await page.evaluate(() => { window.__bootownDay = '2026-07-04'; window.BooTown.go('hub'); });
  await page.waitForSelector('.quest-card'); await sleep(200);
  await page.screenshot({ path: `screenshots/p4-hub-${mode}.png` });
  await page.click('.quest-card'); await page.waitForSelector('.quests-panel'); await sleep(200);
  await page.screenshot({ path: `screenshots/p4-quests-${mode}.png` });
  await page.evaluate(() => { const o = document.querySelector('.quests-overlay'); if (o) o.remove(); });
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-tab'); await page.click('.coll-tab:has-text("Journal")');
  await page.waitForSelector('.journal-view'); await sleep(200);
  await page.screenshot({ path: `screenshots/p4-journal-${mode}.png` });
  console.log('WROTE', mode);
  await ctx.close();
}
await b.close();
