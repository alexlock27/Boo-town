// tests/lib/run14_u0_probe.mjs — RUN14 U0: the playtest audit probe (NOT a board suite;
// lives under tests/lib/ so the board glob never picks it up).
// Drives Boo Roll and Boo Beat headlessly at three viewports, measures the four named
// Boo Roll observations and the four named Boo Beat observations from LIVE play, and
// dumps JSON + frames for tests/run14_audit.md.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8123';
const SHOTS = 'screenshots/run14/u0';
mkdirSync(SHOTS, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const out = { roll: {}, beat: {} };

const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const SAVE = JSON.stringify({
  version: 15, name: 'Ada', ageAsked: true, age: 8,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { booroll: true, beat: true } },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch();
async function open(vp) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown);
  return { ctx, page };
}

// ============ BOO ROLL ============
console.log('== Boo Roll: courses, calibration copy, the fixed-lean run ==');
{
  const { ctx, page } = await open({ width: 1024, height: 768 });
  await page.evaluate(() => window.BooTown.go('booroll'));
  await page.waitForFunction(() => window.__booroll && window.__booroll.onMap && window.__booroll.onMap());
  await page.screenshot({ path: `${SHOTS}/roll-map-1024x768.png` });
  const courses = await page.evaluate(() => window.__booroll.courses());
  out.roll.courses = courses;

  // calibration copy
  await page.evaluate(id => window.__booroll.openCourse(id), courses[0]);
  await page.waitForFunction(() => window.__booroll.calibrating && window.__booroll.calibrating());
  out.roll.calibrationCopy = await page.evaluate(() => [...document.querySelectorAll('.roll-calibrate .roll-tip, .roll-calibrate .btn')].map(n => n.textContent.trim()));
  await page.screenshot({ path: `${SHOTS}/roll-calibrate-1024x768.png` });

  // the fixed-lean run, per course: constant maximum tilt right, never a paddle press
  out.roll.lean = {};
  for (const key of courses) {
    await page.evaluate(() => window.BooTown.go('booroll'));
    await page.waitForFunction(() => window.__booroll.onMap && window.__booroll.onMap());
    await page.evaluate(id => window.__booroll.openCourse(id), key);
    await page.waitForFunction(() => window.__booroll.calibrating && window.__booroll.calibrating());
    await page.evaluate(() => window.__booroll.go('virtual'));
    await page.waitForFunction(() => window.__booroll.playing && window.__booroll.playing());
    await page.evaluate(() => window.__booroll.setTilt(1));   // constant full lean, no paddles
    const t0 = Date.now();
    const trace = [];
    let finished = false, stalled = 0, lastX = -1;
    while (Date.now() - t0 < 90000) {
      const s = await page.evaluate(() => ({ ...window.__booroll.state(), ball: window.__booroll.ball(), world: window.__booroll.field().FW }));
      trace.push({ t: Date.now() - t0, x: Math.round(s.ball.x), bonking: s.bonking });
      if (s.finished) { finished = true; break; }
      if (Math.abs(s.ball.x - lastX) < 1) stalled++; else stalled = 0;
      lastX = s.ball.x;
      if (stalled > 20) break;   // 5s without movement = permanently stuck
      await page.evaluate(() => window.__booroll.setTilt(1));   // keep the lean pinned
      await sleep(250);
    }
    const last = trace[trace.length - 1];
    out.roll.lean[key] = { finished, ms: last.t, progressFrac: +(last.x / (await page.evaluate(() => window.__booroll.field().FW))).toFixed(3), samples: trace.length };
    console.log(`  ${key}: fixed-lean ${finished ? 'FINISHED the course' : 'stopped at ' + (out.roll.lean[key].progressFrac * 100).toFixed(0) + '%'} in ${(last.t / 1000).toFixed(1)}s`);
  }

  // star reachability: roll course 1 with the lean and record per-star closest approach
  await page.evaluate(() => window.BooTown.go('booroll'));
  await page.waitForFunction(() => window.__booroll.onMap && window.__booroll.onMap());
  await page.evaluate(id => window.__booroll.openCourse(id), courses[0]);
  await page.waitForFunction(() => window.__booroll.calibrating());
  await page.evaluate(() => window.__booroll.go('virtual'));
  await page.waitForFunction(() => window.__booroll.playing());
  const starProbe = await page.evaluate(async () => {
    const f = window.__booroll.field();
    const stars = f.course.stars;
    const best = stars.map(() => Infinity);
    const t0 = performance.now();
    window.__booroll.setTilt(1);
    while (performance.now() - t0 < 45000) {
      const b = window.__booroll.ball();
      stars.forEach((st, i) => {
        const d = Math.hypot(b.x - st.x, b.y - (420 + st.y));
        if (d < best[i]) best[i] = d;
      });
      if (window.__booroll.state().finished) break;
      window.__booroll.setTilt(1);
      await new Promise(r => setTimeout(r, 120));
    }
    return { stars, best: best.map(d => Math.round(d)), collected: window.__booroll.state().stars };
  });
  out.roll.starProbe = starProbe;
  // world width vs viewport
  out.roll.world = await page.evaluate(() => window.__booroll.field().FW);
  out.roll.viewportCanvas = 1000;
  await ctx.close();
}

