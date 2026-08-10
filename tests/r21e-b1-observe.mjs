// tests/r21e-b1-observe.mjs — RUN21E H3 / B1: "Boos visibly use her paths", proved honestly.
//
// NOT a board suite (it is minutes long by design, like tests/walk.mjs). Run it directly:
//   BASE=http://127.0.0.1:8041 node tests/r21e-b1-observe.mjs
//
// The approval attached a condition: prove it with a 90-second observation using the SAME
// three-way measurement RUN21C used — path-left / no-path / path-right — and restore the
// withdrawn What's New entry ONLY if it passes.
//
// The measurement, stated before the numbers are in, so it cannot be tuned to a result:
//   Three identical Meadows, one lone Boo placed at x=0.20 on row 1 in each. In A the painted
//   path lies to the LEFT of her, in B there is no path at all, in C it lies to the RIGHT. We
//   sample the Boo's true position (placement x + live dx) every 500ms for 90 seconds and
//   report the mean signed drift from where she started.
//
// PASS requires BOTH:
//   1. DIRECTION — mean drift is negative with the path left, positive with the path right,
//      and the no-path control sits between them. A Boo that just wanders cannot do that.
//   2. OCCUPANCY — the fraction of samples taken ON a path tile is at least 3x the control's.
//      Direction alone could be a slow lean; occupancy is what "uses the path" actually means.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8041';
const SECONDS = Number(process.env.OBSERVE_S || 90);
const SHOTS = '_evidence/run21e';
mkdirSync(SHOTS, { recursive: true });

const BOO_X = 0.20, ROW = 1;
// PATH_CELL is 0.05 of the area WIDTH across and 5% of the placement band DOWN — so `cy` is a
// fine grid row, not a depth row. The band runs 0.62-0.92 of viewport height, giving
// cellH = 0.015h, and depth row 1 sits at 0.79h: cy = 11 lands at 0.7925h, which is row 1.
// (cy = 1 lands at 0.6425h — row 0 — which is what made the first run of this observation
// report a path the Boo could never have been standing on.)
const CELL = 0.05, CY_ROW1 = 11;
// Symmetric about the Boo: the left run's near edge and the right run's near edge are both
// 0.075 away from her, so neither side is handed an advantage by the fixture.
const runCells = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => ({ cx: from + i, cy: CY_ROW1, style: 'stone' }));
const LEFT_RUN = runCells(0, 2);    // centres 0.025 / 0.075 / 0.125
const RIGHT_RUN = runCells(5, 7);   // centres 0.275 / 0.325 / 0.375

const BOOS = ['boo_inky'];
const AREA_KEYS = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'boohouse_kitchen', 'boohouse_bedroom', 'gallery'];
const AREAS = () => Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }]));
const SAVE = (paths) => {
  const areas = AREAS();
  areas.meadow.items = [{ id: 1, zone: 'meadow', x: BOO_X, row: ROW, item: 'boo_inky', scale: 1 }];
  areas.meadow.paths = paths;
  return {
    version: 24, name: 'Ada', age: 8, ageAsked: true,
    guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
    inventory: Object.fromEntries(BOOS.map(b => [b, 1])),
    stars: { total: 400, byType: {}, spent: {} },
    town: { areas, nextId: 900 },
    funfair: { built: ['carousel'], build: null, pending: [], seats: {}, catchup: [] },
    wishes: { unlocked: {} },
    delights: { hideDay: '2099-01-01', hideFound: true },
    // Every landmark already seeded, so the lone Boo really is alone with the path.
    seen: { trophyRetro: true, townFirst: true, lastStarsShown: 400, whatsnewVersion: 'x', funfairOpened: true,
            wishWellSeeded: true, jokeStageSeeded: true, noticePostSeeded: true },
    settings: { sound: false, music: false, voice: false, content: 'full', requests: false }
  };
};

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

