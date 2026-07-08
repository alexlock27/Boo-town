import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const golden = { words: [{ w: 'because' }, { w: 'their', twin: true, rival: 'there', clue: '___ house is big' }, { w: 'through' }], choices: [{ q: 'What is 6 × 7?', right: '42', wrong: ['36', '48'] }] };
const SAVE = { version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'lilac', pattern: 'spots', patternColour: 'indigo', eyes: 'round', acc: 'bow', name: 'Twiggy' }, inventory: {}, boxes: 0, meter: 2, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, spellingMastery: {}, ledger: {}, trickyPile: [], golden, goldenLastDouble: '', settings: { sound: false, music: false, voice: false }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } } };
const b = await chromium.launch();
for (const [mode, vp] of [['landscape', { width: 1024, height: 768 }], ['portrait', { width: 768, height: 1024 }]]) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub');
  await page.screenshot({ path: `screenshots/p3-hub-${mode}.png` });
  await page.click('.golden-card');
  await page.waitForSelector('.spell-stage'); await sleep(2200);
  await page.screenshot({ path: `screenshots/p3-play-${mode}.png` });
  // editor
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.click('.gu-tab[data-tab="golden"]');   // Golden Round tab (RUN6 C0.2)
  await page.waitForSelector('.gr-save'); await sleep(200);
  await page.screenshot({ path: `screenshots/p3-editor-${mode}.png`, fullPage: true });
  console.log('WROTE', mode);
  await ctx.close();
}
await b.close();
