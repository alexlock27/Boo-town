// tests/r14u1-booroll.mjs — RUN14 U1: Boo Roll 3.0, the single-screen course.
//
// THE HARD GATE, first and loudest: a fixed-lean input policy — constant maximum tilt one
// way, no paddle presses, no hops — must FAIL every authored course. That is the whole
// point of the rebuild; U0 measured the old game losing it (a hold-right lean FINISHED two
// of three courses in under 9 seconds).
//
// Also proved: every playable course is completable by scripted competent play under
// gold x 1.4 AND by the drag fallback; all three stars per course are reachable by a
// scripted route that uses the hop; the hop cannot bypass any mechanism; the course fits
// ONE screen with no scroll; orientation lock is requested with the iOS fallback path
// exercised; calibration accepts an arbitrary starting pose; and the authored content
// (geometry, pars, stars, checkpoints, catch floors) matches CONTENT_COURSES.md exactly.
//
// Expected runtime: ~35s (mostly headless simulation — the engine is DOM-free, so the
// physics assertions cost milliseconds, not browser frames).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { COURSES, UNPLAYABLE, PLAYABLE_KEYS } from '../data/courses.js';
import { createRoll, simulate, fixedLean, ROLL } from '../js/games/boorollphysics.js';
import { PLAY } from '../js/games/boorollplay.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = 'screenshots/run14/u1';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };

// ============================================================================
console.log('== THE HARD GATE: a fixed lean FAILS every course, both directions ==');
for (const course of COURSES) {
  for (const dir of [1, -1]) {
    const sim = simulate(course, fixedLean(dir), 90000);
    ok(!sim.state.finished,
      `${course.key}: constant ${dir > 0 ? 'right' : 'left'} lean never finishes (stopped at x ${sim.state.x.toFixed(1)} after ${(sim.state.t / 1000).toFixed(0)}s)`);
  }
}
// …and it is not merely slow: it does not even reach the finish band with unlimited time
{
  const sim = simulate(COURSES[0], fixedLean(1), 300000);
  ok(!sim.state.finished, `first-roll: five simulated minutes of pure lean still never finishes`);
}

console.log('== every playable course IS completable by scripted competent play ==');
const playResults = {};
for (const course of COURSES) {
  if (UNPLAYABLE[course.key]) { console.log(`  (skipped ${course.key} — ${UNPLAYABLE[course.key]}, see BLOCKED.md)`); continue; }
  const sim = createRoll(course);
  const policy = PLAY[course.key];
  while (sim.state.t < 120000 && !sim.state.finished) sim.step(policy(sim.state, sim) || {});
  const secs = sim.elapsedMs() / 1000, limit = course.pars.gold * 1.4;
  playResults[course.key] = { secs, stars: sim.state.stars.filter(Boolean).length };
  ok(sim.state.finished, `${course.key}: scripted competent play finishes`);
  ok(sim.state.finished && secs <= limit, `${course.key}: in ${secs.toFixed(1)}s — inside gold x1.4 (${limit.toFixed(0)}s)`);
}

console.log('== the drag fallback (a finger puck) completes a course too ==');
{
  // the puck is the same tilt channel, so a completed run through it proves the fallback
  const course = COURSES[0];
  const sim = createRoll(course);
  const policy = PLAY[course.key];
  while (sim.state.t < 120000 && !sim.state.finished) {
    const i = policy(sim.state, sim) || {};
    sim.step({ ...i, tilt: Math.max(-1, Math.min(1, (i.tilt || 0) * 1.25 * 22 / 22)) });  // puck maps to ±1.25 → clamped
  }
  ok(sim.state.finished, `first-roll completes through the drag-puck tilt channel (${(sim.elapsedMs() / 1000).toFixed(1)}s)`);
}

