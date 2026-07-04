// tests/p5-bounce.mjs — Boo Bounce (RUN2 C5) + part E check 7.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 625 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });

await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(() => localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, town: [], stars: { total: 30, byGame: {} }, settings: { sound: false, music: false, voice: false, content: 'full' }, seen: {} })));
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');

// ---- star thresholds ----
console.log('== star thresholds ==');
const sl = await page.evaluate(async () => { const m = await import('./js/games/bounce.js'); return [m.starsForBounce(0, 0), m.starsForBounce(1, 1), m.starsForBounce(2, 0), m.starsForBounce(0, 3), m.starsForBounce(2, 2)]; });
assert(sl[0] === 3 && sl[1] === 3, '3 stars: <=1 wrong AND <=1 loss');
assert(sl[2] === 2 && sl[3] === 2, '2 stars: <=3 combined');
assert(sl[4] === 1, '1 star otherwise (finished)');

async function enterBounce() {
  await page.evaluate(() => window.BooTown.go('bounce'));
  await page.waitForSelector('.start-card');
  await page.click('.level-row .level-btn');
  await page.waitForSelector('.bounce-canvas');
  await page.waitForTimeout(180);
}

// ---- perfect play -> 3 stars (deterministic: no launch, break the correct brick) ----
console.log('== 3-starrable headlessly ==');
await enterBounce();
const before = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { plays: s.stars.byGame.bounce.plays, total: s.stars.total }; });
const perfect = await page.evaluate(async () => {
  const B = window.__bounce; const sleep = ms => new Promise(r => setTimeout(r, ms));
  let g = 0; while (!B.state().ended && g++ < 30) { B.breakCorrect(); await sleep(40); }
  return B.state();
});
assert(perfect.ended, 'round ends via perfect play (wallClears ' + perfect.wallClears + ', Qs ' + perfect.questionsAnswered + ')');
assert(perfect.wrongBricks === 0 && perfect.ballLosses === 0, 'no wrong bricks, no ball losses -> 3 stars');
await page.waitForSelector('.result-card', { timeout: 4000 });
await page.waitForTimeout(2600);
const stars3 = await page.$$eval('.rstar.pop', els => els.length);
assert(stars3 === 3, 'results show 3 stars (' + stars3 + ')');
await page.screenshot({ path: 'screenshots/p5-3star.png' });
await page.click('.result-btns .btn.soft'); await page.waitForSelector('.hub');
const after = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { plays: s.stars.byGame.bounce.plays, total: s.stars.total }; });
assert(after.plays === before.plays + 1, 'bounce play recorded');
assert(after.total > before.total, 'stars fed the meter');

// ---- real physics: ball moves, bounces, breaks bricks ----
console.log('== real physics plays ==');
await enterBounce();
const phys = await page.evaluate(async () => {
  const B = window.__bounce; const sleep = ms => new Promise(r => setTimeout(r, ms));
  B.autoPaddle(true); B.launch();
  const a0 = B.state().alive;
  await sleep(2500);
  const s = B.state();
  return { before: a0, after: s.alive, ended: s.ended };
});
assert(phys.after < phys.before, 'the ball actually breaks bricks in play (' + phys.before + ' -> ' + phys.after + ')');

// ---- wrong-brick path: label rehomes, stays 3 labels ----
console.log('== wrong brick rehomes label ==');
await enterBounce();
const wrongTest = await page.evaluate(async () => {
  const B = window.__bounce; const sleep = ms => new Promise(r => setTimeout(r, ms));
  const l0 = B.state().labels; B.breakWrong(); await sleep(60);
  const s = B.state();
  return { l0, labels: s.labels, wrong: s.wrongBricks };
});
assert(wrongTest.wrong === 1, 'breaking a wrong brick counts a wrong');
assert(wrongTest.labels === 3, 'the wrong label hops to another brick (still 3 labels)');

// ---- hearts never end the round ----
console.log('== hearts never end ==');
await enterBounce();
const heartTest = await page.evaluate(async () => {
  const B = window.__bounce; const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 4; i++) { B.loseBall(); await sleep(30); }
  const s = B.state();
  return { losses: s.ballLosses, hearts: s.hearts, ended: s.ended };
});
assert(heartTest.losses === 4 && heartTest.hearts === 0, 'four ball losses dim all hearts');
assert(heartTest.ended === false, 'round does NOT end when hearts run out (gentle)');

// ---- pauses when hidden ----
console.log('== pauses when hidden ==');
const paused = await page.evaluate(async () => {
  const B = window.__bounce; const sleep = ms => new Promise(r => setTimeout(r, ms));
  B.autoPaddle(false); B.launch();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  const a = B.state().alive; await sleep(500); const b = B.state().alive;
  return a === b; // no bricks broke while hidden (ball frozen)
});
assert(paused, 'ball does not advance while hidden');

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
