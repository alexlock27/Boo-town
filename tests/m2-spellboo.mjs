// tests/m2-spellboo.mjs — Spell Boo: peek, tile spelling, perfect round, mastery.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

async function clickTile(page, letter) {
  return page.evaluate((l) => {
    const t = [...document.querySelectorAll('.tile')].find(x => x.style.visibility !== 'hidden' && x.textContent === l);
    if (t) { t.click(); return true; }
    return false;
  }, letter);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 1, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } }, name: 'Maya', guide: { body: 'lilac', patch: 'pink', acc: 'headphones', name: 'Twiggy' }, settings: { sound: true, music: true, voice: true } })));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hub');
await page.evaluate(() => window.BooTown.go('spellboo'));

console.log('== start -> level 1 ==');
await page.waitForSelector('.start-card');
await page.click('.level-btn');
await page.waitForSelector('.slots-wrap');
await page.waitForTimeout(400);

console.log('== auto-look reveals the word for free (RUN3 C1) ==');
// The word auto-shows once at the start (the free "look"); we do NOT press Peek here,
// because Peek now counts as a hint and would cap the round at 2 stars.
const peekVisible = await page.evaluate(() => { const p = document.querySelector('.peek-word'); return p && p.style.visibility !== 'hidden' && p.textContent.length > 0; });
assert(peekVisible, 'auto-look shows the word for free');
await page.screenshot({ path: 'screenshots/m2-spellboo-mid.png' });
await page.waitForTimeout(2100); // let auto-look hide before spelling from memory

console.log('== spell 8 words perfectly ==');
let wordsSpelled = 0;
for (let w = 0; w < 8; w++) {
  if (await page.$('.result-card')) break;
  await page.waitForSelector('.slots-wrap');
  const word = await page.getAttribute('.slots-wrap', 'data-word');
  if (!word) { assert(false, 'read word'); break; }
  for (const ch of word) { await clickTile(page, ch); await page.waitForTimeout(70); }
  wordsSpelled++;
  // wait for advance (data-word changes) or results
  await page.waitForFunction((prev) => {
    if (document.querySelector('.result-card')) return true;
    const sw = document.querySelector('.slots-wrap');
    return sw && sw.dataset.word !== prev;
  }, word, { timeout: 6000 }).catch(() => {});
}
assert(wordsSpelled === 8, 'spelled 8 words (' + wordsSpelled + ')');

await page.waitForSelector('.result-card', { timeout: 6000 });
await page.waitForTimeout(1600);
const stars = await page.evaluate(() => document.querySelectorAll('.rstar.pop').length);
assert(stars === 3, 'perfect spelling round = 3 stars (got ' + stars + ')');
const save = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')));
assert(save.stars.byGame.spellboo.best === 3, 'spellboo best=3 saved');
assert(Object.values(save.spellingMastery).reduce((a, b) => a + b, 0) >= 8, 'mastery counts recorded for spelled words');

console.log('== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