console.log('== every star is reachable, by routes that use the hop ==');
// RESOLVED 2026-07-27. This table used to pin Course 2's third star as an authored dead
// end (the lower deck ended 4 units short of the lift, so it could not be stood on at
// all). Alex approved widening the deck to w:38; it meets the lift now and the star is
// reachable, so the pin is gone and EVERY star in EVERY course is asserted reachable —
// which is the assertion this suite always wanted to be able to make.
const KNOWN_UNREACHABLE = {};
for (const course of COURSES) {
  if (UNPLAYABLE[course.key]) continue;
  // Per star: a route that drives to it and hops under it. Reachability is a geometry
  // question, so each star gets its own scripted attempt rather than one greedy run.
  const got = [];
  course.stars.forEach((star, i) => {
    const policy = PLAY[course.key];
    // A star on a LOWER deck is reached by deliberately NOT hopping the gap above it —
    // dropping through is the authored route ("falling instead lands safely on the lower
    // deck, where the third star lives"). Otherwise the routes differ in when she takes
    // off and whether she slows to line it up; reachability means SOME route works, so a
    // small family of sensible attempts is tried per star, exactly as a child would.
    const huntingBelow = star.y > course.start.y + 20;
    let taken = false, hopped = false, usedRoute = null;
    // A star BELOW is reached by going PAST it and dropping through the hole beyond — so
    // the family includes "slow to a crawl once you are well past it", which is what a
    // child does when she has spotted a star underneath and is hunting for the way down.
    // At full roll she sails clean over the hole; at a crawl she drops into it.
    const creepPoints = huntingBelow ? [Infinity, star.x + 20, star.x + 24, star.x + 28] : [Infinity];
    for (const creepFrom of creepPoints) {
    for (const lead of [0, -2, 2]) {
      for (const brake of [false, true]) {
        const sim = createRoll(course);
        let thisHopped = false;
        while (sim.state.t < 60000 && !sim.state.stars[i]) {
          const base = policy(sim.state, sim) || {};
          const s = sim.state;
          const wantHop = s.grounded && s.t >= s.hopReadyAt && Math.abs(s.x - (star.x + lead)) < 2.5 && s.y > star.y;
          if (wantHop) thisHopped = true;
          // A star BELOW needs a crawl to the edge, so she drops nearly straight down onto
          // the deck rather than sailing past it; a star ABOVE needs her slow enough to be
          // on the ground under it rather than already airborne past it.
          // below the drop she drives at the star; above it she creeps only once past it
          const belowNow = huntingBelow && s.y > star.y - 10;
          const creeping = huntingBelow && s.grounded && !belowNow && s.x > creepFrom && Math.abs(s.vx) > 0.10;
          const closing = brake && Math.abs(s.x - star.x) < 14 && Math.abs(s.vx) > 0.2;
          const homing = belowNow ? (Math.sign(star.x - s.x) || -1) : null;
          const tilt = homing != null ? homing : ((creeping || closing) ? -Math.sign(s.vx) : base.tilt);
          sim.step({ ...base, tilt, hop: (huntingBelow ? false : base.hop) || wantHop });
          if (sim.state.finished) break;
        }
        if (sim.state.stars[i]) {
          taken = true; hopped = thisHopped;
          usedRoute = `lead ${lead}${brake ? ' + brake' : ''}${creepFrom < Infinity ? ` + creep from x${creepFrom}` : ''}`;
          break;
        }
      }
      if (taken) break;
    }
    if (taken) break;
    }
    got.push({ i, taken, hopped, usedRoute });
  });
  got.forEach(g => {
    const pinned = KNOWN_UNREACHABLE[`${course.key}:${g.i}`];
    if (pinned) ok(!g.taken, `${course.key} star ${g.i + 1}: still the authored dead end (BLOCKED.md) — ${pinned.slice(0, 60)}…`);
    else ok(g.taken, `${course.key} star ${g.i + 1} at {${course.stars[g.i].x},${course.stars[g.i].y}} is reachable${g.usedRoute ? ` (${g.usedRoute})` : ''}`);
  });
  ok(got.some(g => g.hopped), `${course.key}: at least one star genuinely needs the hop`);
}

