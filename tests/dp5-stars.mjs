// tests/dp5-stars.mjs — DASH_PATCH follow-on job 5: total stars visible.
// A star-count chip beside the hub meter with a brief count-up when it grows; every star
// requirement shown as current / required with a mini progress bar. Read-only (no economy).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/dashpatch', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = (extra = {}) => ({ version: 4, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1 }, boxes: 0, meter: 2, opened: 1, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 26, byGame: {} }, ledger: {}, ageAsked: true, settings: { sound: false, music: false, voice: false, content: 'full' }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, lastStarsShown: 26 }, ...extra });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

// ---- the chip reads the save total ----
console.log('== total-stars chip ==');
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.stars-total');
await sleep(200);
const shown = await page.$eval('.stars-total .st-n', n => n.textContent);
assert(shown === '26', `the chip shows the save total (26, got ${shown})`);

// ---- frame evidence: a brief count-up when the total grows ----
// (seed in a FRESH context: a live app's debounced autosave would overwrite the seed)
console.log('== count-up frame evidence ==');
await ctx.close();
const ctx2 = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page2 = await ctx2.newPage();
page2.on('pageerror', e => errors.push('PE ' + e.message));
page2.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
await page2.goto(BASE + '/index.html', { waitUntil: 'load' });
await page2.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE({ stars: { total: 58, byGame: {} }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, lastStarsShown: 26 } }));
await page2.reload({ waitUntil: 'load' });
await page2.waitForSelector('.stars-total');
const frames = [];
for (let i = 0; i < 6; i++) { frames.push(await page2.$eval('.stars-total .st-n', n => n.textContent)); await sleep(160); }
const nums = frames.map(Number);
const distinct = new Set(nums).size;
const monotonic = nums.every((v, i) => i === 0 || v >= nums[i - 1]);
assert(distinct >= 3 && monotonic && nums[0] < 58 && nums[nums.length - 1] === 58,
  `count-up animates 26 -> 58 across frames: [${frames.join(', ')}] (${distinct} distinct, ends at 58)`);
const synced = await page2.evaluate(() => window.BooTown.State.getState().seen.lastStarsShown);
assert(synced === 58, 'the shown value is remembered so it only counts up when it grows');

// ---- signposts: current / required + mini progress bar ----
console.log('== zone signposts ==');
await page2.evaluate(() => window.BooTown.go('town'));
await page2.waitForSelector('.t-signpost');
const signs = await page2.$$eval('.t-signpost', ns => ns.map(n => ({
  req: n.querySelector('.t-sign-req').textContent,
  bar: !!n.querySelector('.t-sign-bar'),
  width: n.querySelector('.t-sign-bar i') ? n.querySelector('.t-sign-bar i').style.width : null
})));
assert(signs.length === 2, 'the two still-locked zones show signposts (58 stars unlocks Riverside@40; Hilltop@100 + Beach@180 remain)');
assert(signs.every(s => /^58 \/ \d+ ⭐$/.test(s.req)), 'signposts read current / required: ' + signs.map(s => s.req).join(' · '));
assert(signs.every(s => s.bar && s.width), 'each signpost carries a mini progress bar');
assert(parseInt(signs[0].width) === 58 && parseInt(signs[1].width) === 32, `bar widths match progress: 58/100 -> 58%, 58/180 -> 32% (${signs.map(s => s.width).join(', ')})`);

// ---- screenshots at 3 sizes ----
console.log('== screenshots ==');
await ctx2.close();
for (const [tag, vp] of [['tab-land', { width: 1000, height: 625 }], ['tab-port', { width: 625, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
  const c2 = await browser.newContext({ viewport: vp });
  const p2 = await c2.newPage();
  p2.on('pageerror', e => errors.push('PE ' + e.message));
  await p2.goto(BASE + '/index.html', { waitUntil: 'load' });
  await p2.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());   // 26 stars: Riverside still locked, no unlock ceremony
  await p2.reload({ waitUntil: 'load' }); await p2.waitForSelector('.stars-total'); await sleep(300);
  await p2.screenshot({ path: `screenshots/dashpatch/stars-hub-${tag}.png` });
  await p2.evaluate(() => window.BooTown.go('town'));
  await p2.waitForSelector('.t-signpost'); await sleep(400);
  // scroll the first locked zone (riverside, 26/40) into view
  await p2.evaluate(() => { const vpn = document.querySelector('.t-viewport'); if (vpn) vpn.dispatchEvent(new WheelEvent('wheel', { deltaY: vpn.clientWidth * 1.0, bubbles: true })); });
  await sleep(300);
  await p2.screenshot({ path: `screenshots/dashpatch/stars-signpost-${tag}.png` });
  console.log('  wrote set', tag);
  await c2.close();
}

// ---- smoke one game round ----
console.log('== one-round smoke ==');
{
  const c3 = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const p3 = await c3.newPage();
  p3.on('pageerror', e => errors.push('PE ' + e.message));
  await p3.goto(BASE + '/index.html', { waitUntil: 'load' });
  await p3.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
  await p3.reload({ waitUntil: 'load' }); await p3.waitForSelector('.hub');
  await p3.evaluate(() => window.BooTown.go('clockshop'));
  await p3.waitForSelector('.start-card');
  await p3.click('.level-row .level-btn');
  await p3.waitForSelector('.clock-face');
  for (let g = 0; g < 10; g++) {
    if (await p3.$('.result-card')) break;
    await p3.evaluate(() => { const o = window.__clock.order(); window.__clock.set(o.h12, o.m); window.__clock.serve(); });
    await sleep(1000);
  }
  await p3.waitForSelector('.result-card', { timeout: 5000 });
  assert(true, 'a full Clock Shop round completes to results');
  // and the hub chip grew by the round's stars (count-up path re-fires)
  await p3.waitForSelector('.result-btns .btn.soft'); await p3.click('.result-btns .btn.soft');
  await p3.waitForSelector('.stars-total'); await sleep(1100);
  const after = await p3.$eval('.stars-total .st-n', n => n.textContent);
  assert(Number(after) > 26, `the chip grew after the round (26 -> ${after})`);
  await c3.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
