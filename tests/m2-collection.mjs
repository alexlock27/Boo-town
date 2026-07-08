// tests/m2-collection.mjs — collection grid, item detail, edit-my-guide.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('bootown.save.v1', JSON.stringify({
  version: 1, name: 'Maya', guide: { body: 'sunshine', patch: 'indigo', acc: 'bow', name: 'Twiggy' },
  inventory: { boo_inky: 3, boo_beam: 1, boo_bubbles: 1, boo_disco: 1, deco_tree: 1 }
})));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hub');
await page.evaluate(() => window.BooTown.go('collection'));

await page.waitForSelector('.coll-grid');
await page.waitForTimeout(400);
await page.screenshot({ path: 'screenshots/m2-collection.png' });

// scope to the main collectibles grid (the wardrobe grid also uses .coll-tile).
// RUN4 C5 + RUN6 C6: 62 collectibles (52 + 8 activity items + Scout + Quest Flag).
const tiles = await page.evaluate(() => document.querySelectorAll('.coll-grid:not(.wardrobe-grid) .coll-tile').length);
assert(tiles === 62, 'grid shows all 62 slots (' + tiles + ')');
const owned = await page.evaluate(() => document.querySelectorAll('.coll-grid:not(.wardrobe-grid) .coll-tile.owned').length);
assert(owned === 5, '5 owned tiles in colour (' + owned + ')');
const locked = await page.evaluate(() => document.querySelectorAll('.coll-grid:not(.wardrobe-grid) .coll-tile.locked').length);
assert(locked === 57, '57 mystery silhouettes (' + locked + ')');
const countText = await page.textContent('.coll-count');
assert(countText.includes('5 of 62'), 'counter shows 5 of 62 (' + countText + ')');
const badge = await page.evaluate(() => !!document.querySelector('.coll-badge'));
assert(badge, 'a count badge shows for the item owned x3');

console.log('== tap an owned Boo -> detail (Dress up + Nickname) ==');
await page.click('.coll-grid:not(.wardrobe-grid) .coll-tile.owned');
await page.waitForSelector('.dialog');
const blurb = await page.evaluate(() => !!document.querySelector('.item-detail-blurb'));
assert(blurb, 'item detail card shows a blurb');
assert(await page.locator('.dialog .btn:has-text("Dress up")').count() > 0, 'Boo detail offers Dress up');
assert(await page.locator('.dialog .btn:has-text("Nickname")').count() > 0, 'Boo detail offers Nickname');
await page.click('.dialog .btn:has-text("Close")');
await page.waitForTimeout(250);
assert(await page.locator('.overlay').count() === 0, 'dialog closed cleanly');

console.log('== My character card -> creator -> save persists ==');
await page.click('.mychar-card');
await page.waitForSelector('.creator');
await page.screenshot({ path: 'screenshots/m2-editguide.png' });
// change species to penguin and body to the 3rd Colour swatch (sky), then save
await page.click('.cc-group:nth-child(1) .acc-chip:has-text("Penguin")');
const bodySwatches = await page.$$('.cc-group:nth-child(2) .swatch');
await bodySwatches[2].click();
await page.click('.creator-btns .btn.big'); // Save
await page.waitForSelector('.coll-grid', { timeout: 4000 }); // returns to collection
const save = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')));
assert(save.guide.body === 'sky', 'guide edit saved (body=' + save.guide.body + ')');
assert(save.guide.species === 'penguin', 'species change saved (' + save.guide.species + ')');

console.log('== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
