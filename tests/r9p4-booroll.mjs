// tests/r9p4-booroll.mjs — Boo Roll (RUN9 C4) + acceptance part D #4.
// Synthetic orientation sequences roll the ball with believable physics (frame evidence);
// calibration zeroes; the drag fallback drives the ball; holes respawn at the flag with a
// time cost; three stars collectable; medal thresholds award against scripted times; medals
// appear on the map and in the Trophy Room; the iOS permission path is stubbed + verified.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { captureSeries, summariseDeltas } from './lib/motion.mjs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r9p4', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sky', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 5, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [],
  stars: { total: 300, byGame: {} }, ledger: {}, booRoll: { best: {}, medals: {} },
  seen: { introSeen: { booroll: 1 }, trophyRetro: true }, trophies: {}, ageAsked: true, age: 8,
  settings: { sound: false, music: false, voice: false, content: 'full' }
}, over);

const browser = await chromium.launch();
async function fresh(save) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(v => localStorage.setItem('bootown.save.v1', JSON.stringify(v)), save || SAVE());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
async function playCourse(page, id, mode = 'sensor') {
  await page.evaluate(() => window.BooTown.go('booroll'));
  await page.waitForSelector('.roll-course-grid');
  await page.evaluate(i => window.__booroll.openCourse(i), id);
  await page.waitForSelector('.roll-calibrate');
  await page.evaluate(m => window.__booroll.go(m), mode);
  await page.waitForSelector('.roll-canvas');
  await page.waitForFunction(() => window.__booroll.playing && window.__booroll.playing());
}

// ---- 1) medal thresholds (pure) ----
console.log('== medal thresholds ==');
{
  const { ctx, page } = await fresh();
  const m = await page.evaluate(async () => {
    const mod = await import('./js/games/booroll.js');
    const c1 = mod.COURSES[0];   // par gold 15 / silver 24 / bronze 38
    return [mod.medalFor(c1, 14), mod.medalFor(c1, 15), mod.medalFor(c1, 20), mod.medalFor(c1, 30), mod.medalFor(c1, 45), mod.COURSES.length];
  });
  assert(m[0] === 'gold' && m[1] === 'gold', 'gold at/under the gold par');
  assert(m[2] === 'silver', 'silver between gold and silver par');
  assert(m[3] === 'bronze', 'bronze between silver and bronze par');
  assert(m[4] === null, 'over bronze par = a finish with no medal');
  assert(m[5] === 6, 'there are six courses');
  await ctx.close();
}

// ---- 2) physics under synthetic orientation (frame evidence) + calibration ----
console.log('== orientation physics + frame evidence ==');
{
  const { ctx, page } = await fresh();
  await playCourse(page, 'roll1', 'sensor');
  await page.evaluate(() => window.__booroll.orient(0, 0));   // hold flat → calibrate zero
  const clip = await page.$eval('.roll-canvas', n => { const b = n.getBoundingClientRect(); return { x: b.left, y: b.top, width: b.width, height: b.height }; });
  const b0 = await page.evaluate(() => window.__booroll.ball());
  const { deltas, probes } = await captureSeries(page, {
    dir: 'r9p4', prefix: 'roll-orient', count: 7, gapMs: 90, clip,
    probe: async (p) => { await p.evaluate(() => window.__booroll.orient(30, 22)); return p.evaluate(() => window.__booroll.ball()); }
  });
  const b1 = await page.evaluate(() => window.__booroll.ball());
  const sum = summariseDeltas(deltas, 30);
  assert(sum.moved >= 4, `the ball visibly rolls under synthetic orientation (${sum.moved}/${sum.pairs} frame-pairs moved)`);
  assert(Math.hypot(b1.x - b0.x, b1.y - b0.y) > 40, `the ball travelled a believable distance (${Math.round(Math.hypot(b1.x - b0.x, b1.y - b0.y))}px)`);
  // calibration: after re-centring and holding a constant angle, tilt nets ~zero. Let the
  // smoothing + rolling friction settle first (the prior lean has residual momentum), then
  // a held angle should keep the ball essentially still.
  await page.evaluate(() => window.__booroll.teleport(500, 500));
  await page.evaluate(() => window.__booroll.recentre());
  for (let i = 0; i < 30; i++) { await page.evaluate(() => window.__booroll.orient(10, 10)); await sleep(16); }   // becomes the new zero + settles
  const c0 = await page.evaluate(() => window.__booroll.ball());
  for (let i = 0; i < 16; i++) { await page.evaluate(() => window.__booroll.orient(10, 10)); await sleep(16); }
  const c1 = await page.evaluate(() => window.__booroll.ball());
  assert(Math.hypot(c1.x - c0.x, c1.y - c0.y) < 20, `calibration zeroes the held angle (settled drift ${Math.round(Math.hypot(c1.x - c0.x, c1.y - c0.y))}px)`);
  await page.screenshot({ path: 'screenshots/r9p4/roll-play.png' });
  await ctx.close();
}

