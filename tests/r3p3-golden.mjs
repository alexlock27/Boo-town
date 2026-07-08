// tests/r3p3-golden.mjs — RUN3 phase 3: Golden Round (acceptance D10).
// Parent-typed content round-trips; double stars once/day; twin flag -> Sound Twins item;
// gold hub card visible.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, spellingMastery: {}, ledger: {}, trickyPile: [], golden: null, goldenLastDouble: '', settings: { sound: false, music: false, voice: false }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true }, trophies: { trophy_golden: '2026-07-01' } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');
// freeze the day so the double-once-per-day logic is testable
await page.evaluate(() => { window.__bootownDay = '2026-07-04'; });

// ---- editor: type content, save, round-trip ----
console.log('== D10: editor round-trip ==');
await page.evaluate(() => window.BooTown.go('grownups'));
await page.waitForSelector('.gr-save');
await page.fill('.gr-word >> nth=0', 'octopus');
await page.fill('.gr-word >> nth=1', 'their');
await page.check('.gr-twin >> nth=1');
await page.fill('.gr-rival >> nth=1', 'there');
await page.fill('.gr-clue >> nth=1', '___ house is big');
await page.fill('.gr-q >> nth=0', 'What is 2 + 2?');
await page.fill('.gr-right >> nth=0', '4');
await page.fill('.gr-wrong >> nth=0', '3');
await page.fill('.gr-wrong >> nth=1', '5');
await page.click('.gr-save');
await sleep(200);
const golden = await page.evaluate(() => window.BooTown.State.getState().golden);
assert(golden && golden.words.length === 2 && golden.choices.length === 1, 'parent content saved (2 words, 1 question)');
assert(golden.words[1].twin === true && golden.words[1].rival === 'there', 'twin flag + rival spelling round-trip');
assert(golden.words[1].clue === '___ house is big', 'clue sentence round-trips');
// persistence across reload
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub');
await page.evaluate(() => { window.__bootownDay = '2026-07-04'; });
const persisted = await page.evaluate(() => window.BooTown.State.getState().golden);
assert(persisted && persisted.words.length === 2, 'Golden Round persists across reload');

// ---- hub gold card visible ----
console.log('== D10: hub card ==');
const cardText = await page.$eval('.golden-card', n => n.textContent).catch(() => null);
assert(cardText && /Golden Round/.test(cardText), 'gold Golden Round card appears on the hub');

// ---- play: word tile, twin -> Sound Twins item, choice buttons; double stars ----
console.log('== D10: play + double stars ==');
function totalPoints() { return page.evaluate(() => { const s = window.BooTown.State.getState(); return s.boxes * 6 + s.meter; }); }
// Atomic step: inspect cur() and act in ONE evaluate to avoid races across the advance gap.
async function step() {
  return await page.evaluate(() => {
    const c = window.__golden.cur(); if (!c) return 'wait';
    if (c.kind === 'word') { c.typeCorrect(); return 'word'; }
    if (c.kind === 'twin') { if (c.phase() === 'pick') { c.pick(c.answer()); return 'twin-pick'; } c.typeCorrect(); return 'twin-spell'; }
    if (c.kind === 'choice') { c.choose(c.right); return 'choice'; }
    return 'wait';
  });
}
async function playGolden() {
  await page.click('.golden-card');
  await page.waitForSelector('.spell-stage');
  const seen = new Set();
  for (let g = 0; g < 30; g++) {
    if (await page.$('.result-card')) break;
    const did = await step();
    seen.add(did);
    await sleep(did === 'twin-pick' ? 350 : did === 'wait' ? 250 : 1450);
  }
  await page.waitForSelector('.result-card', { timeout: 5000 });
  await page.waitForTimeout(2600);
  return seen;
}
const seen = await playGolden();
assert(seen.has('word') && seen.has('twin-pick') && seen.has('twin-spell') && seen.has('choice'),
  `round mixes word tiles, a Sound Twins item (pick then spell), and a choice question (${[...seen].join(',')})`);
await page.waitForSelector('.result-btns .btn.soft'); await page.click('.result-btns .btn.soft'); await page.waitForSelector('.hub');
const afterFirst = await totalPoints();
assert(afterFirst === 8, `first daily play banks double stars + bonus (8 points, got ${afterFirst})`);

// replay same day -> normal stars: clean 3-star -> 3 + 1 = 4 points
await page.evaluate(() => { window.__bootownDay = '2026-07-04'; });
await playGolden();
await page.waitForSelector('.result-btns .btn.soft'); await page.click('.result-btns .btn.soft'); await page.waitForSelector('.hub');
const afterSecond = await totalPoints();
assert(afterSecond - afterFirst === 4, `a same-day replay earns normal stars (+4 points, got +${afterSecond - afterFirst})`);

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
