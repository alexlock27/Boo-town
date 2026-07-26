// @serial — audio-timing: the round's scheduling, groove density and judge windows are all
// measured against real clocks (runs alone at the board's end; RUN14 U-0)
// tests/r14u2-beat.mjs — RUN14 U2: Boo Beat 2.0, "make it music".
//
// U0 measured the old game: something was tappable for 13.2% of a round, questions arrived
// once every ~4s with 3.5-4.5s of dead air between them, and a press outside ±160ms was
// SILENTLY IGNORED. This suite proves the rebuild on every one of those counts:
//   • notes flow on the beat throughout (tap-along notes, any lane) — the hands are busy;
//   • a QUESTION TRIO every four bars, its card one bar ahead for reading time;
//   • the music NEVER pauses — not for a question, not for a wrong answer, not for a miss;
//   • the judged window is generous, honest and INSTRUMENTED (nothing silently ignored);
//   • difficulty rises through music, never by shortening thinking time;
//   • steady mode measurably differs; reduced motion calms the visuals, not the timing.
//
// Expected runtime: ~75s (three ~20s live-round observations under real clocks).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = 'screenshots/run14/u2';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };

const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery','boohouse_kitchen','boohouse_bedroom'];
const SAVE = JSON.stringify({
  version: 16, name: 'Ada', ageAsked: true, age: 8,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { beat: true } },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch();
async function open({ vp = { width: 1024, height: 768 }, reduced = false, resume = { mix: true } } = {}) {
  const ctx = await browser.newContext({ viewport: vp, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown);
  await page.evaluate(r => window.BooTown.go('beat', { resume: r }), resume);
  await page.waitForFunction(() => window.__beat, null, { timeout: 8000 });
  await page.waitForTimeout(700);
  return { ctx, page };
}

console.log('== the hands are busy: notes flow on the beat throughout ==');
{
  const { ctx, page } = await open();
  const d = await page.evaluate(async () => {
    const t0 = performance.now();
    let samples = 0, tappable = 0, onScreen = 0, longestGap = 0, lastAt = null;
    while (performance.now() - t0 < 20000) {
      samples++;
      const atLine = document.querySelectorAll('.beat-note.at-line').length;
      // Measured from the FIRST tappable moment: the opening bars are a count-in (the
      // music starts, the first notes are still falling), not dead air inside the round.
      if (atLine) { if (lastAt != null) longestGap = Math.max(longestGap, performance.now() - lastAt); lastAt = performance.now(); }
      if (document.querySelectorAll('.beat-note').length) onScreen++;
      if (atLine) tappable++;
      await new Promise(r => setTimeout(r, 50));
    }
    return { samples, tappable, onScreen, longestGap: Math.round(longestGap), taps: window.__beat.tapsOnScreen() };
  });
  const pctTappable = d.tappable / d.samples * 100;
  ok(pctTappable > 50, `something is tappable ${pctTappable.toFixed(1)}% of the round (U0 measured the old game at 13.2%)`);
  ok(d.onScreen / d.samples > 0.98, `notes are on screen ${(d.onScreen / d.samples * 100).toFixed(0)}% of the time`);
  ok(d.longestGap < 1500, `the longest gap with nothing to hit is ${d.longestGap}ms (U0 measured 3.5-4.5s of dead air per phrase)`);
  ok(d.taps > 0, `tap-along notes are live on the field (${d.taps} right now)`);
  await page.screenshot({ path: `${SHOTS}/beat-groove-1024x768.png` });
  await ctx.close();
}

console.log('== a QUESTION TRIO every four bars, its card a bar ahead ==');
{
  const { ctx, page } = await open();
  const K = await page.evaluate(() => window.__beat.constants());
  ok(K.BARS_PER_QUESTION === 4, `questions arrive every ${K.BARS_PER_QUESTION} bars (authored: four)`);
  ok(K.QUESTION_LEAD_BARS === 1, `the card appears ${K.QUESTION_LEAD_BARS} bar ahead — reading time`);
  const arrivals = await page.evaluate(async () => {
    const seen = [];
    const t0 = performance.now();
    let last = null;
    while (performance.now() - t0 < 22000) {
      const a = window.__beat.questionArrival();
      if (a != null && a !== last) { seen.push(a); last = a; }
      // answer correctly so the round advances the way a competent child would
      const st = window.__beat.state();
      if (!st.resolving && document.querySelector('.beat-note:not(.tapalong).at-line')) window.__beat.tapCorrect('good');
      await new Promise(r => setTimeout(r, 60));
    }
    return seen;
  });
  const gaps = arrivals.slice(1).map((a, i) => a - arrivals[i]).filter(g => g > 0);
  const period = K.BARS_PER_QUESTION * K.BEATS_PER_BAR;
  ok(arrivals.length >= 3, `saw ${arrivals.length} question trios scheduled in 22s`);
  ok(gaps.length > 0 && gaps.every(g => Math.abs(g % period) < 0.001),
    `each trio lands a whole phrase later — every ${period} beats (gaps: ${gaps.map(g => g.toFixed(0)).join(', ')})`);
  ok(arrivals.every(a => Math.abs(a % K.BEATS_PER_BAR) < 0.001), 'and always on a bar downbeat');
  await ctx.close();
}

console.log('== the music NEVER stops: not for a question, a wrong answer, or a miss ==');
{
  const { ctx, page } = await open();
  const r = await page.evaluate(async () => {
    const checks = [];
    const running = () => window.__beat.musicRunning();
    checks.push(['at the start', running()]);
    // a WRONG answer
    window.__beat.tapWrong();
    await new Promise(r => setTimeout(r, 400));
    checks.push(['right after a wrong answer', running()]);
    // a MISS
    window.__beat.missNow();
    await new Promise(r => setTimeout(r, 400));
    checks.push(['right after a missed question', running()]);
    // …and across a stretch that contains a question boundary
    let everStopped = false;
    const t0 = performance.now();
    while (performance.now() - t0 < 6000) {
      if (!running()) everStopped = true;
      await new Promise(r => setTimeout(r, 50));
    }
    checks.push(['across six seconds of play', !everStopped]);
    return checks;
  });
  for (const [when, alive] of r) ok(alive, `the backing is still playing ${when}`);
  await ctx.close();
}

console.log('== the judge is generous, honest and instrumented ==');
{
  const { ctx, page } = await open();
  const K = await page.evaluate(() => window.__beat.constants());
  ok(K.GOOD_MS >= 220, `the judged window is ±${K.GOOD_MS}ms (U0 measured the old game at ±160)`);
  ok(K.NEAR_MS > K.GOOD_MS, `and presses out to ±${K.NEAR_MS}ms still get an answer`);
  // a press well outside the window is ACKNOWLEDGED, never silently dropped
  const before = await page.evaluate(() => window.__beat.judgeLog().length);
  await page.evaluate(() => window.__beat.tapLane(0));
  await page.evaluate(() => window.__beat.tapLane(1));
  const log = await page.evaluate(() => window.__beat.judgeLog());
  ok(log.length >= before + 2, `every press is logged and judged (${log.length - before} new entries)`);
  ok(log.slice(-2).every(e => e.grade !== undefined), 'each carries a verdict — nothing is silently ignored');
  // the sweep: the boundaries are where the constants say
  const sweep = await page.evaluate(async () => {
    const out = [];
    const K = window.__beat.constants();
    for (const target of [-300, -200, -80, 0, 80, 200, 300]) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const taps = window.__beat.taps().filter(t => !t.judged);
        const beat = window.__beat.beat();
        const t = taps.find(x => (x.arrival - beat) * K.beatMs > target + 140);
        if (!t) { await new Promise(r => setTimeout(r, 40)); continue; }
        await new Promise(r => setTimeout(r, Math.max(0, (t.arrival - beat) * K.beatMs + target)));
        const n = window.__beat.judgeLog().length;
        window.__beat.tapLane(t.lane);
        const l = window.__beat.judgeLog();
        if (l.length > n) { out.push({ target, ...l[l.length - 1] }); break; }
      }
    }
    return out;
  });
  // Judge the invariant against the MEASURED error, never the aimed offset. A scripted
  // tap cannot land exactly where it aims — under board load the scheduler drifts tens of
  // milliseconds — so asserting "a tap aimed at 300ms is graded near" is really asserting
  // the scheduler's accuracy. The grade is a pure function of the measured error, and THAT
  // is the contract worth defending.
  const graded = sweep.filter(s => s.errMs != null);
  ok(graded.length >= 5, `swept ${graded.length} judged presses across the window`);
  const wrong = graded.filter(s => {
    const e = Math.abs(s.errMs);
    const want = e <= K.PERFECT_MS ? 'perfect' : e <= K.GOOD_MS ? 'good' : 'near';
    return s.grade !== want;
  });
  ok(wrong.length === 0,
    `every verdict matches its measured error${wrong.length ? ' → ' + wrong.map(w => `${w.errMs}ms graded ${w.grade}`).join(', ') : ''}`);
  ok(graded.some(s => Math.abs(s.errMs) <= K.PERFECT_MS && s.grade === 'perfect'), 'a press on the line is Perfect');
  ok(graded.some(s => Math.abs(s.errMs) > K.PERFECT_MS && Math.abs(s.errMs) <= K.GOOD_MS && s.grade === 'good'),
    'a press inside the window still counts as a hit');
  const outside = graded.filter(s => Math.abs(s.errMs) > K.GOOD_MS);
  ok(outside.length > 0 && outside.every(s => s.grade === 'near'),
    `and a press OUTSIDE it is answered as "so close", never ignored (${outside.length} sampled)`);
  await ctx.close();
}

