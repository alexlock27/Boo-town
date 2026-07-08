// tests/r3p5-clock.mjs — RUN3 phase 5: Clock Shop (acceptance D13).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, spellingMastery: {}, ledger: {}, trickyPile: [], golden: null, goldenLastDouble: '', quests: { day: '', list: [], done: [], progress: {}, boxDay: '' }, journal: {}, settings: { sound: false, music: false, voice: false }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');

async function enter(level) {
  await page.evaluate(() => window.BooTown.go('clockshop'));
  await page.waitForSelector('.start-card');
  await page.click(`.level-row .level-btn >> nth=${level - 1}`);
  await page.waitForSelector('.clock-face');
  await sleep(120);
}

// ---- D13: all three levels playable; orders valid per level ----
console.log('== D13: levels + orders ==');
for (const lv of [1, 2, 3]) {
  await enter(lv);
  const o = await page.evaluate(() => window.__clock.order());
  const validMins = { 1: [0, 30], 2: [0, 15, 30, 45], 3: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] }[lv];
  assert(o.h12 >= 1 && o.h12 <= 12 && validMins.includes(o.m), `level ${lv} order is valid (${o.h12}:${String(o.m).padStart(2, '0')})`);
}
// level 3 shows a digital display
await enter(3);
const digShown = await page.evaluate(() => { const d = document.querySelector('.shop-digital'); return d && getComputedStyle(d).display !== 'none' && /\d:\d\d/.test(d.textContent); });
assert(digShown, 'level 3 shows a digital display to match');

// ---- D13: hour hand moves PROPORTIONALLY with the minute hand (never jumps) ----
console.log('== D13: proportional hour hand ==');
const prop = await page.evaluate(() => {
  window.__clock.set(3, 0);
  const samples = [];
  for (const m of [0, 5, 10, 20, 30, 40, 50, 55]) { window.__clock.dragMinuteTo(m); const st = window.__clock.state(); samples.push({ m: st.sm, hour: st.hourAngle, min: st.minAngle }); }
  return samples;
});
// hour angle should be 90 + m*0.5, strictly increasing, small steps (proportional, no jump)
let mono = true, maxStep = 0, ok = true;
for (let i = 0; i < prop.length; i++) {
  const expect = 90 + prop[i].m * 0.5;
  if (Math.abs(prop[i].hour - expect) > 0.5) ok = false;
  if (i > 0) { const d = prop[i].hour - prop[i - 1].hour; if (d <= 0) mono = false; maxStep = Math.max(maxStep, d); }
}
assert(ok, 'hour hand = hour + minutes/60 (proportional): ' + JSON.stringify(prop.map(p => [p.m, p.hour])));
assert(mono, 'hour hand advances monotonically as the minute hand travels');
assert(maxStep < 6, `hour hand never jumps (max step ${maxStep.toFixed(2)}° between minute snaps)`);
// minute hand also moves with the drag
assert(prop[0].min === 0 && prop[prop.length - 1].min === 55 * 6, 'minute hand tracks the drag');

// ---- D13: wrong setting wiggles + counts; hint ghosts then fades ----
console.log('== D13: wrong + hint ==');
await enter(1);
const o1 = await page.evaluate(() => window.__clock.order());
// set a deliberately wrong time then serve
await page.evaluate((o) => { window.__clock.set(o.h12 === 12 ? 1 : o.h12 + 1, o.m === 0 ? 30 : 0); }, o1);
await page.evaluate(() => window.__clock.serve());
await sleep(200);
const afterWrong = await page.evaluate(() => window.__clock.stats());
const wiggled = await page.evaluate(() => document.querySelector('.clock-wrap').classList.contains('wiggle'));
assert(afterWrong.wrong >= 1, 'a wrong setting counts as wrong');
assert(wiggled, 'a wrong setting wiggles the clock');
// hint ghosts the correct hands, then fades
await page.evaluate(() => window.__clock.hint());
await sleep(150);
const ghostOn = await page.evaluate(() => window.__clock.ghostShown());
await sleep(1200);
const ghostGone = await page.evaluate(() => window.__clock.ghostShown());
assert(ghostOn && !ghostGone, 'the hint ghosts the correct hands for ~1s, then fades');

// ---- D13: complete a round -> results + feeds the meter ----
console.log('== D13: full round ==');
await enter(2);
const meterBefore = await page.evaluate(() => window.BooTown.State.getState().meter + window.BooTown.State.getState().boxes * 6);
for (let g = 0; g < 10; g++) {
  if (await page.$('.result-card')) break;
  await page.evaluate(() => { const o = window.__clock.order(); window.__clock.set(o.h12, o.m); window.__clock.serve(); });
  await sleep(1000);
}
await page.waitForSelector('.result-card', { timeout: 5000 });
await page.waitForTimeout(2400);
const stars = await page.$$eval('.rstar.pop', e => e.length);
assert(stars === 3, 'a clean round (no wrong, no hints) earns 3 stars (' + stars + ')');
const meterAfter = await page.evaluate(() => window.BooTown.State.getState().meter + window.BooTown.State.getState().boxes * 6);
assert(meterAfter > meterBefore, 'Clock Shop feeds the meter (' + meterBefore + ' -> ' + meterAfter + ')');

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
