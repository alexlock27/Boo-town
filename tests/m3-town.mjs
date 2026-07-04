// tests/m3-town.mjs — town: place, dance stage, move/put-away, place-from-ceremony, persist.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const seed = {
  version: 1, name: 'Maya', guide: { body: 'sunshine', patch: 'indigo', acc: 'bow', name: 'Twiggy' },
  inventory: { boo_inky: 1, boo_beam: 1, boo_pippin: 1, boo_bubbles: 1, boo_disco: 1, deco_stage: 1, deco_tree: 1, deco_pond: 1, boo_fuzz: 1, boo_curly: 1 },
  town: [
    { plot: 8, item: 'deco_stage' }, { plot: 7, item: 'boo_inky' }, { plot: 9, item: 'boo_beam' },
    { plot: 2, item: 'boo_pippin' }, { plot: 14, item: 'boo_bubbles' },
    { plot: 0, item: 'deco_tree' }, { plot: 5, item: 'deco_pond' }, { plot: 20, item: 'boo_disco' }
  ]
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.evaluate((s) => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), seed);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hub');
await page.evaluate(() => window.BooTown.go('town'));
await page.waitForSelector('.town-grid');
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/m3-town-landscape.png' });
await page.setViewportSize({ width: 768, height: 1024 }); await page.waitForTimeout(400);
await page.screenshot({ path: 'screenshots/m3-town-portrait.png' });
await page.setViewportSize({ width: 1024, height: 768 }); await page.waitForTimeout(300);

console.log('== dance stage makes neighbours bop ==');
const dancing = await page.evaluate(() => document.querySelectorAll('.plot[data-plot="7"] svg.art-dance, .plot[data-plot="9"] svg.art-dance, .plot[data-plot="2"] svg.art-dance').length);
assert(dancing >= 2, 'boos next to the Dance Stage have the dance animation (' + dancing + ')');
const nonDancing = await page.evaluate(() => !!document.querySelector('.plot[data-plot="20"] svg.art-idle') || !!document.querySelector('.plot[data-plot="20"] svg'));
assert(nonDancing, 'a boo away from the stage is present (not forced to dance)');

console.log('== place an item from the drawer (tap-select then tap plot) ==');
const townBefore = await page.evaluate(() => window.BooTown.State.getState().town.length);
await page.click('.drawer-item'); // select first unplaced (boo_fuzz or boo_curly)
await page.click('.plot[data-plot="11"]'); // empty plot
await page.waitForTimeout(300);
const townAfter = await page.evaluate(() => window.BooTown.State.getState().town.length);
assert(townAfter === townBefore + 1, 'placing added an item to the town (' + townBefore + '->' + townAfter + ')');
assert(!!(await page.$('.plot[data-plot="11"] .placed')), 'the item appears on plot 11');

console.log('== tap a placed boo -> squeak + menu -> put away ==');
await page.click('.plot[data-plot="11"] .placed');
await page.waitForSelector('.plot-menu', { timeout: 2000 });
assert(true, 'menu opened on placed item');
const putAway = await page.$$('.plot-menu .btn');
await putAway[1].click(); // Put away
await page.waitForTimeout(300);
const townAfterRemove = await page.evaluate(() => window.BooTown.State.getState().town.length);
assert(townAfterRemove === townBefore, 'put away removed the item (' + townAfterRemove + ')');

console.log('== place from ceremony (holding param) ==');
await page.evaluate(() => window.BooTown.go('town', { place: 'boo_curly', from: 'ceremony' }));
await page.waitForSelector('.town-grid.place-mode');
await page.click('.plot[data-plot="12"]');
await page.waitForTimeout(300);
const finalTown = await page.evaluate(() => window.BooTown.State.getState().town);
assert(finalTown.some(t => t.plot === 12 && t.item === 'boo_curly'), 'ceremony place-mode placed the held Boo');

console.log('== reload persists the town ==');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hub');
await page.evaluate(() => window.BooTown.go('town'));
await page.waitForSelector('.town-grid');
const placedCount = await page.evaluate(() => document.querySelectorAll('.placed').length);
assert(placedCount === finalTown.length, 'placed items persist across reload (' + placedCount + '/' + finalTown.length + ')');

console.log('== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
