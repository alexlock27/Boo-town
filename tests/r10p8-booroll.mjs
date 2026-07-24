// RUN10 P7/P8 acceptance: authored side-view courses and their runtime hooks.
import { chromium } from 'playwright';
import { COURSES } from '../data/courses.js';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (ok, message) => { console.log((ok ? '✓' : 'FAIL:'), message); if (!ok) failed = true; };
assert(COURSES.length === 3, 'three authored courses exist');
for (const course of COURSES) {
  assert(['flat', 'slope', 'gap', 'platform'].every(t => course.segments.some(s => s.t === t)), `${course.name} has the authored segment vocabulary`);
  assert(course.stars.length === 3 && course.flags.length === 2 && course.finish.x < course.world, `${course.name} has three stars, flags and a finish inside its world`);
}
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
page.on('pageerror', err => { failed = true; console.log('PAGE ERROR:', err.message); });
await page.goto(BASE + '/index.html');
await page.evaluate(() => localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 6, name: 'Ada', guide: { body: 'sky' }, stars: { total: 300, byGame: {} }, town: { areas: {} }, booRoll: { best: {}, medals: {} }, seen: { introSeen: { booroll: 1 } }, settings: { sound: false, music: false } })));
await page.reload(); await page.waitForSelector('.hub');
await page.evaluate(() => window.BooTown.go('booroll')); await page.waitForSelector('.roll-course-grid');
assert(await page.locator('.roll-course-card').count() === 3, 'course map renders three cards');
await page.evaluate(() => window.__booroll.openCourse('rolling-meadow')); await page.waitForSelector('.roll-calibrate');
await page.evaluate(() => window.__booroll.go('virtual')); await page.waitForSelector('.roll10 .roll-canvas');
const first = await page.evaluate(() => window.__booroll.ball());
for (let i = 0; i < 35; i++) { await page.evaluate(() => window.__booroll.stick(42)); await page.waitForTimeout(18); }
const later = await page.evaluate(() => window.__booroll.ball());
assert(later.x > first.x + 25, 'virtual puck drives side-view rolling');
assert(await page.locator('.roll-progress-flag').count() === 2, 'top strip renders both flag ticks');
assert(await page.locator('.roll-paddle').count() === 2, 'fixed mechanism paddles render');
await page.evaluate(() => window.__booroll.teleport(5795)); await page.waitForTimeout(80);
assert(await page.evaluate(() => window.__booroll.state().finished), 'finish boundary completes the course');
await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
