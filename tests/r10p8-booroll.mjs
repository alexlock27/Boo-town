// @serial — device-simulation: synthetic deviceorientation streams (runs alone at the board's end; RUN14 U-0)
// RUN10 P7/P8 acceptance, REPOINTED at RUN14 U1's rebuild.
//
// SUPERSEDED, justified in-file: P8's three multi-screen courses (rolling-meadow /
// windy-hill / sunset-ridge, worlds of 6000-8000px with a scrolling camera, a `flat|slope|
// gap|platform` segment vocabulary and a top progress strip) were REPLACED WHOLESALE by
// CONTENT_COURSES.md's six single-screen courses. Every assertion below that named that
// vocabulary, those worlds, or the camera strip is therefore gone — the thing it protected
// does not exist any more, and r14u1-booroll.mjs proves the replacement far harder.
//
// What survives here is what P7/P8 were really guarding and what still holds: the tilt
// channel genuinely drives the ball, the fallback puck works, the course select renders
// the authored set, and reaching the finish completes the course.
import { chromium } from 'playwright';
import { COURSES, PLAYABLE_KEYS } from '../data/courses.js';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (ok, message) => { console.log((ok ? '✓' : 'FAIL:'), message); if (!ok) failed = true; };

assert(COURSES.length === 6, 'the six authored courses exist');
for (const course of COURSES) {
  assert(course.segments.some(s => s.t === 'platform'), `${course.name} is built from the authored segment vocabulary`);
  assert(course.stars.length === 3 && course.checkpoints.length >= 1 && course.finish.x <= 100,
    `${course.name} has three stars, a checkpoint and a finish inside the one-screen board`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on('pageerror', err => { failed = true; console.log('PAGE ERROR:', err.message); });
await page.goto(BASE + '/index.html');
await page.evaluate(() => localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 16, name: 'Ada', guide: { body: 'sky' }, stars: { total: 300, byGame: {} }, town: { areas: {} }, booRoll: { best: {}, medals: {} }, seen: { introSeen: { booroll: 1 } }, settings: { sound: false, music: false } })));
await page.reload(); await page.waitForSelector('.hub');
await page.evaluate(() => window.BooTown.go('booroll')); await page.waitForSelector('.roll-course-grid');
assert(await page.locator('.roll-course-card').count() === 6, 'the course map renders all six cards');
await page.evaluate(() => window.__booroll.openCourse('first-roll')); await page.waitForSelector('.roll-calibrate');
await page.evaluate(() => window.__booroll.go('virtual')); await page.waitForSelector('.roll14 .rl-svg');
const first = await page.evaluate(() => window.__booroll.ball());
for (let i = 0; i < 35; i++) { await page.evaluate(() => window.__booroll.stick(42)); await page.waitForTimeout(18); }
const later = await page.evaluate(() => window.__booroll.ball());
assert(later.x > first.x + 2, `the virtual puck drives the roll (x ${first.x.toFixed(1)} → ${later.x.toFixed(1)})`);
assert(await page.locator('.roll-paddle').count() === 1 && await page.locator('.roll-hop').count() === 1,
  'the two thumb buttons render: mechanisms and the hop');
// synthetic deviceorientation: the sensor channel moves her too (this is the @serial part)
await page.evaluate(() => window.BooTown.go('booroll'));
await page.waitForSelector('.roll-course-grid');
await page.evaluate(() => window.__booroll.openCourse('first-roll'));
await page.waitForSelector('.roll-calibrate');
await page.evaluate(() => window.__booroll.go('sensor'));
await page.waitForSelector('.roll14 .rl-svg');
await page.evaluate(() => window.__booroll.orient(0, 0));      // calibrate at rest
await page.waitForTimeout(120);
const sBefore = await page.evaluate(() => window.__booroll.ball());
for (let i = 0; i < 30; i++) { await page.evaluate(() => window.__booroll.orient(26, 26)); await page.waitForTimeout(20); }
const sAfter = await page.evaluate(() => window.__booroll.ball());
assert(sAfter.x > sBefore.x + 2, `a synthetic orientation stream rolls her (x ${sBefore.x.toFixed(1)} → ${sAfter.x.toFixed(1)})`);
await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
