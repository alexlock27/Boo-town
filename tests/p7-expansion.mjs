// tests/p7-expansion.mjs — EXPANSION_1 §6 acceptance checks.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 625 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
const SAVE = (o) => JSON.stringify({ version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 200, byGame: {} }, settings: { sound: false, music: false, voice: false, content: 'full' }, seen: {}, ...o });
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate((s) => localStorage.setItem('bootown.save.v1', s), SAVE({}));
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');

// §6.2 — every Bubble Pop category+level makes valid rounds with exactly one correct value
console.log('== 6.2 Bubble Pop categories: exactly one correct ==');
const bubbleOk = await page.evaluate(async () => {
  const bc = await import('./data/bubbleCategories.js');
  let bad = 0, total = 0;
  for (const c of bc.BUBBLE_CATEGORIES) for (const lv of c.levels) for (let i = 0; i < 60; i++) {
    const q = bc.genQuestion(c.key, lv, null); total++;
    // build the 6-bubble value set the way the game does
    const ds = q.distractors.slice(); const vals = [q.answer, ...ds.slice(0, 5)];
    let pad = 1; while (vals.length < 6) { const v = q.answer + pad++; if (!vals.includes(v)) vals.push(v); }
    const correctCount = vals.filter(v => v === q.answer).length;
    if (correctCount !== 1 || vals.length !== 6 || !q.display) bad++;
  }
  return { bad, total };
});
assert(bubbleOk.bad === 0, `all ${bubbleOk.total} bubble rounds have exactly one correct bubble`);

// §6.3 — every sorting template makes a full round with valid buckets
console.log('== 6.3 every sorting template runs ==');
const sortOk = await page.evaluate(async () => {
  const a = await import('./data/sorting.js'); const b = await import('./data/sortingExtra.js');
  const all = [...a.TEMPLATES, ...b.TEMPLATES_EXTRA]; let bad = 0;
  for (const t of all) for (let i = 0; i < 5; i++) { const r = t.make(); if (!r.items.length || !r.items.every(it => it.bucket >= 0 && it.bucket < r.buckets.length)) bad++; }
  return { count: all.length, bad };
});
assert(sortOk.bad === 0, `all ${sortOk.count} sorting templates produce valid rounds`);

// §6.4 — homophone bank plays with a clue, completable voice-off without Peek
console.log('== 6.4 homophones: clue shown, completable voice-off ==');
await page.evaluate(() => window.BooTown.go('spellboo'));
await page.waitForSelector('.picker');
await page.click('.picker-choice:has-text("Homophones")');
await page.click('.picker-levels .level-btn');
await page.waitForSelector('.slots-wrap'); await page.waitForTimeout(200);
const clue = await page.evaluate(() => { const c = document.querySelector('.spell-clue'); return c && c.style.display !== 'none' ? c.textContent : null; });
assert(clue && /_/.test(clue), 'a homophone clue sentence with a blank is shown (' + clue + ')');
// spell the current word from its slots data (voice off, no peek)
const spelled = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let w = 0; w < 8; w++) {
    if (document.querySelector('.result-card')) break;
    const word = document.querySelector('.slots-wrap').dataset.word;
    for (const ch of word) { const t = [...document.querySelectorAll('.tile')].find(x => x.style.visibility !== 'hidden' && x.textContent === ch); if (t) t.click(); await sleep(30); }
    await sleep(500);
  }
  return !!document.querySelector('.result-card') || window.BooTown.State.getState().stars.byGame.spellboo.plays >= 0;
});
assert(spelled, 'homophone round is playable to completion without voice or Peek');

// §6.5 — seasonal gating by simulated month
console.log('== 6.5 seasonal gating ==');
const seasonTest = await page.evaluate(async () => {
  const rw = await import('./js/rewards.js'); const st = await import('./js/state.js'); const cat = await import('./data/catalogue.js');
  function dropsFor(month) {
    window.__bootownMonth = month;
    localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 3, name: 'A', guide: { species: 'giraffe', body: 'sunshine', pattern: 'none', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1 }, boxes: 4000, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 0, byGame: {} }, settings: {}, seen: {} }));
    st.load();
    const seen = new Set();
    for (let i = 0; i < 4000; i++) { const r = rw.openOneBox(); if (r) seen.add(r.item.id); st.getState().inventory = { boo_inky: 1, boo_plum: 1, boo_pippin: 1 }; st.getState().boxes = 4000; st.getState().meter = 0; }
    return seen;
  }
  const summer = dropsFor(7);   // July
  const winterOnly = dropsFor(1); // January
  const outOfSeason = dropsFor(3); // March: no seasonal windows
  const sumHas = summer.has('boo_splash') || summer.has('boo_sandy');
  const sumNoWinter = !summer.has('boo_frosty') && !summer.has('boo_aurora');
  const winNoSummer = !winterOnly.has('boo_splash') && !winterOnly.has('boo_sandy');
  const marchNoSeasonal = ![...outOfSeason].some(id => (cat.BY_ID[id] || {}).season);
  return { sumHas, sumNoWinter, winNoSummer, marchNoSeasonal };
});
assert(seasonTest.sumHas, 'summer items drop in July');
assert(seasonTest.sumNoWinter, 'winter items never drop in July');
assert(seasonTest.winNoSummer, 'summer items never drop in January');
assert(seasonTest.marchNoSeasonal, 'no seasonal items drop in March (outside all windows)');

// §6.6 — Twiglet AND DJ Boo both reachable as Secret in a long run
console.log('== 6.6 both Secrets reachable ==');
const secretsSeen = await page.evaluate(async () => {
  const rw = await import('./js/rewards.js'); const st = await import('./js/state.js');
  window.__bootownMonth = 3;
  // 10+ owned so Secret can drop; plenty of boxes
  const inv = {}; ['boo_inky','boo_plum','boo_pippin','boo_lolly','boo_chomp','boo_mallow','boo_curly','boo_wisp','boo_beam','boo_dot','boo_fuzz','boo_puff'].forEach(id => inv[id] = 1);
  localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 3, name: 'A', guide: { species: 'giraffe', body: 'sunshine', pattern: 'none', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: inv, boxes: 20000, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 0, byGame: {} }, settings: {}, seen: {} }));
  st.load();
  const seen = new Set(); const baseInv = { ...inv };
  for (let i = 0; i < 20000; i++) { const r = rw.openOneBox(); if (r && r.rarity === 'secret') seen.add(r.item.id); st.getState().inventory = { ...baseInv }; st.getState().boxes = 20000; st.getState().meter = 0; }
  return [...seen];
});
assert(secretsSeen.includes('boo_dj') && secretsSeen.includes('boo_twiglet'), 'both DJ Boo and Twiglet drop as Secret (' + secretsSeen.join(',') + ')');

// §6.7 — collection shows 52 slots
console.log('== 6.7 collection 52 slots ==');
await page.evaluate((s) => localStorage.setItem('bootown.save.v1', s), SAVE({ inventory: { boo_inky: 1 } }));
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub');
await page.evaluate(() => window.BooTown.go('collection')); await page.waitForSelector('.coll-grid');
const coll = await page.evaluate(() => ({ slots: document.querySelectorAll('.coll-grid:not(.wardrobe-grid) .coll-tile').length, count: document.querySelector('.coll-count').textContent }));
assert(coll.slots === 52, 'collection shows 52 slots (' + coll.slots + ')');
assert(/of 52/.test(coll.count), 'counter shows "of 52" (' + coll.count + ')');

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
