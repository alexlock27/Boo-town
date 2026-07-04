// tests/m2-feedboos.mjs — Feed the Boos: drag mechanic, wrong-drop safety, perfect round.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

async function dragToFeeder(page, bucket) {
  const food = await page.$('.food-item');
  const fb = await food.boundingBox();
  const feeder = await page.$(`.feeder[data-bucket="${bucket}"]`);
  const tb = await feeder.boundingBox();
  await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await page.mouse.down();
  await page.mouse.move(fb.x + fb.width / 2 - 10, fb.y + fb.height / 2 - 10, { steps: 3 });
  await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 10 });
  await page.mouse.up();
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => {
  localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 1, name: 'Maya', guide: { body: 'sky', patch: 'indigo', acc: 'crown', name: 'Twiggy' } }));
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hub');
await page.evaluate(() => window.BooTown.go('feedboos'));

console.log('== start card -> level 1 ==');
await page.waitForSelector('.start-card');
await page.click('.level-btn'); // level 1
await page.waitForSelector('.food-item');
await page.waitForTimeout(400);
await page.screenshot({ path: 'screenshots/m2-feedboos-mid.png' });

const total = await page.evaluate(() => document.querySelectorAll('.pdot').length);
console.log('  round length:', total);

console.log('== one wrong drop must NOT end the round ==');
const nBuckets = await page.evaluate(() => document.querySelectorAll('.feeder').length);
const correct0 = Number(await page.getAttribute('.food-item', 'data-bucket'));
const wrongBucket = (correct0 + 1) % nBuckets;
const heartsBefore = await page.evaluate(() => document.querySelectorAll('.heart-ic.on').length);
await dragToFeeder(page, wrongBucket);
await page.waitForTimeout(400);
const stillPlaying = await page.$('.food-item');
assert(!!stillPlaying, 'round still going after a wrong drop');
const heartsAfter = await page.evaluate(() => document.querySelectorAll('.heart-ic.on').length);
assert(heartsAfter === heartsBefore - 1, 'a heart dimmed on wrong drop (' + heartsBefore + '->' + heartsAfter + ')');

console.log('== now feed everything correctly ==');
let guard = 0;
while (guard++ < 30) {
  const food = await page.$('.food-item');
  if (!food) break;
  const b = Number(await page.getAttribute('.food-item', 'data-bucket'));
  await dragToFeeder(page, b);
  await page.waitForTimeout(430);
  if (await page.$('.result-card')) break;
}
await page.waitForSelector('.result-card', { timeout: 5000 });
await page.waitForTimeout(1600);
const stars = await page.evaluate(() => document.querySelectorAll('.rstar.pop').length);
assert(stars === 3, '3 stars for a clean round with only 1 wrong drop (got ' + stars + ')');
const save = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')));
assert(save.stars.byGame.feedboos.plays === 1, 'feedboos play recorded');
assert(save.stars.byGame.feedboos.best === 3, 'feedboos best=3 recorded');

console.log('== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
