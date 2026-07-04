// tests/m1.mjs — Milestone 1 end-to-end: onboarding -> hub -> Bubble Pop -> results -> reload persists.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = [];
let failed = false;
const log = (...a) => console.log(...a);
function assert(cond, msg) { if (!cond) { failed = true; console.log('  ✗ FAIL:', msg); } else console.log('  ✓', msg); }

function answerFromEq(eq) {
  eq = eq.replace(/\s/g, '');
  let m;
  if ((m = eq.match(/^(\d+)×(\d+)=\?$/))) return (+m[1]) * (+m[2]);
  if ((m = eq.match(/^(\d+)÷(\d+)=\?$/))) return (+m[1]) / (+m[2]);
  if ((m = eq.match(/^\?×(\d+)=(\d+)$/))) return (+m[2]) / (+m[1]);
  return null;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const notFound = [];
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
page.on('response', r => { if (r.status() === 404) notFound.push(r.url()); });

log('\n== Fresh player (seed a save; full onboarding is covered by m2-onboard) ==');
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 1, name: 'Maya', guide: { body: 'sunshine', patch: 'cocoa', acc: 'bow', name: 'Twiggy' } })));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hub', { timeout: 5000 });
assert(true, 'hub reachable');
await page.waitForTimeout(600);
await page.screenshot({ path: 'screenshots/m1-hub-landscape.png' });

// portrait hub (same page, so the save persists)
await page.setViewportSize({ width: 768, height: 1024 });
await page.waitForTimeout(400);
await page.screenshot({ path: 'screenshots/m1-hub-portrait.png' });
await page.setViewportSize({ width: 1024, height: 768 });
await page.waitForTimeout(300);

log('\n== Enter Bubble Pop, pick level 2 ==');
await page.click('.game-card');                  // first card = Bubble Pop
await page.waitForSelector('.start-card');
await page.screenshot({ path: 'screenshots/m1-bubblepop-start.png' });
const lvBtns = await page.$$('.level-btn');
await lvBtns[1].click();                          // level 2 (mul + div)
await page.waitForSelector('.bubble-field');
await page.waitForTimeout(700);
await page.screenshot({ path: 'screenshots/m1-bubblepop-mid.png' });

log('\n== Play a perfect round (click only correct bubbles) ==');
for (let round = 0; round < 10; round++) {
  // read equation, compute answer, click the matching visible bubble in-page
  const res = await page.evaluate(() => {
    const eq = document.querySelector('.target-eq')?.textContent || '';
    return { eq };
  });
  const ans = answerFromEq(res.eq);
  if (ans == null) { assert(false, 'parsed equation "' + res.eq + '"'); break; }
  // wait until a bubble with the answer is present, then click it directly
  const clicked = await page.evaluate((ans) => {
    const bs = [...document.querySelectorAll('.bubble')];
    const b = bs.find(x => x.style.visibility !== 'hidden' && Number(x.textContent) === ans);
    if (b) { b.click(); return true; }
    return false;
  }, ans);
  if (!clicked) { await page.waitForTimeout(200); round--; continue; }
  await page.waitForTimeout(340);
}

log('\n== Results ==');
await page.waitForSelector('.result-card', { timeout: 5000 });
await page.waitForTimeout(2900); // let stars animate in and the meter fill
await page.screenshot({ path: 'screenshots/m1-results.png' });
const starCount = await page.evaluate(() => document.querySelectorAll('.rstar.pop').length);
assert(starCount === 3, 'perfect round earned 3 stars (got ' + starCount + ')');

const save1 = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')));
assert(save1 && save1.stars.byGame.bubblepop.best === 3, 'save records best=3 for bubblepop');
assert(save1.stars.byGame.bubblepop.plays === 1, 'save records 1 play');
assert(save1.meter === (4 % 6), 'meter banked 4 points (3 stars + bonus)');

log('\n== Reload: stars persist ==');
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForSelector('.hub');
await page.waitForTimeout(400);
const bestStarsShown = await page.evaluate(() => document.querySelectorAll('.game-card .star-ic.on').length);
assert(bestStarsShown === 3, 'hub shows 3 filled best-stars for Bubble Pop after reload (got ' + bestStarsShown + ')');
const save2 = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')));
assert(save2.name === 'Maya', 'name persisted');
assert(save2.stars.byGame.bubblepop.best === 3, 'best score persisted across reload');

log('\n== Console / resource errors ==');
if (errors.length) console.log('  JS errors:\n' + errors.map(e => '  ! ' + e).join('\n'));
else console.log('  no JS errors');
assert(errors.length === 0, 'no JavaScript console errors');

const EXPECTED_404 = /Fredoka|favicon|manifest\.webmanifest|icon-192|icon-512|sw\.js/i;
const unexpected404 = [...new Set(notFound)].filter(u => !EXPECTED_404.test(u));
if (notFound.length) console.log('  404s (expected pre-M3):\n' + [...new Set(notFound)].map(u => '    - ' + u.replace(BASE, '')).join('\n'));
assert(unexpected404.length === 0, 'no unexpected 404s (' + unexpected404.join(', ') + ')');

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
