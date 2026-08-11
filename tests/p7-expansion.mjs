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
const SAVE = (o) => JSON.stringify({ version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 200, byGame: {} }, settings: { sound: false, music: false, voice: false, content: 'full' }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true }, trophies: { medal_stars_100: '2026-07-01', trophy_zones: '2026-07-01' }, ...o });
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
// RUN4 C2: Full-tier set cards sit under collapsible headers — open them first
await page.$$eval('.pg-head', hs => hs.forEach(h => h.dataset.open === 'true' || h.click()));
await page.click('.picker-choice:has-text("Homophones")');
await page.click('.picker-levels .level-btn');
await page.waitForSelector('.slots-wrap'); await page.waitForTimeout(200);
const clue = await page.evaluate(() => { const c = document.querySelector('.spell-clue'); return c && c.style.display !== 'none' ? c.textContent : null; });
assert(clue && /_/.test(clue), 'a homophone clue sentence with a blank is shown (' + clue + ')');
// spell the current word from its slots data (voice off, no peek)
// RUN21v3 A-4: this returned `!!resultCard || …spellboo.plays >= 0` — a count can never be
// negative, so the assertion below could not fail, and on the branch where the round did NOT
// complete it read `.plays` off an undefined byGame entry and threw out of the evaluate
// instead. Both halves of the claim in its own name are now asserted for real: the round
// reaches a result card, and finishing it registers a play in the star ledger.
// The loop is per WORD, and waits for the word to actually change. The old one ran a fixed
// eight passes with a flat 500ms wait and called that "the round": a spelled word takes ~1.5s
// of celebration before the next appears, so three passes went on each word and the eight-word
// round (ROUND_WORDS, js/games/spellboo.js) never got past its third. It never showed, because
// the assertion it fed could not fail.
const spelled = await page.evaluate(async () => {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const card = () => !!document.querySelector('.result-card');
  const wordNow = () => { const w = document.querySelector('.slots-wrap'); return w ? w.dataset.word : null; };
  let words = 0;
  for (let w = 0; w < 8 && !card(); w++) {
    const word = wordNow();
    if (!word) break;
    let placed = 0;
    for (const ch of word) { const t = [...document.querySelectorAll('.tile')].find(x => x.style.visibility !== 'hidden' && x.textContent === ch); if (t) { t.click(); placed++; } await sleep(30); }
    if (placed !== word.length) break;              // a word we could not spell is a real failure
    words++;
    for (let i = 0; i < 40 && !card() && wordNow() === word; i++) await sleep(100);   // ≤4s for the next word
  }
  const g = (window.BooTown.State.getState().stars.byGame || {}).spellboo;
  return { card: card(), words, plays: (g && g.plays) || 0 };
});
assert(spelled.card, `homophone round is playable to completion without voice or Peek (${spelled.words} words spelled, result card ${spelled.card ? 'reached' : 'NEVER reached'})`);
assert(spelled.plays >= 1, `and completing it registers a play in the star ledger (plays ${spelled.plays})`);

// §6.5 — seasonal gating by simulated month
console.log('== 6.5 seasonal gating ==');
const seasonTest = await page.evaluate(async () => {
  const rw = await import('./js/rewards.js'); const st = await import('./js/state.js'); const cat = await import('./data/catalogue.js');
  function dropsFor(month) {
    window.__bootownMonth = month;
    localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 3, name: 'A', guide: { species: 'giraffe', body: 'sunshine', pattern: 'none', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1 }, boxes: 4000, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 0, byGame: {} }, settings: {}, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } } }));
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
  localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 3, name: 'A', guide: { species: 'giraffe', body: 'sunshine', pattern: 'none', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: inv, boxes: 20000, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 0, byGame: {} }, settings: {}, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } } }));
  st.load();
  const seen = new Set(); const baseInv = { ...inv };
  for (let i = 0; i < 20000; i++) { const r = rw.openOneBox(); if (r && r.rarity === 'secret') seen.add(r.item.id); st.getState().inventory = { ...baseInv }; st.getState().boxes = 20000; st.getState().meter = 0; }
  return [...seen];
});
assert(secretsSeen.includes('boo_dj') && secretsSeen.includes('boo_twiglet'), 'both DJ Boo and Twiglet drop as Secret (' + secretsSeen.join(',') + ')');

// §6.7 — the collection shelf shows EVERY collectible, one tile each.
// RUN13 T4: the expected total is read from the catalogue rather than hardcoded. It was
// 70 (52 + 8 activity items + Scout + Quest Flag + 8 furniture) and went stale the moment
// twenty-four new pieces of furniture joined. The property this suite cares about is
// "one tile per collectible, and the counter agrees" — which is now what it checks.
console.log('== 6.7 collection: one slot per collectible ==');
await page.evaluate((s) => localStorage.setItem('bootown.save.v1', s), SAVE({ inventory: { boo_inky: 1 } }));
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub');
await page.evaluate(() => window.BooTown.go('collection')); await page.waitForSelector('.coll-grid');
const TOTAL = await page.evaluate(async () => (await import('./data/catalogue.js')).TOTAL_ITEMS);
const coll = await page.evaluate(() => ({ slots: document.querySelectorAll('.coll-grid:not(.wardrobe-grid) .coll-tile').length, count: document.querySelector('.coll-count').textContent }));
assert(TOTAL >= 90, `the catalogue's own total is the source of truth (${TOTAL})`);
assert(coll.slots === TOTAL, `collection shows one slot per collectible (${coll.slots} of ${TOTAL})`);
assert(new RegExp('of ' + TOTAL).test(coll.count), `counter shows "of ${TOTAL}" (${coll.count})`);

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