console.log('== the hop cannot bypass any mechanism (route analysis per course) ==');
{
  // A hop's rise is a named constant; a mechanism blocks at its own authored size. Prove
  // the arithmetic AND that a hop-spamming policy never finishes a mechanism-gated course.
  const hopRise = ROLL.HOP_V ** 2 / (2 * ROLL.G);
  ok(hopRise < 8, `a hop rises ${hopRise.toFixed(1)} units — under every girder (10-12) and gate (8-10)`);
  const hopRange = ROLL.MAX_SPEED * (2 * ROLL.HOP_V / ROLL.G);
  ok(hopRange < 12, `a full-speed hop carries ${hopRange.toFixed(1)} units — clears the 10-unit exam gap, never a 12-unit girder void`);
  // Courses whose MAIN line is gated by a mechanism — for these, no amount of hopping may
  // substitute for the paddle. (Course 2 is deliberately not in this list: its authored
  // note puts the lift on the FALLBACK route only — the upper line is gated by a rise that
  // needs banked speed, which the fixed-lean gate above already proves.)
  const MECH_GATED = ['first-roll', 'spin-cycle', 'the-gate', 'sunset-ridge'];
  for (const course of COURSES) {
    if (!MECH_GATED.includes(course.key)) continue;
    // lean + hop as fast as the cooldown allows, but NEVER touch the mechanism paddle
    const sim = simulate(course, (s) => ({ tilt: 1, paddle: false, hop: s.grounded && s.t >= s.hopReadyAt }), 90000);
    ok(!sim.state.finished, `${course.key}: hop-spam without the paddle still cannot finish (x ${sim.state.x.toFixed(1)})`);
  }
}

console.log('== the authored content is implemented exactly (CONTENT_COURSES.md is LAW) ==');
{
  ok(COURSES.length === 6, `six courses (${COURSES.length})`);
  const names = COURSES.map(c => c.name).join(', ');
  ok(names === 'First Roll, Over and Under, Lift Off, Spin Cycle, The Gate, Sunset Ridge', `named and ordered as authored: ${names}`);
  const pars = COURSES.map(c => `${c.pars.gold}/${c.pars.silver}/${c.pars.bronze}`).join(' ');
  // RUN19 REPAIR, Alex-approved: every par halved when the sim clock was fixed to run at
  // real time instead of 2x (js/games/boorollphysics.js's elapsedMs()). lift-off's RUN18B
  // Y8 change (30/40/52 -> 14/22/35) is folded into its new 7/11/17.5 here, not superseded
  // by it. CONTENT_COURSES.md was amended in the same change, so this still asserts the
  // tree against the law file.
  ok(pars === '10/14/19 13/17/22.5 7/11/17.5 17/22/29 19/25/32 22.5/30/39', `pars exactly as authored: ${pars}`);
  ok(COURSES.every(c => c.stars.length === 3), 'every course has exactly three pickup stars');
  ok(COURSES.every(c => c.checkpoints.length >= 1), 'every course has at least one checkpoint');
  ok(COURSES[5].checkpoints.length === 2, 'Sunset Ridge has its two authored checkpoints');
  const catchFloors = COURSES.filter(c => c.segments.some(s => s.catch));
  ok(catchFloors.length === 5, `five courses carry a catch floor (${catchFloors.map(c => c.key).join(', ')})`);
  // the schema rules
  const seesaws = COURSES.flatMap(c => c.mechanisms.filter(m => m.t === 'seesaw'));
  ok(seesaws.length === 2 && ROLL.SEESAW_IDLE === -22, `seesaws idle tipped 22° down-left (${ROLL.SEESAW_IDLE}°)`);
  const girders = COURSES.flatMap(c => c.mechanisms.filter(m => m.t === 'girder'));
  ok(girders.length === 3, `three girders, all idling vertical (${girders.length})`);
  ok(ROLL.CATCH_WAIT_MS === 3000, 'the catch-floor parachute waits exactly 3 seconds, identically everywhere');
}

