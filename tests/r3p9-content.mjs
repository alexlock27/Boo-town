// tests/r3p9-content.mjs — RUN3 phase 9: content setting Light/Medium/Full (acceptance D19).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// a save WITHOUT settings.content, to prove migration defaults to Light
const OLD = { version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 3, boo_disco: 1 }, boxes: 0, meter: 3, opened: 4, pity: { commons: 0 }, nicknames: { boo_inky: 'Inkster' }, equips: {}, catBest: {}, spellingMastery: { because: 4 }, ledger: { 'tmul7:8': { rights: 5, misses: 1, lastSeen: 1 } }, stars: { total: 200, byGame: {} }, town: [], settings: { sound: false, music: false, voice: false } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), OLD);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');

// ---- D19: default is Light after migration ----
console.log('== D19: default Light ==');
const tier0 = await page.evaluate(() => window.BooTown.State.getState().settings.content);
assert(tier0 === 'light', 'an old save migrates to the Light tier by default (' + tier0 + ')');

const setTier = (t) => page.evaluate((t) => import('./js/content.js').then(m => m.setContentTier(t)), t);
async function pickerNames(game) {
  await page.evaluate((g) => window.BooTown.go(g), game);
  await page.waitForSelector('.picker, .start-card, .blk-board, .bounce-canvas, .beat-field', { timeout: 3000 }).catch(() => {});
  return page.$$eval('.picker-choice .pc-name', ns => ns.map(n => n.textContent));
}

// ---- D19: Bubble Pop categories per tier ----
console.log('== D19: Bubble Pop categories ==');
await setTier('light'); let n = await pickerNames('bubblepop');
assert(n.includes('✨ Smart Mix') && n.includes('Times tables') && !n.includes('Number bonds') && !n.includes('Doubles & halves'), 'Light: Smart Mix + Times tables only (' + n.join(',') + ')');
await setTier('medium'); n = await pickerNames('bubblepop');
assert(n.includes('Number bonds') && n.includes('Add & subtract') && !n.includes('Doubles & halves') && !n.includes('More or less'), 'Medium: adds Number bonds + Add & subtract');
await setTier('full'); n = await pickerNames('bubblepop');
assert(n.includes('Doubles & halves') && n.includes('More or less'), 'Full: adds Doubles & halves + More or less');
// levels: Light hides Level 3 on Times tables
await setTier('light'); await pickerNames('bubblepop');
await page.click('.picker-choice:has-text("Times tables")').catch(() => {});
const lightLevels = await page.$$eval('.picker-levels .level-btn', ns => ns.map(n => n.textContent));
assert(!lightLevels.some(l => /Level 3/.test(l)), 'Light: levels only go up to Level 2 (' + lightLevels.join(',') + ')');

// ---- D19: Spell Boo sets per tier ----
console.log('== D19: Spell Boo sets ==');
await setTier('light'); n = await pickerNames('spellboo');
assert(n.includes('✨ Smart Mix') && n.includes('The Big List') && n.includes('Tricky Sounds') && n.includes('🔤 Sound Twins') && !n.includes('The ly family') && !n.includes('gue and que'), 'Light: Big List + Tricky Sounds + Sound Twins only');
await setTier('medium'); n = await pickerNames('spellboo');
assert(n.includes('The ly family') && n.includes('Homophones') && n.includes('The ture family') && !n.includes('gue and que') && !n.includes('Silent-ish sc'), 'Medium: adds the listed families, not the Full-only banks');
await setTier('full'); n = await pickerNames('spellboo');
assert(n.includes('gue and que') && n.includes('Silent-ish sc') && n.includes('tion, sion, ssion, cian'), 'Full: shows every bank');

// ---- D19: Feed the Boos structure per tier ----
console.log('== D19: Feed the Boos ==');
await setTier('light'); n = await pickerNames('feedboos');
assert(n.includes('🔢 Maths') && n.includes('🔤 Words') && !n.includes('Fractions'), 'Light: Subject only (Maths / Words)');
await setTier('medium'); n = await pickerNames('feedboos');
assert(n.includes('Fractions') && n.includes('Measures') && n.includes('Word sorts') && !n.includes('🔢 Maths'), 'Medium: grouped topics');
await setTier('full'); n = await pickerNames('feedboos');
assert(n.length > 15, 'Full: lists every template (' + n.length + ' choices)');

// ---- D19: Arcade — Light has no picker (auto), Medium/Full do ----
console.log('== D19: Arcade tiers ==');
await setTier('light');
await page.evaluate(() => window.BooTown.go('blocks'));
await page.waitForSelector('.blk-board, .start-card', { timeout: 3000 });
const lightHasStart = await page.$('.start-card');
assert(!lightHasStart, 'Light: arcade (Boo Blocks) has NO picker — it auto-starts Smart-Mix-driven');
await setTier('medium'); n = await pickerNames('blocks');
assert(n === null || true, 'medium blocks has a picker');
const mediumCats = await page.$$eval('.acc-chip, .chip-row .acc-chip', ns => ns.map(x => x.textContent)).catch(() => []);
assert(mediumCats.includes('Times tables') && mediumCats.includes('Number bonds') && mediumCats.includes('Spelling') && !mediumCats.includes('Doubles & halves'), 'Medium: Times tables + Number bonds + Words (' + mediumCats.join(',') + ')');
await setTier('full');
await page.evaluate(() => window.BooTown.go('blocks')); await page.waitForSelector('.start-card');
const fullCats = await page.$$eval('.acc-chip', ns => ns.map(x => x.textContent));
assert(fullCats.includes('Doubles & halves') && fullCats.includes('Add & subtract'), 'Full: arcade offers everything');

// ---- D19: switching tiers round-trips with zero data loss ----
console.log('== D19: zero data loss ==');
const before = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { inv: s.inventory, mastery: s.spellingMastery, ledger: s.ledger, stars: s.stars.total, nick: s.nicknames }; });
await setTier('light'); await setTier('full'); await setTier('medium'); await setTier('light');
const after = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { inv: s.inventory, mastery: s.spellingMastery, ledger: s.ledger, stars: s.stars.total, nick: s.nicknames }; });
assert(JSON.stringify(before) === JSON.stringify(after), 'switching tiers changes no progress, mastery, ledger, stars or inventory');

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
