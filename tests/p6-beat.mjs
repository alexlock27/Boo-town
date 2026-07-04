// tests/p6-beat.mjs — Boo Beat (RUN2 C6) + part E checks 7 & 8.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const browser = await chromium.launch();
const SAVE = JSON.stringify({ version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, town: [], stars: { total: 30, byGame: {} }, settings: { sound: false, music: false, voice: false }, seen: {} });

async function open(reduced) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 625 }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate((s) => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
async function enterBeat(page, words) {
  await page.evaluate(() => window.BooTown.go('beat'));
  await page.waitForSelector('.start-card');
  if (words) await page.click('.chip-row .acc-chip:has-text("Spelling")');
  await page.click('.level-row .level-btn');
  await page.waitForSelector('.beat-field');
  await page.waitForTimeout(200);
}

// ---- star thresholds ----
console.log('== star thresholds ==');
{
  const { ctx, page } = await open(false);
  const sl = await page.evaluate(async () => { const m = await import('./js/games/beat.js'); return [m.starsForBeat(8, 5), m.starsForBeat(10, 10), m.starsForBeat(8, 4), m.starsForBeat(6, 0), m.starsForBeat(5, 0)]; });
  assert(sl[0] === 3 && sl[1] === 3, '3 stars: 8+ correct and 5+ perfects');
  assert(sl[2] === 2, '8 correct but <5 perfects -> 2 stars');
  assert(sl[3] === 2, '6 correct -> 2 stars');
  assert(sl[4] === 1, '<6 correct -> 1 star');
  await ctx.close();
}

// ---- scroll mode: completable, 3-starrable, feeds meter ----
console.log('== scroll mode: 3-starrable + feeds meter ==');
{
  const { ctx, page } = await open(false);
  await enterBeat(page, false);
  const steady = await page.evaluate(() => window.__beat.steady());
  assert(steady === false, 'scroll mode when motion allowed');
  const before = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { plays: s.stars.byGame.beat.plays, total: s.stars.total }; });
  const st = await page.evaluate(async () => {
    const B = window.__beat; const sleep = ms => new Promise(r => setTimeout(r, ms));
    let g = 0; while (!B.state().ended && g++ < 80) { if (B.state().notes > 0) B.tapCorrect('perfect'); await sleep(90); }
    return B.state();
  });
  assert(st.ended && st.phraseIdx === 10, 'round completes all 10 phrases');
  assert(st.correct >= 8 && st.perfects >= 5, 'perfect play: 8+ correct, 5+ perfects -> 3 stars');
  await page.waitForSelector('.result-card', { timeout: 4000 });
  await page.waitForTimeout(2500);
  assert(await page.$$eval('.rstar.pop', e => e.length) === 3, 'results show 3 stars');
  await page.click('.result-btns .btn.soft'); await page.waitForSelector('.hub');
  const after = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { plays: s.stars.byGame.beat.plays, total: s.stars.total }; });
  assert(after.plays === before.plays + 1, 'beat play recorded');
  assert(after.total > before.total, 'stars fed the meter');
  await ctx.close();
}

// ---- steady mode under reduced-motion: playable start to finish (part E #8) ----
console.log('== steady mode (reduced-motion) playable start to finish ==');
{
  const { ctx, page } = await open(true);
  await enterBeat(page, true); // spelling gaps in steady mode
  const steady = await page.evaluate(() => window.__beat.steady());
  assert(steady === true, 'steady mode defaults on under reduced motion');
  const st = await page.evaluate(async () => {
    const B = window.__beat; const sleep = ms => new Promise(r => setTimeout(r, ms));
    let g = 0; while (!B.state().ended && g++ < 80) { if (B.state().notes > 0) B.tapCorrect('perfect'); await sleep(90); }
    return B.state();
  });
  assert(st.ended && st.phraseIdx === 10, 'steady mode plays all 10 phrases to the end');
  await page.waitForSelector('.result-card', { timeout: 4000 });
  await ctx.close();
}

// ---- hearts never end + wrong-tap path ----
console.log('== hearts never end + wrong tap ==');
{
  const { ctx, page } = await open(false);
  await enterBeat(page, false);
  const ht = await page.evaluate(async () => {
    const B = window.__beat; const sleep = ms => new Promise(r => setTimeout(r, ms));
    let dims = 0, g = 0;
    while (dims < 3 && g++ < 40) { const s = B.state(); if (s.notes > 0 && s.hearts > 0) { const h0 = s.hearts; B.tapWrong(); await sleep(120); if (B.state().hearts < h0) dims++; } await sleep(120); }
    const s = B.state();
    return { hearts: s.hearts, ended: s.ended, dims };
  });
  assert(ht.dims >= 3 && ht.hearts === 0, 'wrong taps dim hearts to zero (' + ht.dims + ')');
  assert(ht.ended === false, 'round does NOT end when hearts run out (gentle)');
  await ctx.close();
}

// ---- pauses when hidden ----
console.log('== pauses when hidden ==');
{
  const { ctx, page } = await open(false);
  await enterBeat(page, false);
  const paused = await page.evaluate(async () => {
    const B = window.__beat; const sleep = ms => new Promise(r => setTimeout(r, ms));
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    const p0 = B.state().phraseIdx + '/' + B.state().misses;
    await sleep(1000);
    const p1 = B.state().phraseIdx + '/' + B.state().misses;
    return p0 === p1;
  });
  assert(paused, 'notes do not advance / no misses while hidden');
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