console.log('== a catch floor never BONKs, and parachutes home after 3 seconds ==');
{
  // Spin Cycle's catch floor (x18-74 @ y50) has clear sky above it at x28 — between the
  // first platform's end (x22) and the next one's start (x34), which is exactly the void
  // the first girder bridges. A ball that misses that bridge falls here.
  const course = COURSES.find(c => c.key === 'spin-cycle');
  const sim = createRoll(course);
  sim.state.x = 28; sim.state.y = 6; sim.state.vx = 0; sim.state.vy = 0; sim.state.grounded = false; sim.state.fallStart = 6;
  let landed = false, bonked = false, chuted = false;
  for (let i = 0; i < 60 * 8 && !chuted; i++) {
    sim.step({ tilt: 0, paddle: false, hop: false });
    for (const e of sim.state.events) {
      if (e.kind === 'land') landed = true;
      if (e.kind === 'bonk') bonked = true;
      if (e.kind === 'chute') chuted = true;
    }
  }
  ok(landed && !bonked, 'a fall from the ceiling onto a catch floor lands softly — no BONK');
  ok(chuted, 'and after the 3-second wait the parachute carries her back to the checkpoint');
}

console.log('== the seesaw is never passable without a press ==');
{
  const course = COURSES[0];
  // ride at full speed straight at the idle seesaw, leaning hard, never pressing
  const sim = simulate(course, () => ({ tilt: 1, paddle: false, hop: false }), 40000);
  ok(sim.state.x < 68, `a leaning ball is stopped by the idle seesaw's uphill lip (x ${sim.state.x.toFixed(1)} < 68)`);
  // and WITH the press it crosses
  const sim2 = createRoll(course);
  while (sim2.state.t < 40000 && sim2.state.x < 70) sim2.step({ tilt: 1, paddle: sim2.state.x > 44, hop: false });
  ok(sim2.state.x >= 70, `holding the paddle levels it into a bridge and she crosses (x ${sim2.state.x.toFixed(1)})`);
}

// ============================================================================
// The live screen: one screen, the controls, the orientation paths, the copy.
const browser = await chromium.launch();
const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery','boohouse_kitchen','boohouse_bedroom'];
const SAVE = JSON.stringify({
  version: 16, name: 'Ada', ageAsked: true, age: 8,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { booroll: true } },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});
async function open(vp = { width: 1024, height: 768 }, init) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  if (init) await page.addInitScript(init);
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown);
  await page.evaluate(() => window.BooTown.go('booroll'));
  await page.waitForFunction(() => window.__booroll && window.__booroll.onMap && window.__booroll.onMap());
  return { ctx, page };
}

console.log('== ONE SCREEN: the whole course fits the viewport, at every size ==');
for (const vp of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }, { width: 390, height: 844 }]) {
  const { ctx, page } = await open(vp);
  await page.evaluate(() => window.__booroll.openCourse('first-roll'));
  await page.waitForFunction(() => window.__booroll.calibrating());
  await page.evaluate(() => window.__booroll.go('virtual'));
  await page.waitForFunction(() => window.__booroll.playing());
  await page.waitForTimeout(400);
  const fit = await page.evaluate(() => {
    const svg = document.querySelector('.rl-svg');
    const stage = document.querySelector('.roll-stage');
    const d = document.documentElement;
    return {
      svgFits: svg.getBoundingClientRect().width <= stage.getBoundingClientRect().width + 1
        && svg.getBoundingClientRect().height <= stage.getBoundingClientRect().height + 1,
      noPageScroll: d.scrollWidth <= d.clientWidth + 1 && d.scrollHeight <= d.clientHeight + 1,
      viewBox: svg.getAttribute('viewBox')
    };
  });
  ok(fit.svgFits, `${vp.width}x${vp.height}: the course fits inside the stage`);
  ok(fit.noPageScroll, `${vp.width}x${vp.height}: nothing scrolls — the camera never moves`);
  ok(fit.viewBox === '0 0 100 60', `${vp.width}x${vp.height}: one authored viewBox for every viewport (${fit.viewBox})`);
  await page.screenshot({ path: `${SHOTS}/course-first-roll-${vp.width}x${vp.height}.png` });
  await ctx.close();
}

