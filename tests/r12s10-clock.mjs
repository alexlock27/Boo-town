// @serial — device-simulation: device-hour driven states sampled over time (runs alone at the board's end; RUN14 U-0)
// tests/r12s10-clock.mjs — RUN12 S10: setting a clock feels exact and fair.
//
// Two reported defects. The hands never reset between orders, so every order after the
// first started from the previous answer. And an overlapping-hands grab was unpredictable,
// which matters much more now that every order starts at 12:00 with the two hands on top
// of each other.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run12/s10';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const SAVE = JSON.stringify({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { clockshop: true } },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
async function openLevel(level = 1) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('clockshop', {}));
  await page.waitForTimeout(900);
  await page.evaluate((lv) => document.querySelectorAll('.level-btn')[lv - 1].click(), level);
  await page.waitForTimeout(900);
  await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
  await page.waitForTimeout(500);
  return { ctx, page };
}

console.log('== the hands reset to 12:00 between orders, visibly ==');
{
  const { ctx, page } = await openLevel(1);
  assert(await page.evaluate(() => JSON.stringify(window.__clock.resetTo())) === '{"h12":12,"m":0}',
    'the authored neutral position is 12:00');
  const runs = [];
  for (let i = 0; i < 4; i++) {
    const r = await page.evaluate(async () => {
      const c = window.__clock;
      const order = c.order();
      c.set(order.h12, order.m);
      const served = c.state();
      c.serve();
      // the next order arrives on a 900ms beat; watch for the sweep class rather than
      // guessing when to look
      let sweeping = false;
      for (let i = 0; i < 40; i++) {
        await new Promise(r => setTimeout(r, 50));
        if (c.resetting()) { sweeping = true; break; }
      }
      await new Promise(r => setTimeout(r, 900));
      return { order, served: { h: served.sh12, m: served.sm }, sweeping, after: c.state(), next: c.order() };
    });
    runs.push(r);
  }
  for (const [i, r] of runs.entries()) {
    assert(r.after.sh12 === 12 && r.after.sm === 0,
      `order ${i + 1}: served ${r.served.h}:${String(r.served.m).padStart(2, '0')} → the next order opens at 12:00 (got ${r.after.sh12}:${String(r.after.sm).padStart(2, '0')})`);
  }
  assert(runs.some(r => r.sweeping), 'and the reset is a visible sweep, not an instant jump');
  await page.screenshot({ path: `${SHOTS}/reset-between-orders.png` });
  await ctx.close();
}

console.log('== an overlapping-hands drag moves only the intended hand, 50 trials ==');
{
  const { ctx, page } = await openLevel(2);
  const r = await page.evaluate(async () => {
    const c = window.__clock;
    let handedOff = 0, wrongHand = 0, hourMovedAlone = 0;
    const trials = [];
    for (let t = 0; t < 50; t++) {
      c.set(12, 0);                                   // the two hands exactly on top of each other
      const before = c.state();
      // grab AT the overlap and drag a long way round, sampling the whole gesture
      const target = 30 + (t % 11) * 30;              // a spread of destinations
      const path = [10, 60, 140, 220, target];
      const held = c.dragFrom(0, path);
      const after = c.state();
      if (held !== 'min') wrongHand++;                // the minute hand must win an overlap
      // the grab must not hand off part way: the hand that ended up moving is the held one
      const minMoved = after.minAngle !== before.minAngle;
      const hourMoved = after.hourAngle !== before.hourAngle;
      // A hand-off means the HOUR ended up being dragged instead: the hour NUMBER changes.
      // (The hour hand's angle moving is correct and expected — it tracks the minutes.)
      if (after.sh12 !== before.sh12) handedOff++;
      if (held === 'min' && hourMoved && after.sh12 !== before.sh12) hourMovedAlone++;
      trials.push({ held, minMoved, hourMoved, sh12: after.sh12, sm: after.sm });
    }
    return { wrongHand, handedOff, hourMovedAlone, sample: trials.slice(0, 3) };
  });
  assert(r.wrongHand === 0, `the minute hand wins every overlapping grab (${50 - r.wrongHand}/50)`);
  assert(r.handedOff === 0, `no drag hands off mid-gesture — the hour number never changes under a minute drag (${r.handedOff} did)`);
  assert(r.hourMovedAlone === 0, `and the HOUR number is never changed by a minute drag (${r.hourMovedAlone})`);
  await ctx.close();
}

