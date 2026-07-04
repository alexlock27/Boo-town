// tests/p8-frames.mjs — EXPANSION_2 frames: Teach Me + Boo Dash (RUN2 phase 8).
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
const SAVE = JSON.stringify({ version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, settings: { sound: false, music: false, voice: false }, seen: {} });
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate((s) => localStorage.setItem('bootown.save.v1', s), SAVE);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');

// ---- Teach Me: 6 lessons exist; a lesson plays to 3 stars; a slip -> 2 stars ----
console.log('== Teach Me ==');
const lessonCount = await page.evaluate(async () => (await import('./data/lessons.js')).LESSONS.length);
assert(lessonCount === 6, 'six lessons at launch (' + lessonCount + ')');

async function playLesson(name, mode) {
  await page.evaluate(() => window.BooTown.go('teachme'));
  await page.waitForSelector('.lesson-grid');
  await page.click(`.lesson-card:has-text("${name}")`);
  await page.waitForSelector('.tm-stage');
  const before = await page.evaluate(() => window.BooTown.State.getState().stars.byGame.teachme.plays);
  const res = await page.evaluate(async (mode) => {
    const T = window.__teachme; const sleep = ms => new Promise(r => setTimeout(r, ms));
    let g = 0, checksSeen = 0, sawVisual = false, sawWorked = false, backAfterWrong = false;
    while (!T.ended() && g++ < 80) {
      const c = T.card();
      if (c.type === 'visual') sawVisual = true;
      if (c.type === 'workedStep') sawWorked = true;
      if (c.type === 'check') {
        checksSeen++;
        if (mode === 'slip' && checksSeen === 1 && T.state().slips === 0) {
          T.answer(false); await sleep(850);   // route-back fires ~700ms after a wrong answer
          if (T.card().type !== 'check') backAfterWrong = true;
          // now tap through back to the check and answer correctly (re-ask)
          let h = 0; while (T.card().type !== 'check' && h++ < 10) { T.tapNext(); await sleep(60); }
          T.answer(true);
        } else T.answer(true);
      } else T.tapNext();
      await sleep(70);
    }
    return { ...T.state(), sawVisual, sawWorked, backAfterWrong };
  }, mode);
  await page.waitForSelector('.result-card', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(200);
  const after = await page.evaluate(() => window.BooTown.State.getState().stars.byGame.teachme);
  return { res, plays: after.plays, before, best: after.best };
}
const clean = await playLesson('Telling the time', 'clean');
assert(clean.res.ended && clean.res.sawVisual && clean.res.sawWorked, 'lesson plays through talk/visual/worked/check to the end');
assert(clean.res.slips === 0, 'clean run has 0 slips (3 stars)');
assert(clean.plays === clean.before + 1, 'teachme play recorded (feeds the meter)');
const slip = await playLesson('Jumping over ten', 'slip');
assert(slip.res.backAfterWrong, 'a wrong check routes back to an explanation card, then re-asks');
assert(slip.res.slips === 1, 'one slip recorded -> 2 stars');

// ---- Boo Dash: completable + 3-starrable + bonk path + pause when hidden ----
console.log('== Boo Dash ==');
async function enterDash() {
  await page.evaluate(() => window.BooTown.go('dash'));
  await page.waitForSelector('.picker');
  await page.click('.picker-levels .level-btn'); // tables default
  await page.waitForSelector('.dash-track'); await page.waitForTimeout(150);
}
await enterDash();
const beforeDash = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { plays: s.stars.byGame.dash.plays, total: s.stars.total }; });
const dashClean = await page.evaluate(async () => {
  const D = window.__dash; const sleep = ms => new Promise(r => setTimeout(r, ms));
  let g = 0;
  while (!D.ended() && g++ < 250) { D.tap(true); await sleep(90); }  // tap() no-ops while locked
  return D.state();
});
assert(dashClean.ended && dashClean.gate >= 12, 'Boo Dash completes all 12 gates (gate ' + dashClean.gate + ')');
assert(dashClean.bonks === 0, 'a clean run has 0 bonks -> 3 stars');
await page.waitForSelector('.result-card', { timeout: 4000 });
await page.waitForTimeout(2200);
assert(await page.$$eval('.rstar.pop', e => e.length) === 3, 'clean run shows 3 stars');
await page.click('.result-btns .btn.soft'); await page.waitForSelector('.hub');
const afterDash = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { plays: s.stars.byGame.dash.plays, total: s.stars.total }; });
assert(afterDash.plays === beforeDash.plays + 1 && afterDash.total > beforeDash.total, 'dash play recorded + feeds the meter');

// bonk path: a wrong gate bonks, same fact stays, hearts never end (bonks tracked).
// (run-up-and-wait: taps only land while WAITING at the gates, so wait for that phase.)
await enterDash();
const bonkTest = await page.evaluate(async () => {
  const D = window.__dash; const sleep = ms => new Promise(r => setTimeout(r, ms));
  let g = 0; while (D.state().phase !== 'wait' && g++ < 40) await sleep(100);
  const heartsBefore = document.querySelectorAll('.heart-ic.on').length;
  const q0 = D.correct();
  D.tap(false); await sleep(250);   // wrong gate
  const st = D.state();
  const heartsAfter = document.querySelectorAll('.heart-ic.on').length;
  const sameFact = D.correct() === q0;   // the same question stays
  return { bonks: st.bonks, gate: st.gate, sameFact, heartsBefore, heartsAfter, phase: st.phase };
});
assert(bonkTest.bonks === 1 && bonkTest.gate === 0, 'a wrong arch is a soft bonk that does not advance the gate');
assert(bonkTest.heartsAfter === bonkTest.heartsBefore - 1, 'a wrong tap dims a heart (' + bonkTest.heartsBefore + ' -> ' + bonkTest.heartsAfter + ')');
assert(bonkTest.phase === 'wait', 'after a bonk the world stays stopped at the same gates');
assert(bonkTest.sameFact, 'the same fact re-approaches after a bonk');

// pause when hidden: nothing advances while hidden
const paused = await page.evaluate(async () => {
  const D = window.__dash; const sleep = ms => new Promise(r => setTimeout(r, ms));
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  document.dispatchEvent(new Event('visibilitychange'));
  const g0 = D.state().gate; await sleep(400); return g0 === D.state().gate;
});
assert(paused, 'nothing advances while hidden (turn-based, tap-driven)');

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
