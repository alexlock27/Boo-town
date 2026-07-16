// tests/r4p6-growth.mjs — RUN4 phase 6 (C6): growth milestones + the Boo Builders.
// Acceptance (RUN4 part D #8): simulating 5 then 10 unique Boos spawns queued
// construction sites; a simulated 24 hours completes construction without a
// visit; the reveal ceremony and Journal stamps fire; upgrades never occupy
// used plots (they are scenery layers, and placed items stay put).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const BOOS = ['boo_inky', 'boo_plum', 'boo_pippin', 'boo_lolly', 'boo_chomp', 'boo_mallow', 'boo_curly', 'boo_wisp', 'boo_beam', 'boo_dot'];
// RUN10 P5: hide-and-seek 2.0 always assigns a hider once any Boo is placed (a guaranteed
// fallback spot exists even with no scenery) — suppress it here so boo_inky, this suite's
// one fixed test subject, is never the one tucked away invisible.
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const SAVE = (nBoos, over = {}) => {
  const inv = {};
  BOOS.slice(0, nBoos).forEach(b => { inv[b] = 1; });
  const AREAS_EMPTY = { meadow: { items: [], paths: [] }, riverside: { items: [], paths: [] }, hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] }, funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] } };
  return Object.assign({
    version: 6, name: 'Ada',
    guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
    inventory: inv, boxes: 0, meter: 0, opened: nBoos, pity: { commons: 0 },
    nicknames: {}, equips: {}, catBest: {},
    // sits exactly at the fountain spot (RUN10 P1: area-scoped, no zone-width rescale)
    town: { areas: Object.assign({}, AREAS_EMPTY, { meadow: { items: [{ zone: 'meadow', x: 0.46, row: 0, item: 'boo_inky' }], paths: [] } }) },
    stars: { total: 60, byGame: {} }, ledger: {},
    settings: { sound: false, music: false, voice: false, content: 'full' },
    seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, areasUnlocked: ['meadow', 'riverside'] },
    trophies: { medal_boos_10: '2026-07-01' },
    delights: { hideDay: TODAY, hideFound: true },
    ageAsked: true, age: 8
  }, over);
};

const browser = await chromium.launch();
async function fresh(save, { now = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 625 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  if (now != null) await page.addInitScript((n) => { window.__bootownNow = n; }, now);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

// ---- below the first milestone: nothing spawns ----
console.log('== below 5 Boos: no site ==');
{
  const { ctx, page } = await fresh(SAVE(4));
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await sleep(400);
  assert(!(await page.$('.t-consite')), 'no construction site below 5 unique Boos');
  await ctx.close();
}

// ---- 5 Boos: the first site spawns; 10 Boos: the second QUEUES ----
console.log('== milestones queue one at a time ==');
{
  const { ctx, page } = await fresh(SAVE(10));
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await sleep(500);
  const site = await page.$('.t-consite');
  assert(!!site, 'crossing milestones spawns a construction site');
  const g = await page.evaluate(() => window.BooTown.State.getState().townGrowth);
  assert(g.site && g.site.idx === 0, `the first milestone builds first (site idx ${g.site && g.site.idx})`);
  assert(g.pending.includes(1), 'the second crossed milestone waits in the queue');
  const builders = await page.$$eval('.t-consite .cs-boo', els => els.length);
  assert(builders === 2, `two hard-hat Boos on site (${builders})`);
  // hammering: transform changes over 3s+
  const fr = [];
  for (let i = 0; i < 6; i++) { fr.push(await page.$eval('.t-consite .cs-boo', n => n.style.transform || getComputedStyle(n).transform)); await sleep(620); }
  assert(new Set(fr).size >= 3, `builders hammer (${new Set(fr).size}/6 distinct frames)`);
  assert(!!(await page.$('.t-consite .cs-dust')), 'sawdust puffs present');
  await ctx.close();
}

// ---- 24 simulated hours later: reveal on next town open, no visit needed ----
console.log('== the Builders finish in 24h without a visit ==');
{
  // start the site "yesterday" by seeding townGrowth directly, then open the town
  const save = SAVE(10);
  save.townGrowth = { done: [], pending: [1], site: { idx: 0, startedAt: Date.now() - (24 * 3600 * 1000 + 60000) } };
  const { ctx, page } = await fresh(save);
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.growth-reveal', { timeout: 6000 });
  const txt = await page.$eval('.growth-reveal', n => n.textContent);
  assert(/Builders finished/i.test(txt), `reveal says the Builders finished something ("${txt.slice(0, 60)}…")`);
  await page.click('.growth-reveal .btn');
  await sleep(600);
  const st = await page.evaluate(() => window.BooTown.State.getState());
  assert(st.townGrowth.done.includes(0), 'milestone 0 marked done');
  assert(st.journal && st.journal.growth_wildflowers, 'Journal stamped for the milestone');
  assert(st.townGrowth.site && st.townGrowth.site.idx === 1, 'the queued site starts next (one at a time)');
  assert(!!(await page.$('.tg-wildflowers')), 'wildflowers now bloom along the paths');
  // upgrades never consume plots: her placed Boo at the fountain spot is untouched
  const placed = await page.evaluate(() => window.BooTown.State.getState().town.areas.meadow.items);
  assert(placed.length === 1 && placed[0].x === 0.46, 'placed items stay exactly where she put them');
  await ctx.close();
}

// ---- all five upgrades render; fairy lights glow at night ----
console.log('== upgrades render (all five) + night glow ==');
{
  const save = SAVE(10);
  save.townGrowth = { done: [0, 1, 2, 3, 4], pending: [], site: null };
  const { ctx, page } = await fresh(save);
  await page.evaluate(() => { window.__bootownHour = 22; window.BooTown.go('town'); });
  await page.waitForSelector('.town2 .t-item');
  await sleep(400);
  for (const k of ['wildflowers', 'fairylights', 'fountain', 'paving', 'banner']) {
    assert(!!(await page.$('.tg-' + k)), `upgrade renders: ${k}`);
  }
  const glow = await page.$eval('.tg-fairylights', n => n.className);
  assert(/lit/.test(glow), 'fairy lights glow at night');
  await ctx.close();
}

// ---- custom Boos count toward milestones ----
console.log('== customs count ==');
{
  const save = SAVE(3);
  save.customs = [{ id: 'c1', name: 'Zed', parts: {}, sealed: true, won: true }, { id: 'c2', name: 'Zip', parts: {}, sealed: true, won: true }];
  const { ctx, page } = await fresh(save);
  const n = await page.evaluate(() => import('./js/growth.js').then(m => m.uniqueBoosOwned()));
  assert(n === 5, `catalogue + won customs both count (${n})`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nr4p6-growth: FAIL' : '\nr4p6-growth: ALL PASS');
process.exit(failed ? 1 : 0);
