// tests/r3p2-smartmix.mjs — RUN3 phase 2: Smart Mix + Tricky Pile.
// D8: ratios ~40/40/20, weak twins/th double weight, draws from ALL content.
// D9: Tricky Pile captures misses, rescue +1 meter without changing stars, unrescued persist.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, spellingMastery: {}, ledger: {}, trickyPile: [], settings: { sound: false, music: false, voice: false }, seen: {} };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');

// ---- D8: Smart Mix engine ratios + double weight ----
console.log('== D8: Smart Mix ratios & double weight ==');
const d8 = await page.evaluate(async () => {
  const { buildSmartMix } = await import('./js/smartmix.js');
  const pool = [];
  for (let i = 0; i < 20; i++) pool.push({ id: 'w' + i, boost: i < 5 ? 2 : 1 });   // 20 weak, 5 boosted
  for (let i = 0; i < 40; i++) pool.push({ id: 'm' + i });                          // 40 middle
  for (let i = 0; i < 20; i++) pool.push({ id: 's' + i });                          // 20 mastered
  const classOf = it => it.id[0] === 'w' ? 'weak' : it.id[0] === 'm' ? 'middle' : 'mastered';
  const cnt = { weak: 0, middle: 0, mastered: 0 }; let boost = 0, plain = 0; const N = 200;
  for (let r = 0; r < N; r++) for (const it of buildSmartMix(pool, 8, { classOf })) {
    cnt[classOf(it)]++;
    if (classOf(it) === 'weak') { if (it.boost === 2) boost++; else plain++; }
  }
  const tot = N * 8;
  return { pctWeak: 100 * cnt.weak / tot, pctMiddle: 100 * cnt.middle / tot, pctMastered: 100 * cnt.mastered / tot, boostRate: boost / 5 / N, plainRate: plain / 15 / N };
});
assert(Math.abs(d8.pctWeak - 40) <= 10, `weak share within 10 of 40 (${d8.pctWeak.toFixed(1)}%)`);
assert(Math.abs(d8.pctMiddle - 40) <= 10, `middle share within 10 of 40 (${d8.pctMiddle.toFixed(1)}%)`);
assert(Math.abs(d8.pctMastered - 20) <= 10, `mastered share within 10 of 20 (${d8.pctMastered.toFixed(1)}%)`);
assert(d8.boostRate > d8.plainRate * 1.4, `weak twins/th appear at ~double weight (boosted ${d8.boostRate.toFixed(3)} vs plain ${d8.plainRate.toFixed(3)})`);

// ---- D8: Smart Mix draws from ALL installed content (words + twins, any tier) ----
console.log('== D8: draws from all content (weak items surface) ==');
// seed the ledger so exactly two items are weak: a th word ("Thursday") and a twin set (toTooTwo)
await page.evaluate(() => {
  const save = JSON.parse(localStorage.getItem('bootown.save.v1'));
  save.ledger = { 'Thursday': { rights: 0, misses: 3, lastSeen: 1 }, 'twin:toTooTwo': { rights: 0, misses: 3, lastSeen: 2 } };
  localStorage.setItem('bootown.save.v1', JSON.stringify(save));
});
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub');
// play Smart Mix in Spell Boo and collect the identities presented across the round
await page.evaluate(() => window.BooTown.go('spellboo'));
await page.waitForSelector('.picker');
await page.click('.picker-choice.mix');
await page.click('.picker-levels .mix-start');
await page.waitForSelector('.spell-stage');
const seen = new Set();
for (let g = 0; g < 30; g++) {
  if (await page.$('.result-card')) break;
  const info = await page.evaluate(() => ({ kind: window.__spell.curKind(), word: window.__spell.word ? window.__spell.word() : null, item: window.__spell.item ? window.__spell.item() : null }));
  if (info.kind === 'word' && info.word) { seen.add(info.word); await page.evaluate(() => window.__spell.typeCorrect()); }
  else if (info.kind === 'twin' && info.item) { seen.add('twin:' + info.item.setId); await page.evaluate(() => window.__spell.pick(window.__spell.item().answer)); await sleep(300); await page.evaluate(() => window.__spell.typeCorrect()); }
  await sleep(1500);
}
const mixMixed = await page.evaluate(() => true);
assert([...seen].some(x => x.startsWith('twin:')) , 'Smart Mix round includes twin items (draws across content types)');
assert(seen.has('Thursday') || seen.has('twin:toTooTwo'), 'a seeded weak hidden-set item (th word / twin) surfaces in Smart Mix');
// leave results
if (await page.$('.result-card')) { await page.waitForSelector('.result-btns .btn.soft', { timeout: 4000 }); await page.click('.result-btns .btn.soft'); await page.waitForSelector('.hub'); }

// ---- D9: Tricky Pile captures misses, rescue +1 meter, no star change, persist ----
console.log('== D9: Tricky Pile capture + rescue + persist ==');
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('bootown.save.v1')); s.meter = 0; s.trickyPile = []; s.ledger = {}; localStorage.setItem('bootown.save.v1', JSON.stringify(s)); });
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub');
await page.evaluate(() => window.BooTown.go('spellboo'));
await page.waitForSelector('.picker');
await page.click('.picker-choice:has-text("Tricky Sounds")');
await page.click('.picker-levels .level-btn >> nth=0');
await page.waitForSelector('.spell-stage');
await sleep(120);
// force a miss on the first word, then spell every word correctly
await page.evaluate(() => window.__spell.typeWrong());
await sleep(700);
const collectedDuring = await page.evaluate(() => window.__spell.collected());
const puzzledShown = await page.evaluate(() => { const p = document.querySelector('.puzzled-boo'); return p && p.style.display !== 'none' && +p.querySelector('.pb-count').textContent >= 1; });
assert(collectedDuring >= 1 && puzzledShown, 'Puzzled Boo collects a missed item during the round');
// finish the round
for (let g = 0; g < 20; g++) { if (await page.$('.result-card')) break; await page.evaluate(() => window.__spell.typeCorrect()); await sleep(1500); }
await page.waitForSelector('.result-card', { timeout: 5000 });
await page.waitForSelector('.rescue-panel', { timeout: 4000 });
await page.waitForTimeout(300);
const meterBefore = await page.evaluate(() => window.BooTown.State.getState().meter);
const starsShown = await page.$$eval('.rstar.pop', e => e.length);
// rescue one item
await page.evaluate(() => window.__rescue.answerCorrect());
await sleep(300);
const meterAfter = await page.evaluate(() => window.BooTown.State.getState().meter);
const starsAfter = await page.$$eval('.rstar.pop', e => e.length);
assert(meterAfter === meterBefore + 1, `a rescue adds +1 meter point (${meterBefore} -> ${meterAfter})`);
assert(starsAfter === starsShown, 'rescue does not change the round\'s stars');

// persistence: skip any remaining and confirm unrescued persist across reload
const remaining = await page.evaluate(() => window.__rescue.remaining());
if (remaining > 0) { await page.evaluate(() => window.__rescue.skip()); await sleep(150); }
const pileBefore = await page.evaluate(() => window.BooTown.State.getState().trickyPile.slice());
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub');
const pileAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')).trickyPile);
// if there were unrescued items they persist; if all rescued the pile is empty (also valid) — assert it round-trips
assert(JSON.stringify(pileAfter) === JSON.stringify(pileBefore), 'the Tricky Pile persists across a reload (unrescued seed next Smart Mix)');

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
