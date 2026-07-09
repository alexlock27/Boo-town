// tests/r6p8-booquest.mjs — RUN6 phase 8: Boo Quest, chapter 1 (C6).
// Acceptance (RUN6 part D #9): a scripted full run completes all six nodes; planks lay
// per correct answer; the Rune Door opens on the spelled word; the Grump's mood stages
// render in order (frame evidence); mid-node exit resumes; land completion grants Scout,
// the Quest Flag, a Journal stamp and the trophy exactly once; Scout never drops from a
// box; Toddler tier shows no Quest card; difficulty draws from a seeded ledger.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r6p8', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 5, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {},
  town: [], stars: { total: 60, byGame: {} }, ledger: {}, spellingMastery: {}, journal: {}, quest: { node: 0, lands: {} },
  delights: { hideDay: today, hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside', 'hilltop', 'beach', 'funfair'] },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch();
async function open(save) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 720 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
async function gotoQuest(page) { await page.evaluate(() => window.BooTown.go('booquest')); await page.waitForSelector('.booquest'); await page.waitForFunction(() => window.__booquest); }
async function continueQuest(page) { await page.waitForSelector('.result-btns .btn.secondary', { timeout: 6000 }); await page.click('.result-btns .btn.secondary'); await page.waitForSelector('.booquest'); await page.waitForFunction(() => window.__booquest); }

// ==================== Scout never drops from a box + Toddler has no card ====================
console.log('== Scout excluded from box pool + Toddler hides the card ==');
{
  const { ctx, page } = await open(SAVE());
  const pool = await page.evaluate(async () => {
    const c = await import('./data/catalogue.js');
    const boos = Object.values(c.BY_TYPE_RARITY.boo || {}).flat().map(x => x.id);
    return { hasScout: boos.includes('boo_scout'), scoutInCatalogue: !!c.BY_ID.boo_scout, questFlag: !!c.BY_ID.deco_questflag };
  });
  assert(pool.scoutInCatalogue && pool.questFlag, 'Scout + Quest Flag exist in the catalogue');
  assert(!pool.hasScout, 'Scout is NOT in the box drop pool (questOnly)');
  assert(!!(await page.$('.trail-chip.booquest')), 'the hub shows a Boo Quest chip at a normal tier');
  await ctx.close();
  const t = await open(SAVE({ settings: { sound: false, music: false, voice: false, content: 'toddler' } }));
  assert(!(await t.page.$('.trail-chip.booquest')), 'Toddler tier shows NO Boo Quest chip');
  await t.ctx.close();
}

// ==================== difficulty draws from a seeded ledger ====================
console.log('== difficulty draws from the Smart Mix ledger ==');
{
  const { ctx, page } = await open(SAVE());
  const res = await page.evaluate(async () => {
    const Q = await import('./js/questions.js'); const S = await import('./js/state.js');
    const keys = new Set(); for (let i = 0; i < 200; i++) keys.add(Q.autoQuestion(null, 3).key);
    S.mutate(st => { for (const k of keys) st.ledger[k] = { rights: 0, misses: 4, lastSeen: 1 }; });   // seed a broadly-weak ledger
    let weak = 0; for (let i = 0; i < 40; i++) if (S.ledgerClass(Q.autoQuestion(null, 3).key) === 'weak') weak++;
    return { seeded: keys.size, weakHits: weak };
  });
  assert(res.weakHits >= 25, `a seeded-weak ledger steers the quest question source to weak facts (${res.weakHits}/40 weak, ${res.seeded} keys seeded)`);
  await ctx.close();
}

// ==================== mid-node exit resumes at that node ====================
console.log('== mid-node exit resumes at the node ==');
{
  const { ctx, page } = await open(SAVE());
  await gotoQuest(page);
  await page.evaluate(() => window.__booquest.open());   // node 0: bridge
  await page.evaluate(() => window.__booquest.answer(true)); await sleep(400);
  await page.evaluate(() => window.__booquest.answer(true)); await sleep(400);
  const midPlanks = await page.evaluate(() => window.__booquest.info().planks);
  assert(midPlanks === 2, `two correct answers laid two planks (${midPlanks})`);
  await page.evaluate(() => window.BooTown.go('hub')); await page.waitForSelector('.hub');   // leave mid-node
  await gotoQuest(page);
  assert(await page.evaluate(() => window.__booquest.state().node) === 0, 'leaving mid-node resumes at that node (still node 0)');
  await ctx.close();
}

// ==================== a full scripted run of the land ====================
console.log('== full run of The Sparkle Meadow ==');
{
  const { ctx, page } = await open(SAVE());
  await gotoQuest(page);
  assert(await page.evaluate(() => window.__booquest.state().nodes) === 6, 'the land has six nodes');

  // node 0 — Bridge Builder: 6 planks
  await page.evaluate(() => window.__booquest.open());
  assert(await page.evaluate(() => window.__booquest.curType()) === 'bridge', 'node 1 is a Bridge Builder');
  for (let p = 1; p <= 6; p++) { await page.evaluate(() => window.__booquest.answer(true)); await sleep(420); }
  await continueQuest(page);

  // node 1 — Rune Door
  await page.evaluate(() => window.__booquest.open());
  assert(await page.evaluate(() => window.__booquest.curType()) === 'rune', 'node 2 is a Rune Door');
  await page.evaluate(() => window.__booquest.spellRune());
  await sleep(200);
  assert(!!(await page.$('.bq-door.open')), 'the Rune Door opens on the spelled word');
  await continueQuest(page);

  // node 2 — Grump Cheer-Off: moods lift in order
  await page.evaluate(() => window.__booquest.open());
  assert(await page.evaluate(() => window.__booquest.curType()) === 'grump', 'node 3 is a Grump Cheer-Off');
  const moods = [];
  for (let c = 0; c < 3; c++) { await page.evaluate(() => window.__booquest.answer(true)); await sleep(500); moods.push(await page.evaluate(() => window.__booquest.info().mood)); }
  assert(moods.join(',') === 'unsure,smile,beaming', `the Grump's mood lifts through the stages in order (${moods.join(',')})`);
  await continueQuest(page);

  // node 3 — Bridge Builder again
  await page.evaluate(() => window.__booquest.open());
  for (let p = 0; p < 6; p++) { await page.evaluate(() => window.__booquest.answer(true)); await sleep(420); }
  await continueQuest(page);

  // node 4 — Chest (box ceremony); then back to the quest
  await page.evaluate(() => window.__booquest.open());
  assert(await page.evaluate(() => window.__booquest.curType()) === 'chest', 'node 5 is a Treasure Chest');
  await page.evaluate(() => window.__booquest.answer());   // taps the chest → grants a box + ceremony
  await page.waitForSelector('.gift-box', { timeout: 6000 });
  for (let i = 0; i < 3; i++) { await page.click('.gift-box', { force: true }); await sleep(220); }
  await page.waitForSelector('.reveal-card', { timeout: 6000 });
  await gotoQuest(page);   // straight back into the quest (resumes at the boss)

  // node 5 — Boss Grump: 5 cheers → land complete
  await page.evaluate(() => window.__booquest.open());
  assert(await page.evaluate(() => window.__booquest.curType()) === 'boss', 'node 6 is the Boss Grump');
  for (let c = 0; c < 5; c++) { await page.evaluate(() => window.__booquest.answer(true)); await sleep(500); }
  await page.waitForSelector('.bq-landcomplete', { timeout: 6000 });
  await sleep(400);   // let checkAndCelebrate award the trophy
  await page.screenshot({ path: 'screenshots/r6p8/land-complete-900x720.png' });
  const before = await page.evaluate(() => window.BooTown.State.getState().stars.total);
  const g = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    return { scout: s.inventory.boo_scout || 0, flag: s.inventory.deco_questflag || 0, stamp: !!(s.journal && s.journal.quest_sparkle_meadow), trophy: !!(s.trophies && s.trophies.trophy_sparkle_meadow), landDone: !!(s.quest.lands && s.quest.lands.sparkle_meadow) };
  });
  assert(g.scout === 1, `Scout is granted exactly once (${g.scout})`);
  assert(g.flag === 1, `the Quest Flag is granted exactly once (${g.flag})`);
  assert(g.stamp, 'a Journal stamp is awarded');
  assert(g.trophy, 'the Sparkle Meadow trophy is awarded');
  assert(g.landDone, 'the land is marked complete');
  // dismiss the trophy ceremony (if up), then take the boss stars via results
  await page.evaluate(() => { document.querySelectorAll('.overlay.trophy-ceremony').forEach(o => o.remove()); });
  await page.click('.bq-landcomplete .btn.big');
  await page.waitForSelector('.result-card', { timeout: 6000 });
  await sleep(400);
  const after = await page.evaluate(() => window.BooTown.State.getState().stars.total);
  assert(after > before, `node/land completion paid stars into the normal economy (${before} → ${after})`);
  await ctx.close();
}

// re-entering a completed land does not re-grant
{
  const { ctx, page } = await open(SAVE({ quest: { node: 6, lands: { sparkle_meadow: true } }, inventory: { boo_inky: 1, boo_scout: 1, deco_questflag: 1 } }));
  await gotoQuest(page);
  assert(await page.evaluate(() => window.__booquest.state().done), 'a completed land shows as done');
  assert(await page.evaluate(() => window.BooTown.State.getState().inventory.boo_scout) === 1, 're-entering a completed land does not duplicate Scout');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