// ---- 3) drag fallback drives the ball ----
console.log('== drag (virtual) fallback ==');
{
  const { ctx, page } = await fresh();
  await playCourse(page, 'roll1', 'virtual');
  await page.evaluate(() => window.__booroll.teleport(500, 320));
  const b0 = await page.evaluate(() => window.__booroll.ball());
  for (let i = 0; i < 30; i++) { await page.evaluate(() => window.__booroll.stick(44, -44)); await sleep(20); }
  const b1 = await page.evaluate(() => window.__booroll.ball());
  assert(await page.evaluate(() => window.__booroll.state().mode) === 'virtual', 'the finger-stick fallback is the active mode');
  assert(Math.hypot(b1.x - b0.x, b1.y - b0.y) > 40, `the finger stick rolls the ball (${Math.round(Math.hypot(b1.x - b0.x, b1.y - b0.y))}px)`);
  await ctx.close();
}

// ---- 4) holes respawn at the flag with a time cost ----
console.log('== holes respawn at the flag (never a fail) ==');
{
  const { ctx, page } = await fresh();
  await playCourse(page, 'roll1', 'virtual');
  const before = await page.evaluate(() => window.__booroll.state());
  await page.evaluate(() => window.__booroll.grabFlag());
  await page.evaluate(() => window.__booroll.fallHole());
  await sleep(60);
  const after = await page.evaluate(() => window.__booroll.state());
  const field = await page.evaluate(() => window.__booroll.field());
  const ball = await page.evaluate(() => window.__booroll.ball());
  assert(after.respawns === before.respawns + 1, 'falling in a hole respawns (never ends the round)');
  assert(Math.hypot(ball.x - field.course.flag.x, ball.y - field.course.flag.y) < 6, 'respawn returns the ball to the last checkpoint flag');
  assert(!after.finished, 'a hole is not a fail state');
  await ctx.close();
}

// ---- 5) three pickup stars collectable ----
console.log('== three pickup stars ==');
{
  const { ctx, page } = await fresh();
  await playCourse(page, 'roll1', 'virtual');
  const stars = await page.evaluate(() => window.__booroll.field().course.stars);
  for (const st of stars) { await page.evaluate(s => window.__booroll.teleport(s.x, s.y), st); await sleep(60); }
  assert(await page.evaluate(() => window.__booroll.state().stars) === 3, 'all three pickup stars collect when rolled over');
  await ctx.close();
}

// ---- 6) medals award, persist, show on the map + Trophy Room ----
console.log('== medals award + map + Trophy Room ==');
{
  const { ctx, page } = await fresh();
  await playCourse(page, 'roll1', 'virtual');
  await page.evaluate(() => window.__booroll.forceFinish());   // fast time → gold
  await sleep(300);
  const savedMedal = await page.evaluate(() => window.BooTown.State.getState().booRoll.medals.roll1);
  assert(savedMedal === 'gold', `a fast finish awards + persists a gold medal (${savedMedal})`);
  // wait for the results, then return to the Boo Roll map — the course card shows the medal
  await page.waitForSelector('.results, [data-screen="results"]', { timeout: 5000 }).catch(() => {});
  await page.evaluate(() => window.BooTown.go('booroll'));
  await page.waitForSelector('.roll-course-grid');
  const cardMedal = await page.$eval('.roll-course-card .rcc-medal', n => n.textContent);
  assert(/🥇|🥈|🥉/.test(cardMedal), `the course map shows the earned medal (${cardMedal})`);
  // Trophy Room: the "First Medal" trophy is now earned
  const trophyEarned = await page.evaluate(async () => {
    const t = await import('./js/trophies.js');
    const s = window.BooTown.State.getState();
    const c = t.CATALOG.find(x => x.key === 'trophy_roll_first');
    return c ? c.earned(s) : null;
  });
  assert(trophyEarned === true, 'the "First Medal" Trophy Room entry is earned');
  await page.screenshot({ path: 'screenshots/r9p4/map-medal.png' });
  await ctx.close();
}

// ---- 7) iOS permission path (stubbed) ----
console.log('== iOS tilt-permission flow (stubbed) ==');
{
  const { ctx, page } = await fresh();
  // stub the iOS DeviceOrientationEvent.requestPermission BEFORE opening a course
  await page.evaluate(() => {
    window.__grantCalls = 0;
    window.DeviceOrientationEvent = window.DeviceOrientationEvent || function () {};
    window.DeviceOrientationEvent.requestPermission = async () => { window.__grantCalls++; return 'granted'; };
  });
  await page.evaluate(() => window.BooTown.go('booroll'));
  await page.waitForSelector('.roll-course-grid');
  await page.evaluate(() => window.__booroll.openCourse('roll2'));
  await page.waitForSelector('.roll-calibrate');
  assert(await page.evaluate(() => window.__booroll.permNeeded()), 'iOS shows a tilt-permission step first');
  const permBtn = await page.$('.roll-cal-btns .btn:has-text("enable tilt")');
  assert(!!permBtn, 'a friendly "Tap to enable tilt!" button is shown');
  await permBtn.click();
  await sleep(150);
  assert(await page.evaluate(() => window.__grantCalls) === 1, 'tapping requests DeviceOrientation permission once');
  assert(!(await page.evaluate(() => window.__booroll.permNeeded())), 'after granting, the GO button flow proceeds');
  await ctx.close();
}

await browser.close();
console.log('\n' + (failed ? 'r9p4-booroll: FAIL' : 'r9p4-booroll: ALL PASS'));
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