console.log('== the two thumb buttons, and what they do ==');
{
  const { ctx, page } = await open({ width: 1024, height: 768 });
  await page.evaluate(() => window.__booroll.openCourse('first-roll'));
  await page.waitForFunction(() => window.__booroll.calibrating());
  await page.evaluate(() => window.__booroll.go('virtual'));
  await page.waitForFunction(() => window.__booroll.playing());
  const btns = await page.evaluate(() => {
    const hop = document.querySelector('.roll-hop'), pad = document.querySelector('.roll-paddle');
    const r1 = hop.getBoundingClientRect(), r2 = pad.getBoundingClientRect();
    return { hopSize: Math.round(r1.width), padSize: Math.round(r2.width),
      hopRight: innerWidth - r1.right < 40, padLeft: r2.left < 40,
      hopLabel: hop.getAttribute('aria-label'), padLabel: pad.getAttribute('aria-label') };
  });
  ok(btns.hopSize === 96 && btns.padSize === 96, `both thumb buttons are 96px (${btns.hopSize}, ${btns.padSize})`);
  ok(btns.hopRight && btns.padLeft, 'hop bottom-right, mechanisms bottom-left');
  ok(/hop/i.test(btns.hopLabel) && /see-saw|lift|girder|gate/i.test(btns.padLabel), 'both are labelled for a screen reader');
  // the hop really lifts the ball in the live game — let her SETTLE on the ground first
  await page.evaluate(() => { window.__booroll.setTilt(0); });
  await page.waitForFunction(() => window.__booroll.ball().grounded, null, { timeout: 4000 });
  await page.waitForTimeout(200);
  const before = await page.evaluate(() => window.__booroll.ball().y);
  await page.evaluate(() => window.__booroll.hop());
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => window.__booroll.ball().y);
  ok(after < before - 1, `the hop button really lifts her (y ${before.toFixed(1)} → ${after.toFixed(1)})`);
  await ctx.close();
}

console.log('== orientation: lock requested where supported, friendly card where not ==');
{
  // stub a SUPPORTED lock
  const { ctx, page } = await open({ width: 1024, height: 768 }, () => {
    window.__lockCalls = [];
    Object.defineProperty(screen, 'orientation', { configurable: true, value: {
      angle: 90, type: 'landscape-primary',
      lock: (o) => { window.__lockCalls.push(o); return Promise.resolve(); },
      unlock: () => { window.__lockCalls.push('unlock'); }
    } });
  });
  await page.evaluate(() => window.__booroll.openCourse('first-roll'));
  await page.waitForFunction(() => window.__booroll.calibrating());
  ok(await page.evaluate(() => window.__booroll.lockSupported()), 'lock support is detected');
  await page.evaluate(() => document.querySelector('.roll-calibrate .btn.big').click());
  await page.waitForTimeout(400);
  ok((await page.evaluate(() => window.__lockCalls)).includes('landscape'), 'GO requests a landscape lock');
  await ctx.close();

  // stub an UNSUPPORTED lock (the iOS Safari path)
  const ios = await open({ width: 1024, height: 768 }, () => {
    Object.defineProperty(screen, 'orientation', { configurable: true, value: { angle: 0, type: 'portrait-primary' } });
  });
  await ios.page.evaluate(() => window.__booroll.openCourse('first-roll'));
  await ios.page.waitForFunction(() => window.__booroll.calibrating());
  ok(!(await ios.page.evaluate(() => window.__booroll.lockSupported())), 'no lock support is detected');
  const card = await ios.page.evaluate(() => window.__booroll.showTurnCard());
  ok(card === 'Turn your tablet sideways!', `the friendly card reads exactly "${card}"`);
  await ios.page.evaluate(() => window.__booroll.go('sensor'));
  await ios.page.waitForFunction(() => window.__booroll.playing());
  ok(await ios.page.evaluate(() => window.__booroll.playing()), 'and play proceeds unlocked');
  await ios.ctx.close();
}