console.log('== the hit zone is a PLACE: the band matches the real window ==');
{
  const { ctx, page } = await open();
  const z = await page.evaluate(() => {
    const zone = document.querySelector('.beat-hitzone'), line = document.querySelector('.beat-hitline');
    const field = document.querySelector('.beat-field');
    const K = window.__beat.constants();
    const zr = zone.getBoundingClientRect(), lr = line.getBoundingClientRect(), fr = field.getBoundingClientRect();
    const perBeat = (fr.height - 70) / K.FALL;
    return { zoneH: zr.height, expected: 2 * (K.GOOD_MS / K.beatMs) * perBeat,
      centred: Math.abs((zr.top + zr.height / 2) - (lr.top + lr.height / 2)) < 6, visible: zr.height > 10 };
  });
  ok(z.visible, `the hit zone is a visible band (${Math.round(z.zoneH)}px)`);
  ok(Math.abs(z.zoneH - z.expected) < 6, `its height IS the judged window (${Math.round(z.zoneH)}px vs ${Math.round(z.expected)}px)`);
  ok(z.centred, 'and it is centred on the hit line');
  await ctx.close();
}

console.log('== difficulty rises through MUSIC, never by shortening thinking time ==');
{
  const perLevel = {};
  for (const level of [1, 2, 3]) {
    const { ctx, page } = await open({ resume: { cat: 'tables', level } });
    perLevel[level] = await page.evaluate(() => window.__beat.constants());
    await ctx.close();
  }
  ok(perLevel[1].tapAlongPerBar < perLevel[3].tapAlongPerBar,
    `harder levels add groove notes (${perLevel[1].tapAlongPerBar} → ${perLevel[3].tapAlongPerBar} per bar)`);
  ok(perLevel[1].QUESTION_LEAD_BARS === perLevel[3].QUESTION_LEAD_BARS,
    `the reading lead is IDENTICAL at every level (${perLevel[1].QUESTION_LEAD_BARS} bar)`);
  ok(perLevel[1].GOOD_MS === perLevel[3].GOOD_MS && perLevel[1].FALL === perLevel[3].FALL,
    `and so are the judged window (${perLevel[1].GOOD_MS}ms) and the fall time (${perLevel[1].FALL} beats)`);
  ok(perLevel[1].BARS_PER_QUESTION === perLevel[3].BARS_PER_QUESTION,
    'and the question cadence — nothing about thinking time changes with difficulty');
}

