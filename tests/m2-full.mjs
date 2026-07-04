// tests/m2-full.mjs — Milestone 2 DoD: new player -> all three games -> opens TWO boxes,
// keyboard used only for the name field.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false; let keystrokes = 0;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

function answerFromEq(eq) {
  eq = eq.replace(/\s/g, ''); let m;
  if ((m = eq.match(/^(\d+)×(\d+)=\?$/))) return +m[1] * +m[2];
  if ((m = eq.match(/^(\d+)÷(\d+)=\?$/))) return +m[1] / +m[2];
  if ((m = eq.match(/^\?×(\d+)=(\d+)$/))) return +m[2] / +m[1];
  return null;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
// count real keyboard usage
const origFill = page.fill.bind(page);
page.fill = async (sel, val) => { keystrokes++; return origFill(sel, val); };

async function openCeremony() {
  // handles chained boxes (a duplicate can bank+auto-open another box)
  for (let guard = 0; guard < 10; guard++) {
    await page.waitForSelector('.gift-box, .hub', { timeout: 6000 });
    if (await page.$('.hub')) return;
    if (!(await page.$('.gift-box'))) return;
    for (let i = 0; i < 3; i++) { await page.click('.gift-box', { force: true }); await page.waitForTimeout(240); }
    await page.waitForSelector('.reveal-card', { timeout: 4000 });
    await page.waitForTimeout(450);
    const btns = await page.$$('.reveal-btns .btn');
    await btns[btns.length - 1].click({ force: true }); // keep / Yay
    await page.waitForTimeout(300);
  }
}

async function playBubble(level) {
  await page.evaluate(() => window.BooTown.go('bubblepop'));
  await page.waitForSelector('.start-card');
  (await page.$$('.level-btn'))[level - 1].click();
  await page.waitForSelector('.bubble-field');
  for (let r = 0; r < 10; r++) {
    let clicked = false;
    for (let tries = 0; tries < 40 && !clicked; tries++) {
      const eq = await page.evaluate(() => document.querySelector('.target-eq')?.textContent || '');
      const ans = answerFromEq(eq);
      clicked = await page.evaluate((a) => { const b = [...document.querySelectorAll('.bubble')].find(x => x.style.visibility !== 'hidden' && Number(x.textContent) === a); if (b) { b.click(); return true; } return false; }, ans);
      if (!clicked) await page.waitForTimeout(120);
    }
    await page.waitForTimeout(320);
  }
  await page.waitForSelector('.result-card', { timeout: 5000 });
}

async function playFeed(level) {
  await page.evaluate(() => window.BooTown.go('feedboos'));
  await page.waitForSelector('.start-card');
  (await page.$$('.level-btn'))[level - 1].click();
  await page.waitForSelector('.food-item');
  let guard = 0;
  while (guard++ < 30) {
    const food = await page.$('.food-item'); if (!food) break;
    const b = await page.getAttribute('.food-item', 'data-bucket');
    const fb = await food.boundingBox();
    const feeder = await page.$(`.feeder[data-bucket="${b}"]`); const tb = await feeder.boundingBox();
    await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(420);
    if (await page.$('.result-card')) break;
  }
  await page.waitForSelector('.result-card', { timeout: 5000 });
}

async function playSpell(level) {
  await page.evaluate(() => window.BooTown.go('spellboo'));
  await page.waitForSelector('.start-card');
  (await page.$$('.level-btn'))[level - 1].click();
  await page.waitForSelector('.slots-wrap');
  for (let w = 0; w < 8; w++) {
    if (await page.$('.result-card')) break;
    const word = await page.getAttribute('.slots-wrap', 'data-word');
    for (const ch of word) { await page.evaluate((l) => { const t = [...document.querySelectorAll('.tile')].find(x => x.style.visibility !== 'hidden' && x.textContent === l); if (t) t.click(); }, ch); await page.waitForTimeout(60); }
    await page.waitForFunction((prev) => document.querySelector('.result-card') || (document.querySelector('.slots-wrap')?.dataset.word !== prev), word, { timeout: 6000 }).catch(() => {});
  }
  await page.waitForSelector('.result-card', { timeout: 6000 });
}

console.log('== fresh first launch ==');
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.click('.ob-splash .btn');
await page.fill('.text-input', 'Ivy');        // the ONLY keyboard use
await page.click('.ob-name .btn');
await page.waitForSelector('.ob-age-grid');
await page.click('.ob-age-btn:has-text("8")');   // age step (job 4)
await page.waitForSelector('.creator');
await page.click('.creator-btns .btn.big');    // Done with defaults (no keyboard)
await page.waitForSelector('.intro-block');
for (let i = 0; i < 3; i++) { await page.click('.intro-block'); await page.waitForTimeout(150); }
console.log('== pick first Boo (scripted first reward) ==');
await page.waitForSelector('.firstpick-row');
await page.click('.firstpick-card');                 // no keyboard
await page.waitForSelector('.town2');
await page.evaluate(() => window.BooTown.go('hub'));
await page.waitForSelector('.hub');
let save = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')));
assert(save.opened === 1, 'first Boo chosen during onboarding');
assert(Object.keys(save.inventory).length === 1 && save.boxes === 0, 'owns exactly the chosen first Boo, no free box');

console.log('== play all three games (perfect rounds) ==');
await playBubble(1);
await page.click('.result-btns .btn.soft'); // back to hub
await page.waitForSelector('.hub');
await playFeed(1);
// after 2 perfect rounds meter should have banked a box -> open from results if offered
const giftOnResults = await page.$('.result-gift .btn');
if (giftOnResults) { await giftOnResults.click(); await openCeremony(); await page.waitForSelector('.hub'); }
else { await page.click('.result-btns .btn.soft'); await page.waitForSelector('.hub'); }
await playSpell(1);
await page.click('.result-btns .btn.soft');
await page.waitForSelector('.hub');

// if a box is ready on the hub, open it (ensures 2 boxes opened)
save = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')));
if (save.boxes > 0) { await page.click('.gift-btn', { force: true }); await openCeremony(); await page.waitForSelector('.hub'); save = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1'))); }

console.log('== checks ==');
assert(save.opened >= 2, 'opened at least two boxes across the run (' + save.opened + ')');
assert(save.stars.byGame.bubblepop.plays >= 1 && save.stars.byGame.feedboos.plays >= 1 && save.stars.byGame.spellboo.plays >= 1, 'all three games played');
assert(Object.keys(save.inventory).length >= 1, 'owns Boos/items');
assert(keystrokes === 1, 'keyboard used exactly once (the name field) — got ' + keystrokes);
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors across the whole run');

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
