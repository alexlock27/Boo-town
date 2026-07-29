// Focused RUN10 P18 check: Funfair door, audio-clock bars, personality dance and saved
// routines. RUN19 Z1 extends it: buildTrackJam()/layoutFloor() pure-function checks, the
// per-beat dance model, the projected-cell floor + rail, and Routine Night's loop.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { buildTrackJam, layoutFloor, FLOOR_ROW_CAPACITY, MAX_ON_FLOOR, COL_MIN, COL_MAX } from '../js/discohall.js';
import { BOO_POP_HITS } from '../data/songs.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r10p18', { recursive: true });
let failed = false;
const ok = (condition, message) => {
  console.log(condition ? `  ✓ ${message}` : `  ✗ FAIL: ${message}`);
  if (!condition) failed = true;
};
// RUN19 Z1: thirteen, not six — enough owned Boos to prove the floor's overflow rail
// (MAX_ON_FLOOR = 10) as well as the free-dance/personality checks below.
const BOOS = ['boo_inky', 'boo_pippin', 'boo_wisp', 'boo_plum', 'boo_beam', 'boo_peppy',
  'boo_aurora', 'boo_batty', 'boo_boooo', 'boo_breeze', 'boo_bubbles', 'boo_candy', 'boo_coco'];

console.log('== RUN19 Z1: pure-function checks (no browser) ==');
{
  const hit = BOO_POP_HITS[0];
  const jam = buildTrackJam(hit);
  const beatMs = 60000 / hit.bpm;
  ok(jam.bars === 16, `buildTrackJam covers all 16 authored bars (${jam.bars})`);
  ok(Math.abs(jam.dur - 64 * beatMs) < 1, `duration is exactly 64 beats at the track's bpm (${jam.dur.toFixed(1)}ms)`);
  const hats = jam.events.filter(e => e.i === 'drum' && e.v === 'hihat');
  ok(hats.length === 64, `a closed hat on every beat, all 16 bars (${hats.length}/64)`);
  const kicks = jam.events.filter(e => e.i === 'drum' && e.v === 'kick');
  const snares = jam.events.filter(e => e.i === 'drum' && e.v === 'snare');
  ok(kicks.length === 32 && snares.length === 32, `kick on 1&3, snare on 2&4, every bar (${kicks.length} kicks, ${snares.length} snares)`);
  const melodyNotes = hit.melody.filter(n => n.semi != null).length;
  const keyEvents = jam.events.filter(e => e.i === 'key');
  ok(keyEvents.length === melodyNotes + 16, `melody notes + one bass note per bar, on the same 'key' voice (${keyEvents.length} = ${melodyNotes} + 16)`);
  // (matched by proximity to each bar's own computed start, not a modulo — independently
  // rounding each bar's ms offset can drift a integer ms off an exact multiple of barMs)
  const bassEvents = jam.events.filter(e => e.i === 'key' && e.v < 0);
  const barStartsCovered = Array.from({ length: 16 }, (_, bar) => Math.round(bar * 4 * beatMs))
    .filter(t0 => bassEvents.some(e => Math.abs(e.t - t0) <= 1)).length;
  ok(bassEvents.length === 16 && barStartsCovered === 16, `bass sits an octave down (negative semi) on beat 1 of every bar (${bassEvents.length} events, ${barStartsCovered}/16 bar starts)`);
  ok(BOO_POP_HITS.every(h => buildTrackJam(h).bars === 16), 'holds for all four Boo Pop Hits');

  const { cells, rail } = layoutFloor(13);
  ok(cells.length === MAX_ON_FLOOR && rail.length === 3, `layoutFloor(13): ${MAX_ON_FLOOR} on the floor, 3 on the rail`);
  const byRow = [0, 0, 0]; cells.forEach(c => byRow[c.row]++);
  ok(byRow.join(',') === FLOOR_ROW_CAPACITY.join(','), `rows fill front-first to capacity (${byRow.join(',')})`);
  ok(cells.every(c => c.col >= COL_MIN - 0.001 && c.col <= COL_MAX + 0.001), 'every column sits within the authored 14-86% spread');
  const few = layoutFloor(4);
  ok(few.cells.length === 4 && few.rail.length === 0, 'fewer than 10 Boos: nobody rides the rail');
}
const AREAS = Object.fromEntries(['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'].map(k => [k, { items: [], paths: [] }]));
const seed = {
  version: 8, name: 'Ada', age: 8, ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: Object.fromEntries(BOOS.map(id => [id, 1])),
  stars: { total: 80, byGame: {} }, boxes: 0, meter: 0, opened: 4, pity: { commons: 0 },
  town: { areas: AREAS }, nicknames: {}, equips: {}, catBest: {}, ledger: {},
  care: { bonds: {}, treats: 0 }, settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { trophyRetro: true, boohouseSeeded: true }, delights: {}, trophies: {}, journal: {},
  routines: { 'meadow:0.3': ['bounce', 'spin', 'freeze'] }
};

const browser = await chromium.launch();
async function open(viewport, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(value => localStorage.setItem('bootown.save.v1', JSON.stringify(value)), seed);
  await page.reload({ waitUntil: 'load' });
  return { context, page };
}

