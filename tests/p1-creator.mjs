// tests/p1-creator.mjs — RUN2 part E check 5:
// Old (v1) saves migrate to the new guide shape losslessly; species can be changed
// twice in a session with all progress, name and speech intact.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 625 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

// --- 1) Seed an OLD run-1 save (v1 giraffe guide) with real progress ---
const OLD = {
  version: 1, name: 'Maya',
  guide: { body: 'lilac', patch: 'pink', acc: 'crown', name: 'Twiggy' },
  stars: { total: 12, byGame: { bubblepop: { best: 3, plays: 2 }, feedboos: { best: 2, plays: 1 }, spellboo: { best: 0, plays: 0 } } },
  meter: 4, boxes: 1, opened: 5,
  inventory: { boo_inky: 2, boo_beam: 1, deco_tree: 1 },
  town: [{ plot: 7, item: 'boo_inky' }],
  spellingMastery: { believe: 2 },
  settings: { sound: true, music: true, voice: true }
};
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.evaluate((s) => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), OLD);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hub', { timeout: 5000 });

console.log('== old v1 save migrates losslessly ==');
let s = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')));
assert(s.version === 5, 'save version bumped to 5 (' + s.version + ')');   // v5: RUN4 C3 comfort/brave (+trophies/chest/etc.)
assert(s.guide.species === 'giraffe', 'guide.species defaults to giraffe');
assert(s.guide.body === 'lilac', 'body preserved');
assert(s.guide.patternColour === 'pink', 'old patch -> patternColour preserved (' + s.guide.patternColour + ')');
assert(s.guide.pattern === 'spots', 'old giraffe gets spots pattern');
assert(s.guide.acc === 'crown', 'accessory preserved');
assert(s.guide.name === 'Twiggy', 'guide name preserved');
assert(s.name === 'Maya', 'player name preserved');
assert(s.stars.total === 12 && s.stars.byGame.bubblepop.best === 3, 'stars preserved');
assert(s.inventory.boo_inky === 2 && s.inventory.boo_beam === 1 && s.inventory.deco_tree === 1, 'inventory preserved');
assert(s.meter === 4 && s.boxes === 1 && s.opened === 5, 'meter/boxes/opened preserved');
assert(Array.isArray(s.town) && s.town.length === 1, 'town placement preserved');
assert(s.spellingMastery.believe === 2, 'spelling mastery preserved');
assert(s.nicknames && s.equips, 'new nicknames/equips maps added');

// --- 2) Change species TWICE via the Collection creator ---
async function changeSpecies(speciesLabel) {
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.mychar-card');
  await page.click('.mychar-card');
  await page.waitForSelector('.creator');
  await page.click(`.cc-group:nth-child(1) .acc-chip:has-text("${speciesLabel}")`);
  await page.waitForTimeout(150);
  await page.click('.creator-btns .btn.big'); // Save
  await page.waitForSelector('.coll-grid', { timeout: 4000 });
}
await changeSpecies('Puppy');
s = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')));
assert(s.guide.species === 'puppy', 'first change -> puppy');
await changeSpecies('Penguin');
s = await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')));
assert(s.guide.species === 'penguin', 'second change -> penguin');

console.log('== progress intact after two species changes ==');
assert(s.name === 'Maya' && s.guide.name === 'Twiggy', 'names intact');
assert(s.stars.total === 12 && s.stars.byGame.bubblepop.best === 3, 'stars intact');
assert(s.inventory.boo_inky === 2 && s.inventory.deco_tree === 1, 'inventory intact');
assert(s.meter === 4 && s.boxes === 1, 'meter/boxes intact');
assert(Array.isArray(s.town) && s.town.length === 1, 'town intact');

// speech still works: reload to hub, guide greets by name
await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForSelector('.hub');
await page.waitForTimeout(400);
const bubbleText = await page.evaluate(() => document.querySelector('.hub-guide .speech-bubble')?.textContent || '');
assert(bubbleText.length > 0, 'guide speaks on hub after changes (' + JSON.stringify(bubbleText.slice(0, 30)) + ')');
await page.screenshot({ path: 'screenshots/p1-after-changes-hub.png' });

console.log('== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