console.log('== the hour hand still advances proportionally, which is the lesson ==');
{
  const { ctx, page } = await openLevel(2);
  const r = await page.evaluate(() => {
    const c = window.__clock;
    c.set(3, 0);
    const at0 = c.state();
    c.dragMinuteTo(30);
    const at30 = c.state();
    c.dragMinuteTo(45);
    const at45 = c.state();
    return { at0, at30, at45 };
  });
  assert(r.at0.hourAngle === 90, `3 o'clock puts the hour hand exactly on 3 (${r.at0.hourAngle}°)`);
  assert(r.at30.hourAngle === 105, `half past 3 moves it HALF a step on, between 3 and 4 (${r.at30.hourAngle}°)`);
  assert(r.at45.hourAngle === 112.5, `quarter to 4 moves it three quarters (${r.at45.hourAngle}°)`);
  assert(r.at30.sh12 === 3 && r.at45.sh12 === 3, 'without changing which hour it is');
  await ctx.close();
}

console.log('== the half-past rejection now explains itself ==');
{
  const { ctx, page } = await openLevel(1);
  const r = await page.evaluate(async () => {
    const c = window.__clock;
    // find (or wait for) an order that asks for half past
    for (let i = 0; i < 24 && c.order().m !== 30; i++) {
      const o = c.order(); c.set(o.h12, o.m); c.serve();
      await new Promise(r => setTimeout(r, 1300));
    }
    const order = c.order();
    if (order.m !== 30) return { skipped: true };
    c.set(order.h12, 0);                       // hour right, big hand left at the top
    const before = c.state();
    c.serve();
    await new Promise(r => setTimeout(r, 400));
    return { skipped: false, order, before,
      bubble: document.querySelector('.peek-bubble')?.textContent || '',
      stillWrong: JSON.stringify(c.state()) === JSON.stringify(before) };
  });
  assert(!r.skipped, 'a half-past order could be reached');
  if (!r.skipped) {
    // RUN18D's Explanation Standard replaces RUN12 S10's line with the pack's own, which
    // says the same thing and says where the hand IS: HALFWAY between h and h+1.
    assert(/^At half past, the little hand sits HALFWAY between \d{1,2} and \d{1,2} — it's on its way!$/.test(r.bubble),
      `the authored explanation appears verbatim ("${r.bubble}")`);
    assert(r.stillWrong, 'and the pedagogically-correct rejection still stands — it is not simply accepted');
    await page.screenshot({ path: `${SHOTS}/half-past-explanation.png` });
  }
  await ctx.close();
}

console.log('== an ordinary wrong answer keeps the ordinary line ==');
{
  const { ctx, page } = await openLevel(1);
  const r = await page.evaluate(async () => {
    const c = window.__clock;
    const order = c.order();
    c.set(order.h12 === 12 ? 4 : 12, order.m === 0 ? 30 : 0);   // wrong in both hands
    c.serve();
    await new Promise(r => setTimeout(r, 400));
    return document.querySelector('.peek-bubble')?.textContent || '';
  });
  // RUN18D: "Not quite — try again!" taught nothing, on the one screen whose whole subject
  // is which number the little hand points at. The pack's line names it.
  assert(/^Nearly! The little hand points at \d{1,2} for \d{1,2} o'clock\.$/.test(r),
    `a plain miss now says where the little hand should point (got "${r}")`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
