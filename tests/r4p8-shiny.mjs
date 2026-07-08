// tests/r4p8-shiny.mjs — RUN4 phase 8 (C8): shiny Boos + the Star Chest.
// Acceptance (RUN4 part D #10, #11): forced rolls confirm the 1-in-15 odds and
// the 25-drop mercy; shiny render, badge, counter, golden ceremony and Journal
// stamp all present; per-copy tracking survives reload. A migrated save receives
// exactly one welcome chest and no back-pay; thereafter chests appear at each
// 50-star boundary from the migration total; the mini track matches the visible
// total; contents honour the guarantees; normal boxes unaffected.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 4, name: 'Ada',   // v4 → migration gives the welcome chest
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 137, byGame: {} },
  ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true }, trophies: { medal_stars_100: 'x' }, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch();
async function fresh(save, { rand = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  if (rand != null) await page.addInitScript((r) => { Math.random = () => r; }, rand);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

// ---- odds + mercy (logic level, deterministic) ----
console.log('== 1-in-15 odds + 25-drop mercy ==');
{
  const { ctx, page } = await fresh(SAVE());
  const r = await page.evaluate(() => import('./js/shiny.js').then(m => {
    const st = window.BooTown.State;
    const out = {};
    const withRandom = (v, fn) => { const o = Math.random; Math.random = () => v; const x = fn(); Math.random = o; return x; };
    out.consts = { odds: m.SHINY_ODDS, mercy: m.SHINY_MERCY, mult: m.CHEST_SHINY_MULT };
    st.mutate(s => { s.shinyDrops = 0; });
    out.justUnder = withRandom(0.066, () => m.rollShiny());        // 0.066 < 1/15 → shiny
    st.mutate(s => { s.shinyDrops = 0; });
    out.justOver = withRandom(0.067, () => m.rollShiny());         // 0.067 > 1/15 → not
    st.mutate(s => { s.shinyDrops = 0; });
    out.tripleUnder = withRandom(0.19, () => m.rollShiny({ mult: 3 }));   // < 3/15 → shiny
    st.mutate(s => { s.shinyDrops = 0; });
    out.singleSame = withRandom(0.19, () => m.rollShiny());        // > 1/15 → not
    // mercy: guaranteed within every 25 Boo drops
    st.mutate(s => { s.shinyDrops = 24; });
    out.mercyHit = withRandom(0.9, () => m.rollShiny());
    out.counterReset = window.BooTown.State.getState().shinyDrops === 0;
    st.mutate(s => { s.shinyDrops = 3; });
    out.noEarlyMercy = withRandom(0.9, () => m.rollShiny());
    return out;
  }));
  assert(r.consts.odds === 1 / 15 && r.consts.mercy === 25, `named constants (1/15, 25)`);
  assert(r.justUnder === true && r.justOver === false, `the 1-in-15 threshold is exact (${r.justUnder}/${r.justOver})`);
  assert(r.tripleUnder === true && r.singleSame === false, 'chest triple odds are genuinely 3x');
  assert(r.mercyHit === true && r.counterReset, 'the 25th Boo drop without a shiny is a guaranteed (hidden) mercy shiny');
  assert(r.noEarlyMercy === false, 'mercy never fires early');
  await ctx.close();
}

// ---- integration: a shiny drop through the real box ceremony ----
console.log('== golden ceremony + badge + journal + reload ==');
{
  // fixed random 0.5 → Boo type, Common rarity; shinyDrops 24 → mercy shiny
  const { ctx, page } = await fresh(SAVE({ boxes: 1, shinyDrops: 24, chest: { anchor: 137, opened: 0, welcome: false } }), { rand: 0.5 });
  await page.click('.gift-btn', { force: true });
  await page.waitForSelector('.gift-box');
  for (let i = 0; i < 3; i++) { await page.click('.gift-box', { force: true }); await sleep(220); }
  await page.waitForSelector('.reveal-card', { timeout: 6000 });
  await sleep(600);
  const shinyCard = await page.$('.reveal-card.shiny');
  assert(!!shinyCard, 'the reveal card goes golden for a shiny');
  const st = await page.evaluate(() => window.BooTown.State.getState());
  const shinyIds = Object.keys(st.shinies || {}).filter(k => st.shinies[k] > 0);
  assert(shinyIds.length === 1, `per-copy shiny recorded (${shinyIds.join(',')})`);
  assert(st.journal && st.journal.firstShiny, 'first shiny stamps the Journal');
  assert(st.shinyDrops === 0, 'mercy counter reset');
  // per-copy tracking survives reload
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  const st2 = await page.evaluate(() => window.BooTown.State.getState());
  assert((st2.shinies[shinyIds[0]] || 0) === 1, 'shiny copies survive reload');
  // collection: badge + header counter
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-grid');
  assert(!!(await page.$('.shiny-badge')), 'the shiny badge shows on its collection card');
  const counter = await page.$eval('.coll-shiny-count', n => n.textContent).catch(() => '');
  assert(/1/.test(counter), `the collection header counts shinies ("${counter}")`);
  await ctx.close();
}

// ---- the Star Chest: welcome chest, boundaries, no back-pay ----
console.log('== Star Chest: welcome + boundaries ==');
{
  const { ctx, page } = await fresh(SAVE());   // v4 @137 stars → migration: anchor 137, welcome
  const chest = await page.$('.star-chest');
  assert(!!chest, 'a golden chest appears beside the hub meter');
  const ready = await page.$('.star-chest.ready');
  assert(!!ready, 'the migrated save has exactly one welcome chest waiting');
  await page.click('.star-chest');
  await page.waitForSelector('.chest-reveal', { timeout: 6000 });
  await sleep(700);
  const st = await page.evaluate(() => window.BooTown.State.getState());
  assert(st.chest.welcome === false, 'the welcome chest is consumed');
  assert(st.chest.opened === 0, 'welcome chest does not eat a boundary chest');
  const boos = Object.keys(st.inventory).filter(id => id.startsWith('boo_') && !['boo_inky'].includes(id));
  const accs = Object.keys(st.inventory).filter(id => id.startsWith('acc_'));
  assert(boos.length === 1, `the chest granted one Boo (${boos.join(',')})`);
  const rarity = await page.evaluate((id) => import('./data/catalogue.js').then(m => m.BY_ID[id].rarity), boos[0]);
  assert(['rare', 'ultra', 'secret'].includes(rarity), `chest Boo is Rare or better (${rarity})`);
  assert(accs.length === 1, `plus one accessory (${accs.join(',')})`);
  // no back-pay: 137 anchored stars grant nothing further
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub');
  assert(!(await page.$('.star-chest.ready')), 'no back-pay for stars earned before the update');
  // mini track ties to the visible total: +30 stars → 30/50
  await page.evaluate(() => { window.BooTown.State.mutate(s => { s.stars.total += 30; }); window.BooTown.go('collection'); });
  await sleep(200);
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.star-chest');
  const frac = await page.$eval('.star-chest .chest-fill', n => n.style.width);
  assert(frac === '60%', `mini track matches the total (30/50 → "${frac}")`);
  assert(!(await page.$('.star-chest.ready')), '30/50: not ready yet');
  // +20 more → boundary crossed → ready; open → opened=1, track resets
  await page.evaluate(() => { window.BooTown.State.mutate(s => { s.stars.total += 20; }); window.BooTown.go('collection'); });
  await sleep(200);
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.star-chest.ready');
  assert(true, 'the next chest appears exactly at the 50-star boundary');
  await page.click('.star-chest');
  await page.waitForSelector('.chest-reveal');
  await sleep(500);
  const st3 = await page.evaluate(() => window.BooTown.State.getState());
  assert(st3.chest.opened === 1, 'boundary chest recorded');
  await ctx.close();
}

// ---- normal boxes unchanged ----
console.log('== normal boxes unaffected ==');
{
  const { ctx, page } = await fresh(SAVE({ boxes: 1, chest: { anchor: 137, opened: 0, welcome: false }, version: 5 }), { rand: 0.5 });
  await page.click('.gift-btn', { force: true });
  await page.waitForSelector('.gift-box');
  for (let i = 0; i < 3; i++) { await page.click('.gift-box', { force: true }); await sleep(220); }
  await page.waitForSelector('.reveal-card', { timeout: 6000 });
  const golden = await page.$('.chest-reveal');
  assert(!golden, 'a normal box opens the normal ceremony (chest is pure bonus on top)');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nr4p8-shiny: FAIL' : '\nr4p8-shiny: ALL PASS');
process.exit(failed ? 1 : 0);
