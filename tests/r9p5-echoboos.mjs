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

// ---- 4) the tune is OFFERED again, not replayed at her; a later slip ends warmly ----
// REWRITTEN 2026-08-10. This section asserted RUN9 C5's automatic mercy replay, which
// RUN18B Y6 (f1780e8) deliberately replaced: a slip now STOPS the play and shows a card
// with two one-tap ways on — "🔊 Hear it again" and "Keep going" — so nothing is lit and
// nothing is counting while she decides. The old assertions therefore waited forever for
// an inputPhase that only a TAP can now produce: that wait, not any product fault, is why
// this suite never finished. `mercyUsed` survives for Lightning alone (a score chase keeps
// its own automatic mercy), so it is asserted there instead. Y6 shipped the hooks this
// rewrite uses — offered / againUp / hearAgain / keepGoing — and nothing had used them.
console.log('== the tune is offered again (RUN18B Y6), and a later slip ends warmly ==');
async function slip(page) {
  const seq = await page.evaluate(() => window.__echo.sequence());
  const wrong = [0, 1, 2, 3].find(i => i !== seq[0]);
  await page.evaluate(w => window.__echo.tap(w), wrong);
}
{
  const { ctx, page } = await fresh();
  await playEcho(page);
  // build up a length first so bestLen > 0
  await page.evaluate(() => window.__echo.echoAll());
  await page.waitForFunction(() => window.__echo.state().len >= 2 && window.__echo.state().inputPhase, { timeout: 8000 });
  const bestBefore = await page.evaluate(() => window.__echo.state().bestLen);

  await slip(page);
  await page.waitForFunction(() => window.__echo.againUp(), null, { timeout: 6000 });
  const afterSlip = await page.evaluate(() => ({
    offered: window.__echo.offered(), ended: window.__echo.state().ended,
    input: window.__echo.state().inputPhase, lit: window.__echo.anyLit(),
    line: (document.querySelector('.echo-again-line') || {}).textContent || '',
    btns: [...document.querySelectorAll('.echo-again-btns .btn')].map(b => b.textContent)
  }));
  assert(afterSlip.offered && !afterSlip.ended, 'a slip offers the tune again — it never ends the round');
  assert(!afterSlip.input && !afterSlip.lit, 'and the play STOPS while she decides: nothing lit, nothing counting');
  assert(afterSlip.line === 'Nearly! Want to hear it once more?', `the offer is warm and asks, never tells ("${afterSlip.line}")`);
  assert(afterSlip.btns.length === 2 && /Hear it again/.test(afterSlip.btns[0]) && /Keep going/.test(afterSlip.btns[1]),
    `two one-tap ways on, the one she came for first (${afterSlip.btns.join(' | ')})`);

  // "Keep going" hands her turn straight back — same sequence, no replay
  const seqBefore = await page.evaluate(() => window.__echo.sequence().join(','));
  await page.evaluate(() => window.__echo.keepGoing());
  await page.waitForFunction(() => window.__echo.state().inputPhase, { timeout: 6000 });
  const kept = await page.evaluate(() => ({ seq: window.__echo.sequence().join(','), pos: window.__echo.state().pos, again: window.__echo.againUp(), heard: window.__echo.heardAgain() }));
  assert(kept.seq === seqBefore && kept.pos === 0, 'Keep going hands her turn back from the top of the SAME tune');
  assert(!kept.again && !kept.heard, 'the card is gone, and Keep going does not count as hearing it again');

  // a slip once the offer has been used ends the round warmly, at her best length
  await slip(page);
  await page.waitForFunction(() => window.__echo.state().ended, { timeout: 6000 });
  const end = await page.evaluate(() => ({ best: window.__echo.state().bestLen, status: (document.querySelector('.echo-status') || {}).textContent || '' }));
  assert(end.best >= bestBefore, `the round ends at her best length, never below it (${bestBefore} → ${end.best})`);
  assert(!/wrong|lost|fail|no\b/i.test(end.status), `and it ends warmly ("${end.status}")`);
  await ctx.close();
}
{
  // "Hear it again" replays the same tune at the same tempo, and caps the round at 2 stars
  const { ctx, page } = await fresh();
  await playEcho(page);
  await page.evaluate(() => window.__echo.echoAll());
  await page.waitForFunction(() => window.__echo.state().len >= 2 && window.__echo.state().inputPhase, { timeout: 8000 });
  const seqBefore = await page.evaluate(() => window.__echo.sequence().join(','));
  await slip(page);
  await page.waitForFunction(() => window.__echo.againUp(), null, { timeout: 6000 });
  await page.evaluate(() => window.__echo.hearAgain());
  await page.waitForFunction(() => window.__echo.state().inputPhase, { timeout: 10000 });
  const heard = await page.evaluate(() => ({ seq: window.__echo.sequence().join(','), heard: window.__echo.heardAgain(), again: window.__echo.againUp(), ended: window.__echo.state().ended }));
  assert(heard.seq === seqBefore, 'Hear it again replays the SAME tune, not a new one');
  assert(heard.heard && !heard.again && !heard.ended, 'and hands her turn back afterwards, round still alive');
  // hearing it again is free but honest: the round caps at two stars
  const capped = await page.evaluate(() => { window.__echo.setBestForTest(9); return window.__echo.stars(); });
  assert(capped === 2, `hearing it again caps a would-be three-star round at two (${capped})`);
  await ctx.close();
}
{
  // Lightning keeps the AUTOMATIC one-mercy replay: it is a score chase, not a lesson.
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('echoboos', { resume: true, lightning: true }));
  await page.waitForSelector('.echo-board', { timeout: 8000 });
  await page.waitForFunction(() => window.__echo && window.__echo.state().lightning, null, { timeout: 8000 });
  await page.waitForFunction(() => window.__echo.state().inputPhase, { timeout: 8000 });
  await slip(page);
  await page.waitForFunction(() => window.__echo.state().mercyUsed, { timeout: 6000 });
  assert(!(await page.evaluate(() => window.__echo.state().ended)), 'Lightning: the first slip spends the one mercy and replays automatically');
  await page.waitForFunction(() => window.__echo.state().inputPhase, { timeout: 10000 });
  await slip(page);
  await page.waitForFunction(() => window.__echo.state().ended, { timeout: 6000 });
  assert(true, 'Lightning: the second slip ends the round');
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