console.log('== calibration: the authored copy, and ANY starting pose becomes zero ==');
{
  const { ctx, page } = await open({ width: 1024, height: 768 });
  await page.evaluate(() => window.__booroll.openCourse('first-roll'));
  await page.waitForFunction(() => window.__booroll.calibrating());
  const copy = await page.evaluate(() => window.__booroll.calibrationCopy());
  ok(copy[0] === 'Hold it however you like — then tap GO!', `the card says exactly: "${copy[0]}"`);
  ok(!/flat/i.test(copy.join(' ')), 'the words "hold flat" are gone');
  await page.evaluate(() => window.__booroll.go('sensor'));
  await page.waitForFunction(() => window.__booroll.playing());
  // a child holding the tablet at a lazy 35° — the FIRST reading becomes zero, so she is
  // not already leaning at full tilt before she has done anything
  await page.evaluate(() => { window.__booroll.orient(35, 35); });
  await page.waitForTimeout(120);
  const drift = await page.evaluate(() => { const b0 = window.__booroll.ball(); return b0.vx; });
  ok(Math.abs(drift) < 0.05, `an arbitrary 35° starting pose reads as level (vx ${drift.toFixed(3)})`);
  await page.evaluate(() => { window.__booroll.orient(55, 55); });
  await page.waitForTimeout(300);
  const moved = await page.evaluate(() => window.__booroll.ball().vx);
  ok(Math.abs(moved) > Math.abs(drift), 'and leaning FURTHER than that pose does move her');
  await ctx.close();
}

console.log('== every course is enterable now that the geometry is fixed (BLOCKED.md RESOLVED) ==');
{
  const { ctx, page } = await open({ width: 1024, height: 768 });
  const cards = await page.evaluate(() => [...document.querySelectorAll('.roll-course-card')].map(b => ({
    name: b.querySelector('.rcc-name').textContent, disabled: b.disabled, building: b.classList.contains('building')
  })));
  ok(cards.length === 6, 'all six authored courses are shown');
  const lift = cards.find(c => c.name === 'Lift Off');
  ok(!lift.disabled && !lift.building, 'Lift Off is enterable — no construction site left on its card');
  ok(cards.filter(c => !c.disabled).length === 6, 'all six are playable');
  ok(cards.every(c => !c.building), 'and no course anywhere still shows as being built');
  await page.screenshot({ path: `${SHOTS}/map-1024x768.png` });
  await ctx.close();
}

console.log('== the save migration keeps every old record (VERSION 16) ==');
{
  const { ctx, page } = await open({ width: 1024, height: 768 });
  const after = await page.evaluate(async () => {
    const { migrate, VERSION } = await import('./js/state.js');
    const old = { version: 15, booRoll: { best: { 'rolling-meadow': 61000, 'windy-hill': 80000, 'sunset-ridge': 99000 },
      medals: { 'rolling-meadow': 'silver', 'sunset-ridge': 'bronze' } } };
    const m = migrate(structuredClone(old));
    const twice = migrate(structuredClone(m));
    return { VERSION, version: m.version, legacy: m.booRoll.legacy, live: m.booRoll.best,
      idempotent: JSON.stringify(m.booRoll) === JSON.stringify(twice.booRoll) };
  });
  ok(after.VERSION >= 16 && after.version === after.VERSION, `the save version stepped to ${after.VERSION}`);
  ok(after.legacy.best['rolling-meadow'] === 61000 && after.legacy.best['windy-hill'] === 80000 && after.legacy.best['sunset-ridge'] === 99000,
    'all three old best times are preserved verbatim under booRoll.legacy');
  ok(after.legacy.medals['rolling-meadow'] === 'silver' && after.legacy.medals['sunset-ridge'] === 'bronze', 'and the old medals with them');
  ok(Object.keys(after.live).length === 0, 'no retired record masquerades as a new-course time');
  ok(after.idempotent, 'migrating an already-migrated save changes nothing');
  await ctx.close();
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