console.log('== steady mode measurably differs ==');
{
  const { ctx, page } = await open({ resume: { cat: 'tables', level: 2 } });
  const normal = await page.evaluate(() => window.__beat.constants());
  await ctx.close();
  const s = await open({ resume: { cat: 'tables', level: 2 } });
  await s.page.evaluate(() => { window.BooTown.State.mutate(st => { st.seen.beatSteady = true; }); });
  await s.page.evaluate(() => window.BooTown.go('beat', { resume: { cat: 'tables', level: 2 } }));
  await s.page.waitForFunction(() => window.__beat && window.__beat.steady());
  await s.page.waitForTimeout(500);
  const steady = await s.page.evaluate(() => window.__beat.constants());
  ok(await s.page.evaluate(() => window.__beat.steady()) === true, 'steady mode is on');
  ok(steady.beatMs > normal.beatMs * 1.2, `steady plays the Hit slower (${Math.round(normal.beatMs)}ms → ${Math.round(steady.beatMs)}ms per beat)`);
  ok(steady.tapAlongPerBar < normal.tapAlongPerBar, `and thins the groove (${normal.tapAlongPerBar} → ${steady.tapAlongPerBar} per bar)`);
  await s.ctx.close();
}

console.log('== reduced motion calms the visuals without touching the timing ==');
{
  const { ctx, page } = await open({ reduced: true });
  const r = await page.evaluate(() => {
    const K = window.__beat.constants();
    const anims = ['.beat-road', '.beat-character'].map(sel => {
      const n = document.querySelector(sel);
      return n ? getComputedStyle(n).animationName : 'missing';
    });
    return { K, anims };
  });
  ok(r.anims.every(a => a === 'none' || a === 'missing'), `lane visuals are stilled (${r.anims.join(', ')})`);
  ok(r.K.GOOD_MS === 220 && r.K.FALL === 4, 'and the judged window and fall time are untouched');
  await ctx.close();
}

console.log('== every lane is legible and tappable at 390x844 ==');
{
  const { ctx, page } = await open({ vp: { width: 390, height: 844 } });
  await page.waitForTimeout(1200);
  const lanes = await page.evaluate(() => [...document.querySelectorAll('.beat-lane')].map(l => {
    const r = l.getBoundingClientRect();
    return { w: Math.round(r.width), inView: r.left >= -1 && r.right <= innerWidth + 1, lane: l.dataset.lane };
  }));
  ok(lanes.length === 3 && lanes.every(l => l.inView && l.w > 60), `all three lanes fit the phone (${lanes.map(l => l.w + 'px').join(', ')})`);
  ok(lanes.every(l => l.lane != null), 'each lane declares its own index (the RUN12 S4 fix holds)');
  await page.screenshot({ path: `${SHOTS}/beat-390x844.png` });
  await ctx.close();
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