// frames of play at the other two viewports
for (const vp of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  const { ctx, page } = await open(vp);
  await page.evaluate(() => window.BooTown.go('booroll'));
  await page.waitForFunction(() => window.__booroll && window.__booroll.onMap && window.__booroll.onMap());
  const c0 = await page.evaluate(() => window.__booroll.courses()[0]);
  await page.evaluate(id => window.__booroll.openCourse(id), c0);
  await page.waitForFunction(() => window.__booroll.calibrating());
  await page.evaluate(() => window.__booroll.go('virtual'));
  await page.waitForFunction(() => window.__booroll.playing());
  await page.evaluate(() => window.__booroll.setTilt(1));
  await sleep(3000);
  await page.screenshot({ path: `${SHOTS}/roll-play-${vp.width}x${vp.height}.png` });
  await ctx.close();
}

// ============ BOO BEAT ============
console.log('== Boo Beat: density, dead time, window constants ==');
{
  const { ctx, page } = await open({ width: 1024, height: 768 });
  await page.evaluate(() => window.BooTown.go('beat', { resume: { mix: true } }));
  await page.waitForFunction(() => window.__beat);
  await sleep(800);
  await page.screenshot({ path: `${SHOTS}/beat-play-1024x768.png` });
  // sample the field every 100ms for 40s: when is there ANYTHING tappable?
  const density = await page.evaluate(async () => {
    const t0 = performance.now();
    let samples = 0, withNotes = 0, atLine = 0;
    const spawnTimes = [];
    let lastCount = 0;
    while (performance.now() - t0 < 40000) {
      const st = window.__beat.state();
      samples++;
      if (st.notes > 0) withNotes++;
      if (document.querySelector('.beat-note.at-line')) atLine++;
      if (st.notes > 0 && lastCount === 0) spawnTimes.push(Math.round(performance.now() - t0));
      lastCount = st.notes;
      // play like a decent kid: tap the correct lane whenever a note is at the line
      if (document.querySelector('.beat-note.at-line') && !st.resolving) window.__beat.tapCorrect('good');
      await new Promise(r => setTimeout(r, 100));
    }
    return { samples, withNotes, atLine, spawnTimes, state: window.__beat.state() };
  });
  out.beat.density = {
    pctTimeWithNotes: +(density.withNotes / density.samples * 100).toFixed(1),
    pctTimeTappable: +(density.atLine / density.samples * 100).toFixed(1),
    noteTrioSpawns: density.spawnTimes.length,
    spawnGapsMs: density.spawnTimes.slice(1).map((t, i) => t - density.spawnTimes[i]),
    over: density.state
  };
  console.log(`  notes on screen ${out.beat.density.pctTimeWithNotes}% of the time; tappable ${out.beat.density.pctTimeTappable}%; ${density.spawnTimes.length} trios in 40s`);
  // the judged window constants, read from source (the audit cites the code)
  const src = await page.evaluate(async () => (await fetch('js/games/beat.js')).text());
  out.beat.constants = {
    PERFECT_MS: (src.match(/PERFECT_MS = (\d+)/) || [])[1],
    GOOD_MS: (src.match(/GOOD_MS = (\d+)/) || [])[1],
    silentReject: /if \(errMs > GOOD_MS\) return;/.test(src)
  };
  await ctx.close();
}
// beat at phone: the three lanes + question card
{
  const { ctx, page } = await open({ width: 390, height: 844 });
  await page.evaluate(() => window.BooTown.go('beat', { resume: { mix: true } }));
  await page.waitForFunction(() => window.__beat);
  await sleep(2500);
  await page.screenshot({ path: `${SHOTS}/beat-play-390x844.png` });
  await ctx.close();
}

await browser.close();
writeFileSync(`${SHOTS}/probe.json`, JSON.stringify(out, null, 2));
console.log('probe.json written');
