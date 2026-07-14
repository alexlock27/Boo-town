// tests/r9p5-echoboos.mjs — Echo Boos (RUN9 C5) + acceptance part D #5.
// The sequence grows; the mercy-replay fires once and a second slip ends warmly at her best
// length; the light pattern alone suffices with sound muted; the pace caps hold; the Toddler
// cap applies.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sky', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 5, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [],
  stars: { total: 60, byGame: {} }, ledger: {}, seen: { introSeen: { echoboos: 1 } }, trophies: {}, ageAsked: true, age: 8,
  settings: { sound: false, music: false, voice: false, content: 'full' }
}, over);

const browser = await chromium.launch();
async function fresh(over) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 780 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(v => localStorage.setItem('bootown.save.v1', JSON.stringify(v)), SAVE(over));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub, .toddler-cards', { timeout: 4000 }).catch(() => {});
  return { ctx, page };
}
async function playEcho(page) {
  await page.evaluate(() => window.BooTown.go('echoboos'));
  await page.waitForSelector('.start-card');
  await page.click('.start-card .btn.big');
  await page.waitForSelector('.echo-board');
  await page.waitForFunction(() => window.__echo);
  await page.waitForFunction(() => window.__echo.state().inputPhase, { timeout: 6000 });
}

// ---- 1) star bands ----
console.log('== star bands ==');
{
  const { ctx, page } = await fresh();
  const bands = await page.evaluate(async () => { const m = await import('./js/games/echoboos.js'); return [m.starsFor(8), m.starsFor(9), m.starsFor(5), m.starsFor(4), m.starsFor(0)]; });
  assert(bands[0] === 3 && bands[1] === 3, '3 stars at length 8+');
  assert(bands[2] === 2, '2 stars at length 5');
  assert(bands[3] === 1 && bands[4] === 1, '1 star below 5 / for playing');
  await ctx.close();
}

// ---- 2) the sequence grows on a correct echo ----
console.log('== sequence grows ==');
{
  const { ctx, page } = await fresh();
  await playEcho(page);
  const len0 = await page.evaluate(() => window.__echo.state().len);
  await page.evaluate(() => window.__echo.echoAll());
  await page.waitForFunction(l => window.__echo.state().len > l, len0, { timeout: 4000 });
  const len1 = await page.evaluate(() => window.__echo.state().len);
  assert(len1 === len0 + 1, `a correct echo extends the tune by one (${len0} → ${len1})`);
  assert(await page.evaluate(() => window.__echo.state().bestLen) >= 1, 'the echoed length is recorded as best');
  await ctx.close();
}

// ---- 3) light pattern carries it with sound muted ----
console.log('== muted: the light pattern carries it ==');
{
  const { ctx, page } = await fresh();   // settings.sound=false already
  await page.evaluate(() => window.BooTown.go('echoboos'));
  await page.waitForSelector('.start-card');
  await page.click('.start-card .btn.big');
  await page.waitForSelector('.echo-board');
  await page.waitForFunction(() => window.__echo);
  // during playback (sound muted) a Boo still lights up
  let sawLit = false;
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => window.__echo.anyLit())) { sawLit = true; break; } await sleep(40); }
  assert(sawLit, 'a Boo visibly lights up during playback even with sound muted');
  // and the round is completable muted
  await page.waitForFunction(() => window.__echo.state().inputPhase, { timeout: 4000 });
  const ok = await page.evaluate(() => window.__echo.echoAll());
  assert(ok, 'the round is fully playable with sound off (light pattern alone)');
  await ctx.close();
}

// ---- 4) mercy replay fires once; a second slip ends warmly at best length ----
console.log('== mercy replay + warm end ==');
{
  const { ctx, page } = await fresh();
  await playEcho(page);
  // build up a couple of lengths first so bestLen > 0
  await page.evaluate(() => window.__echo.echoAll());
  await page.waitForFunction(() => window.__echo.state().len >= 2 && window.__echo.state().inputPhase, { timeout: 5000 });
  const bestBefore = await page.evaluate(() => window.__echo.state().bestLen);
  // first slip: tap a wrong Boo (a value not first in the sequence)
  const seq = await page.evaluate(() => window.__echo.sequence());
  const wrong = [0, 1, 2, 3].find(i => i !== seq[0]);
  await page.evaluate(w => window.__echo.tap(w), wrong);
  await sleep(120);
  assert(await page.evaluate(() => window.__echo.state().mercyUsed), 'a first slip triggers the one-mercy replay');
  assert(!(await page.evaluate(() => window.__echo.state().ended)), 'the round does not end on the first slip');
  // wait for the mercy replay to return to input, then slip again → warm end
  await page.waitForFunction(() => window.__echo.state().inputPhase, { timeout: 5000 });
  const seq2 = await page.evaluate(() => window.__echo.sequence());
  const wrong2 = [0, 1, 2, 3].find(i => i !== seq2[0]);
  await page.evaluate(w => window.__echo.tap(w), wrong2);
  await sleep(150);
  assert(await page.evaluate(() => window.__echo.state().ended), 'a second slip ends the round warmly');
  assert(await page.evaluate(() => window.__echo.state().bestLen) >= bestBefore, `the round ends at her best length (${bestBefore})`);
  await ctx.close();
}

// ---- 5) pace caps hold ----
console.log('== pace caps ==');
{
  const { ctx, page } = await fresh();
  await playEcho(page);
  const caps = await page.evaluate(() => ({ min: window.__echo.minGap(), g2: window.__echo.gap(2), g20: window.__echo.gap(20), g50: window.__echo.gap(50) }));
  assert(caps.g2 > caps.g20, `the pace quickens as the tune grows (${caps.g2} → ${caps.g20})`);
  assert(caps.g50 >= caps.min, `the pace never drops below the kid-friendly floor (${caps.g50} >= ${caps.min})`);
  await ctx.close();
}

// ---- 6) Toddler cap applies ----
console.log('== Toddler cap ==');
{
  const { ctx, page } = await fresh({ settings: { sound: false, music: false, voice: false, content: 'toddler' } });
  await page.evaluate(() => window.BooTown.go('echoboos'));
  await page.waitForSelector('.start-card');
  await page.click('.start-card .btn.big');
  await page.waitForSelector('.echo-board');
  await page.waitForFunction(() => window.__echo);
  const cap = await page.evaluate(() => window.__echo.cap());
  assert(cap === 6, `the Toddler tier caps the tune length (${cap})`);
  assert(await page.evaluate(() => window.__echo.state().toddler), 'the Toddler mode is active');
  // gentler pace than Light+
  assert(await page.evaluate(() => window.__echo.minGap()) > 400, 'the Toddler pace floor is gentler');
  await ctx.close();
}

await browser.close();
console.log('\n' + (failed ? 'r9p5-echoboos: FAIL' : 'r9p5-echoboos: ALL PASS'));
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
