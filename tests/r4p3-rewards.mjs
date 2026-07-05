// tests/r4p3-rewards.mjs — RUN4 phase 3 (C3): the reward rebalance.
// Acceptance (RUN4 part D #5): a simulated day shows the Brave bonus paying +1 once
// per category, cosy rounds capping at 2 meter points, total stars always crediting
// in full, the exemptions (Golden Round, Smart Mix / Pick for me) honoured, and no
// UI string ever framing a round as worth less. Plus: the v4→v5 save migration is
// lossless and the backup code round-trips.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 4, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} },
  ledger: {}, spellingMastery: {}, trickyPile: [],
  settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch();
async function fresh(save, day = '2026-07-05') {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript((d) => { window.__bootownDay = d; }, day);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

// Play a full correct Spell Boo round via the __spell hook. Returns when results show.
async function playSpellRound(page, setName, levelIdx) {
  await page.evaluate(() => window.BooTown.go('spellboo'));
  await page.waitForSelector('.picker');
  // expand any groups so the set card is clickable at the Full tier
  await page.$$eval('.pg-head', hs => hs.forEach(h => h.dataset.open === 'true' || h.click())).catch(() => {});
  await page.click(`.picker-choice:has-text("${setName}")`);
  await page.click(`.picker-levels .level-btn >> nth=${levelIdx}`);
  await page.waitForSelector('.spell-area, .spell-stage');
  await sleep(150);
  for (let g = 0; g < 26; g++) {
    if (await page.$('.result-card')) break;
    await page.evaluate(() => window.__spell.typeCorrect());
    await sleep(1200);
  }
  await page.waitForSelector('.result-card', { timeout: 15000 });
  await sleep(700);
}
const meterOf = (page) => page.evaluate(() => window.BooTown.State.getState().meter);
const totalOf = (page) => page.evaluate(() => window.BooTown.State.getState().stars.total);
// the bubble fills only after the stars animate in — poll for text
const bubbleText = async (page) => {
  for (let i = 0; i < 20; i++) {
    const t = await page.$eval('.result-bubble', n => n.textContent).catch(() => '');
    if (t) return t;
    await sleep(300);
  }
  return '';
};

// ================= migration: v4 → v5, lossless + backup round-trip =================
console.log('== v5 migration ==');
{
  const { ctx, page } = await fresh(SAVE({ stars: { total: 137, byGame: {} }, inventory: { boo_inky: 2, deco_pond: 1 } }));
  const s = await page.evaluate(() => window.BooTown.State.getState());
  assert(s.version === 5, 'save migrates to version 5 (' + s.version + ')');
  assert(s.stars.total === 137 && s.inventory.boo_inky === 2 && s.inventory.deco_pond === 1, 'migration is lossless (stars + inventory intact)');
  assert(s.threeStars && typeof s.threeStars === 'object', 'threeStars field present');
  assert(s.brave && 'day' in s.brave && 'cats' in s.brave, 'brave claims field present');
  assert(s.gameThrees && typeof s.gameThrees === 'object', 'gameThrees medal counters present (start empty)');
  assert(s.chest && s.chest.anchor === 137 && s.chest.welcome === true, 'migrated save gets chest anchor at current total + welcome flag (C8 prep)');
  // backup code round-trips across the bump
  const rt = await page.evaluate(() => {
    return import('./js/state.js').then(m => {
      const norm = (o) => JSON.stringify({ ...o, lastPlayed: 0 });   // import legitimately touches lastPlayed
      const code = m.exportCode();
      const before = norm(m.getState());
      const res = m.importCode(code);
      return { ok: res.ok, same: norm(m.getState()) === before };
    });
  });
  assert(rt.ok && rt.same, 'grown-ups backup code round-trips across the v5 bump');
  await ctx.close();
}
{
  // fresh save (no migration): anchor 0, no welcome chest
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil: 'load' });
  await page.click('button:has-text("Start")');
  await page.fill('input.text-input', 'Zip');
  await page.click('button:has-text("Next")');
  await page.waitForSelector('.ob-age-grid');
  await page.click('.ob-age-btn:has-text("8")');
  await page.click('.creator-btns .btn.big');
  await page.waitForSelector('.intro-block');
  const s = await page.evaluate(() => window.BooTown.State.getState());
  assert(s.version === 5 && s.chest && s.chest.welcome === false, 'a brand-new save gets no welcome chest (anchor 0)');
  await ctx.close();
}

// ================= the simulated day =================
console.log('== Brave bonus: +1, once per category per day ==');
{
  // Th Words has tiers [1] only... use The Big List (tiers 1..3): Level 2 round is above default comfort (1).
  const { ctx, page } = await fresh(SAVE());
  const t0 = await totalOf(page);
  await playSpellRound(page, 'The Big List', 1);   // Level 2 (levels list: 1,2,3 → idx 1)
  const m1 = await meterOf(page), t1 = await totalOf(page);
  assert(t1 - t0 === 3, 'total stars credit in full on a brave round (+3)');
  assert(m1 === 5, `brave 3-star round banks 3 + 1 (3★ bonus) + 1 (Brave) = 5 meter (got ${m1})`);
  const line1 = await bubbleText(page);
  assert(/BRAVE/.test(line1) && /sparkle/i.test(line1), `brave line shown ("${line1}")`);
  // second Level-2 round, same category, same day: full base, no second bonus
  await playSpellRound(page, 'The Big List', 1);
  const m2 = await meterOf(page);
  assert(m2 === 5 + 4 - 6, `same category, same day: base 4 only, no second Brave (+4 → wrapped, meter ${m2})`);
  const boxes = await page.evaluate(() => window.BooTown.State.getState().boxes);
  assert(boxes === 1, 'meter wrapped into a box (economy plumbing intact)');
  // a DIFFERENT category still gets its own Brave the same day
  await playSpellRound(page, 'Th Words', 0);   // Th Words levels: [1] → idx 0 = Level 1; rank 1 = comfort → NOT brave
  const line3 = await bubbleText(page);
  assert(!/BRAVE/.test(line3), 'a Level-1 round (at comfort) is not Brave');
  await ctx.close();
}