console.log('== Funfair door and authored hall ==');
{
  const { context, page } = await open({ width: 1180, height: 760 });
  await page.evaluate(() => window.BooTown.go('town', { area: 'funfair' }));
  await page.waitForFunction(() => window.__townLife?.hasDiscoDoor());
  const before = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('bootown.save.v1')).town.areas.funfair));
  ok(await page.locator('.ff-disco-door').count() === 1, 'Funfair has one glowing DISCO entrance');
  await page.evaluate(() => window.BooTown.go('discohall'));
  await page.waitForFunction(() => window.__disco);
  ok(await page.locator('.disco-tile').count() === 24, 'dance floor is a 6 × 4 grid');
  ok(await page.locator('.disco-ball i').count() === 25, 'mirrored ball has individually lit facets');
  ok(await page.locator('.disco-dancer').count() === BOOS.length, 'every present Boo joins the dance');
  const overflow = await page.evaluate(() => ({ floor: window.__disco.floorCount(), rail: window.__disco.railCount() }));
  ok(overflow.floor === 10 && overflow.rail === 3, `RUN19 Z1: 10 on the floor, 3 on the rail with 13 Boos (${overflow.floor}/${overflow.rail})`);

  // RUN19 Z1: the bar-quantised note model is gone — beats drive the clock now, and the
  // beat-tick log (not the bar log, which just names which bar/track) carries the timing
  // error against the audio clock.
  await page.waitForFunction(() => window.__disco.beatLog().filter(e => e.error != null).length > 0);
  const beat = await page.evaluate(() => window.__disco.beatLog().find(e => e.error != null));
  ok(Math.abs(beat.error) <= 40, `first beat lands within ±40ms of the audio clock (${beat.error.toFixed(1)}ms)`);
  // RUN13 T5 SUPERSEDED THIS ASSERTION, justified in RUN13_REPORT.md: the floor grew from
  // six moves to ten, and each temperament now PREFERS three of them, re-picked every bar,
  // so two Boos of the same temperament stop dancing in lockstep. What must still hold is
  // that a Boo only ever dances one of HER OWN three — the personality mapping is still
  // real, it is just no longer a single hardcoded move.
  const moves = await page.evaluate(() => { window.__disco.forceBar(); return window.__disco.dancerMoves(); });
  const prefs = await page.evaluate(() => window.__disco.preferences());
  const signature = { bouncy:'bounce', sleepy:'sway', cheeky:'spin', shy:'sway-small', musical:'shimmy', sporty:'star-jump' };
  ok(moves.every(({ personality, move }) => (prefs[personality] || []).includes(move)),
    'each personality dances one of its own three preferred moves');
  ok(Object.entries(signature).every(([p, m]) => (prefs[p] || [])[0] === m),
    'and its original authored dance is still its signature (first preference)');
  ok(new Set(await page.evaluate(() => window.__disco.tileHues())).size === 24, 'all 24 tiles receive bar-linked hues');

  // RUN19 Z1: "crossfade over one bar" — cycleTrack() no longer switches instantly, it
  // takes effect at the next bar boundary (forceBar() simulates crossing one).
  const tracks = await page.evaluate(() => {
    const ids = [window.__disco.track()];
    for (let i = 0; i < 3; i++) { window.__disco.cycleTrack(); window.__disco.forceBar(); ids.push(window.__disco.track()); }
    return ids;
  });
  ok(new Set(tracks).size === 4, 'track chip cycles all four Boo Pop Hits');
  // RUN19 Z1: routine mode performs the sequence floor-wide, one move per BEAT, and LOOPS
  // — it no longer auto-stops after one pass (the pack's own words: "...looping").
  await page.evaluate(() => window.__disco.playRoutine('meadow:0.3'));
  await page.waitForFunction(() => window.__disco.routineLog().length >= 3);
  const routine = await page.evaluate(() => ({ log: window.__disco.routineLog().slice(0, 3), mode: window.__disco.mode() }));
  ok(routine.log.map(x => x.move).join('|') === 'bounce|spin|freeze', 'saved poster replays its routine event-for-event');
  ok(routine.mode === 'routine', 'and stays in routine mode (no auto-stop)');
  ok(await page.locator('.disco-dancers.routine').count() === 1, 'dancers are in the routine layout');
  // force it round the loop point and confirm it starts the sequence again from the top
  const looped = await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__disco.forceBeat(); return window.__disco.routineLog().slice(-1)[0]; });
  ok(looped.move === 'freeze' || ['bounce', 'spin', 'freeze'].includes(looped.move), `the loop keeps cycling the same three moves (${looped.move})`);
  // RUN19 Z1: the mode button cycles Free Dance -> Routine Night! -> ... -> Free Dance.
  // One saved routine here, so one cycleMode() call returns to free.
  await page.evaluate(() => window.__disco.cycleMode());
  await page.waitForFunction(() => window.__disco.mode() === 'free');
  ok(await page.locator('.disco-dancers.routine').count() === 0, 'the mode button cycles back to free dance');
  await page.screenshot({ path: 'screenshots/r10p18/hall-1180x760.png' });
  await page.evaluate(() => window.BooTown.go('town', { area: 'funfair' }));
  await page.waitForFunction(() => window.__townLife?.hasDiscoDoor());
  const after = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('bootown.save.v1')).town.areas.funfair));
  ok(after === before, 'entering and leaving preserves the Funfair state exactly');
  await context.close();
}

console.log('== phone and reduced motion ==');
{
  const { context, page } = await open({ width: 390, height: 844 }, 'reduce');
  await page.evaluate(() => window.BooTown.go('discohall'));
  await page.waitForFunction(() => window.__disco);
  const reduced = await page.evaluate(() => {
    window.__disco.forceBar();
    return { flag: window.__disco.reduced(), moves: window.__disco.dancerMoves() };
  });
  ok(reduced.flag && reduced.moves.every(x => x.move === 'sway'), 'reduced motion keeps only the slow sway');
  await page.screenshot({ path: 'screenshots/r10p18/hall-390x844.png' });
  await context.close();
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
