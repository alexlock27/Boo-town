// tests/m2-onboard.mjs — onboarding (guide creator + intro) -> free box ceremony.
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
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(400);

console.log('== splash -> name ==');
await page.click('.ob-splash .btn');
await page.fill('.text-input', 'Maya');
await page.click('.ob-name .btn');

console.log('== character creator (5-species rig) ==');
await page.waitForSelector('.creator');
// group order: 1 Animal, 2 Colour, 3 Pattern, 4 Pattern colour, 5 Eyes, 6 Accessory, 7 Name
async function pickChip(groupIdx, text) {
  await page.click(`.cc-group:nth-child(${groupIdx}) .acc-chip:has-text("${text}")`);
}
await pickChip(1, 'Kitten');                 // species
const colourSwatches = await page.$$('.cc-group:nth-child(2) .swatch');
await colourSwatches[1].click();             // lilac body
await pickChip(3, 'Spots');                  // pattern
await pickChip(5, 'Sparkle');                // eyes
await pickChip(6, 'Crown');                  // accessory
await page.waitForTimeout(250);
await page.screenshot({ path: 'screenshots/m2-creator.png' });
// shuffle then set the character's name
await page.click('.creator-btns .btn.soft');
await page.waitForTimeout(200);
await page.fill('.text-input.small', 'Zoomer');
await page.click('.creator-btns .btn.big'); // Done

console.log('== intro (3 bubbles) ==');
await page.waitForSelector('.intro-block');
await page.waitForTimeout(200);
await page.screenshot({ path: 'screenshots/m2-intro.png' });
await page.click('.intro-block'); await page.waitForTimeout(150);
await page.click('.intro-block'); await page.waitForTimeout(150);
await page.click('.intro-block'); // -> first pick

console.log('== pick your first Boo ==');
await page.waitForSelector('.firstpick-row');
await page.waitForTimeout(250);
await page.screenshot({ path: 'screenshots/m2-firstpick.png' });
const firstNames = await page.$$eval('.firstpick-name', els => els.map(e => e.textContent));
assert(JSON.stringify(firstNames) === JSON.stringify(['Inky', 'Lolly', 'Chomp']), 'first pick offers Inky/Lolly/Chomp');
await page.click('.firstpick-card');                 // pick the first Boo
await page.waitForSelector('.town2', { timeout: 4000 });

const save = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')));
assert(save.name === 'Maya', 'name saved');
assert(save.guide && save.guide.name === 'Zoomer', 'guide name saved (' + (save.guide && save.guide.name) + ')');
assert(save.guide && ['giraffe','puppy','kitten','penguin','bunny'].includes(save.guide.species), 'guide has a valid species (' + (save.guide && save.guide.species) + ')');
assert(Object.keys(save.inventory).length === 1, 'exactly the chosen Boo owned');
assert(save.opened === 1, 'opened count = 1 (the chosen Boo)');
assert(save.boxes === 0, 'no free random box — first reward is a chosen character');

// the guide walks her into the town to place her new friend
assert(await page.$('.town2'), 'lands in the town to place the new Boo');
await page.evaluate(() => window.BooTown.go('hub'));
await page.waitForSelector('.hub', { timeout: 4000 });
assert(true, 'reaches the hub');

console.log('== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