console.log('== comfort grows after two 3-star rounds ==');
{
  const { ctx, page } = await fresh(SAVE());
  const r = await page.evaluate(() => import('./js/comfort.js').then(m => {
    const st = window.BooTown.State;
    st.mutate(s => { s.threeStars = { 'spellboo:big:2': 2 }; });
    return { c2: m.comfortRank('spellboo', 'big'), cDefault: m.comfortRank('spellboo', 'trickyTh') };
  }));
  assert(r.c2 === 2, 'two 3-star rounds at Level 2 lift comfort to 2');
  assert(r.cDefault === 1, 'untouched categories default to Level 1 comfort');
  // now a Level-2 round is AT comfort — no brave line
  await playSpellRound(page, 'The Big List', 1);
  const line = await bubbleText(page);
  assert(!/BRAVE/.test(line), 'a round at the new comfort level is no longer Brave');
  await ctx.close();
}

// Master every Th Word in the live ledger (rights 5, misses 0 → mastered).
const masterTh = (page) => page.evaluate(() => import('./data/spellingBanks.js').then(m => {
  const th = m.BANKS.find(b => b.id === 'trickyTh');
  window.BooTown.State.mutate(s => { th.words.forEach(w => { s.ledger[w.w] = { rights: 5, misses: 0, lastSeen: 1 }; }); });
}));

console.log('== cosy rounds: mastered ≤ comfort caps at 2, stars still full ==');
{
  const { ctx, page } = await fresh(SAVE());
  await masterTh(page);
  const t0 = await totalOf(page);
  await playSpellRound(page, 'Th Words', 0);   // Level 1, everything mastered → cosy
  const m = await meterOf(page), t1 = await totalOf(page);
  assert(t1 - t0 === 3, 'total stars credit in full on a cosy round (+3)');
  assert(m === 2, `cosy round contributes at most 2 meter points (got ${m})`);
  const line = await bubbleText(page);
  assert(/Level 2/.test(line) && /sparkle/i.test(line) && /warm-up|Cosy/i.test(line), `cosy line is the upward nudge ("${line}")`);
  assert(!/less|only worth|smaller|shrunk/i.test(line), 'no string frames the round as worth less');
  await ctx.close();
}

console.log('== exemptions: Pick for me / Smart Mix never capped ==');
{
  const { ctx, page } = await fresh(SAVE());
  await masterTh(page);
  const r = await page.evaluate(() => import('./js/comfort.js').then(m => {
    const s = window.BooTown.State.getState();
    const keys = Object.keys(s.ledger);           // every key is mastered (seeded above)
    const mix = m.meterPointsFor({ game: 'spellboo', cat: null, level: null, mix: true, stars: 3, roundKeys: keys });
    const normal = m.meterPointsFor({ game: 'spellboo', cat: 'trickyTh', level: 1, stars: 3, roundKeys: keys });
    return { mix, normal };
  }));
  assert(!r.mix.cosy && r.mix.points === 4, `a Pick for me round over mastered content banks full points (got ${r.mix.points}, cosy ${r.mix.cosy})`);
  assert(r.normal.cosy && r.normal.points === 2, `the same content as a picked cosy round caps at 2 (got ${r.normal.points})`);
  await ctx.close();
}

console.log('== brave claims reset on a new local day ==');
{
  const { ctx, page } = await fresh(SAVE());
  const r = await page.evaluate(() => import('./js/comfort.js').then(m => {
    const out = [];
    out.push(m.meterPointsFor({ game: 'bubblepop', cat: 'tables', level: 2, stars: 2, roundKeys: [] }).brave);   // true (+1)
    out.push(m.meterPointsFor({ game: 'bubblepop', cat: 'tables', level: 2, stars: 2, roundKeys: [] }).brave);   // false (claimed)
    out.push(m.meterPointsFor({ game: 'bubblepop', cat: 'bonds', level: 2, stars: 2, roundKeys: [] }).brave);    // true (other cat)
    window.__bootownDay = '2026-07-06';                                                                          // next day
    out.push(m.meterPointsFor({ game: 'bubblepop', cat: 'tables', level: 2, stars: 2, roundKeys: [] }).brave);   // true again
    return out;
  }));
  assert(JSON.stringify(r) === JSON.stringify([true, false, true, true]), 'Brave pays once per category per day, per category, resetting daily (' + JSON.stringify(r) + ')');
  await ctx.close();
}

console.log('== quest stretch templates exist ==');
{
  const { ctx, page } = await fresh(SAVE());
  const q = await page.evaluate(() => import('./js/quests.js').then(m => m.QUEST_TEMPLATES.map(t => t.id)));
  assert(q.includes('brave2') && q.includes('braveTry'), 'stretch quests present (' + q.join(',') + ')');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nr4p3-rewards: FAIL' : '\nr4p3-rewards: ALL PASS');
process.exit(failed ? 1 : 0);
