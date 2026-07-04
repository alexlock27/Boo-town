// tests/dp3-back.mjs — DASH_PATCH follow-on job 3: the shared on-screen back control.
// One soft round button, same top-left corner, on every screen below the hub; exactly one
// level of navigation; the in-round leave confirm is kept. Screenshots at 3 sizes.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/dashpatch', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { version: 4, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' }, seen: {} };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');

const screenName = () => page.evaluate(() => document.getElementById('screen').dataset.screen);

// ---- every screen below the hub carries exactly one shared back control ----
console.log('== presence on every screen ==');
const SCREENS = ['town', 'collection', 'studio', 'paint', 'collage', 'buildaboo', 'gallery', 'grownups', 'editguide', 'teachme', 'bubblepop', 'feedboos', 'spellboo', 'blocks', 'bounce', 'beat', 'dash', 'clockshop'];
let allOne = true;
for (const s of SCREENS) {
  await page.evaluate((x) => window.BooTown.go(x), s);
  await sleep(350);
  const n = await page.$$eval('.back-btn', els => els.length);
  if (n !== 1) { allOne = false; console.log('   !', s, 'has', n); }
  await page.evaluate(() => window.BooTown.go('hub')); await page.waitForSelector('.hub');
}
assert(allOne, 'every screen below the hub shows exactly one shared back control');

// ---- one level: game start card -> hub ----
console.log('== one-level taps ==');
await page.evaluate(() => window.BooTown.go('dash'));
await page.waitForSelector('.picker');
await page.click('.back-btn');
await page.waitForSelector('.hub', { timeout: 3000 });
assert((await screenName()) === 'hub', 'a game start card backs to the hub');

// ---- one level: in-game shell -> confirm kept -> hub ----
await page.evaluate(() => window.BooTown.go('clockshop'));
await page.waitForSelector('.start-card');
await page.click('.level-row .level-btn');
await page.waitForSelector('.clock-face');
await page.click('.game-topbar .back-btn');
await page.waitForSelector('.dialog', { timeout: 3000 });
const confirmText = await page.$eval('.dialog', n => n.textContent);
assert(/Leave this round/.test(confirmText), 'the in-round back keeps the leave-round confirm');
await page.click('.dialog button:has-text("Keep playing")');
await sleep(200);
assert((await screenName()) === 'clockshop', '"Keep playing" stays in the round');
await page.click('.game-topbar .back-btn');
await page.waitForSelector('.dialog');
await page.click('.dialog button:has-text("Leave")');
await page.waitForSelector('.hub', { timeout: 3000 });
assert((await screenName()) === 'hub', 'confirming Leave returns one level to the hub');

// ---- one level: collection -> hub ----
await page.evaluate(() => window.BooTown.go('collection'));
await page.waitForSelector('.collection');
await page.click('.back-btn');
await page.waitForSelector('.hub');
assert((await screenName()) === 'hub', 'the collection backs to the hub');

// ---- one level: settings (grown-ups) -> hub ----
await page.evaluate(() => window.BooTown.go('grownups'));
await page.waitForSelector('.grownups');
await page.click('.back-btn');
await page.waitForSelector('.hub');
assert((await screenName()) === 'hub', 'the grown-ups corner backs to the hub');

// ---- one level chain: studio sub-screen -> studio -> hub ----
await page.evaluate(() => window.BooTown.go('paint'));
await page.waitForSelector('.paint-canvas');
await page.click('.back-btn');
await page.waitForSelector('.studio-grid', { timeout: 3000 });
assert((await screenName()) === 'studio', 'Paint backs ONE level to the Studio (not the hub)');
await page.click('.back-btn');
await page.waitForSelector('.hub');
assert((await screenName()) === 'hub', 'the Studio then backs to the hub');

// ---- screenshots: 3 sub-screens + one in-game shell at 3 sizes ----
console.log('== screenshots ==');
await ctx.close();
for (const [tag, vp] of [['tab-land', { width: 1000, height: 625 }], ['tab-port', { width: 625, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
  const c2 = await browser.newContext({ viewport: vp });
  const p2 = await c2.newPage();
  p2.on('pageerror', e => errors.push('PE ' + e.message));
  await p2.goto(BASE + '/index.html', { waitUntil: 'load' });
  await p2.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await p2.reload({ waitUntil: 'load' }); await p2.waitForSelector('.hub');
  for (const s of ['collection', 'studio', 'grownups']) {
    await p2.evaluate((x) => window.BooTown.go(x), s); await sleep(350);
    await p2.screenshot({ path: `screenshots/dashpatch/back-${s}-${tag}.png` });
  }
  await p2.evaluate(() => window.BooTown.go('clockshop'));
  await p2.waitForSelector('.start-card');
  await p2.click('.level-row .level-btn');
  await p2.waitForSelector('.clock-face'); await sleep(250);
  await p2.screenshot({ path: `screenshots/dashpatch/back-ingame-${tag}.png` });
  console.log('  wrote set', tag);
  await c2.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