async function observe(label, paths) {
  // A FRESH context per case: live autosave overwrites a seeded save otherwise.
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => { window.__bootownHour = 13; });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE(paths));
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 25000 });
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2', { timeout: 15000 });
  await page.waitForFunction(() => window.__townLife, { timeout: 8000 });
  await page.evaluate(() => document.querySelectorAll('.overlay').forEach(o => o.remove()));

  const res = await page.evaluate(async ({ seconds, cellSize, booX }) => {
    const samples = [];
    const goals = [];
    const t0 = performance.now();
    const pathXs = (window.BooTown.State.getState().town.areas.meadow.paths || []).map(c => (c.cx + 0.5) * cellSize);
    while (performance.now() - t0 < seconds * 1000) {
      const g = window.__townLife.goals()[0];
      const dx = window.__townLife.goalTargetDx ? null : null;
      // True position = placement x + live dx (the transform the actor is actually at).
      const tf = window.__townLife.transform(0) || '';
      const m = tf.match(/translate\((-?[\d.]+)px/);
      const px = m ? parseFloat(m[1]) : 0;
      const zoneW = window.__town.geometry().zoneW;
      samples.push(booX + px / zoneW);
      if (g) goals.push(g.goal);
      await new Promise(r => setTimeout(r, 500));
    }
    return { samples, goals, pathXs };
  }, { seconds: SECONDS, cellSize: CELL, booX: BOO_X });

  const drifts = res.samples.map(x => x - BOO_X);
  const mean = drifts.reduce((s, d) => s + d, 0) / (drifts.length || 1);
  const onPath = res.pathXs.length
    ? res.samples.filter(x => res.pathXs.some(p => Math.abs(p - x) <= CELL / 2)).length / (res.samples.length || 1)
    : 0;
  const pathwalks = res.goals.filter(g => g === 'pathwalk').length;
  await page.screenshot({ path: `${SHOTS}/b1-${label}.png` });
  await ctx.close();
  return { label, mean, onPath, samples: res.samples.length, pathwalks, min: Math.min(...drifts), max: Math.max(...drifts) };
}

console.log(`\nRUN21E B1 — ${SECONDS}s three-way observation (path-left / no-path / path-right)\n`);
const left  = await observe('path-left',  LEFT_RUN);
const none  = await observe('no-path',    []);
const right = await observe('path-right', RIGHT_RUN);
await browser.close();

const fmt = r => `  ${r.label.padEnd(11)} mean drift ${r.mean >= 0 ? '+' : ''}${r.mean.toFixed(4)}  ` +
  `range [${r.min.toFixed(3)}, ${r.max.toFixed(3)}]  on-path ${(r.onPath * 100).toFixed(1)}%  ` +
  `pathwalk samples ${r.pathwalks}/${r.samples}`;
console.log([left, none, right].map(fmt).join('\n'));

// The two conditions, stated above, evaluated here.
const directionOK = left.mean < none.mean && right.mean > none.mean;
// The control has no path, so its occupancy is 0 by construction; require a real absolute
// occupancy instead of a ratio against zero.
const occupancyOK = left.onPath >= 0.25 && right.onPath >= 0.25;
console.log(`\n  DIRECTION  ${directionOK ? 'PASS' : 'FAIL'} — left ${left.mean.toFixed(4)} < none ${none.mean.toFixed(4)} < right ${right.mean.toFixed(4)}`);
console.log(`  OCCUPANCY  ${occupancyOK ? 'PASS' : 'FAIL'} — ${(left.onPath * 100).toFixed(1)}% / ${(right.onPath * 100).toFixed(1)}% of samples stood on the path (need 25%)`);

const verdict = directionOK && occupancyOK;
writeFileSync(`${SHOTS}/b1-observation.json`, JSON.stringify({ seconds: SECONDS, left, none, right, directionOK, occupancyOK, verdict }, null, 2));
console.log(`\nB1 OBSERVATION: ${verdict ? 'PASS — restore the What\'s New entry' : 'FAIL — leave the entry withdrawn'}\n`);
process.exit(verdict ? 0 : 1);
