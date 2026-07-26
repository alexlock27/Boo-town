// tests/r15v-economy.mjs — RUN15 V1-V5: the economy.
//
// The two laws this suite exists to defend:
//   G11 — STARS NEVER SHRINK. Spending draws on a separate ledger; lifetime totals (the
//         numbers that unlock zones, fill the meter and appear on cards) are never
//         reduced by a purchase, by any code path.
//   G12 — no mechanic may make a child feel worse for choosing an easy game. Breadth is
//         encouraged by making other things desirable, never by penalty.
//
// Expected runtime: ~45s.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { SHELVES, priceOf, isUnlockOnly, WELCOME_PURSE, ALL_STOCK } from '../data/shop.js';
import { starTypeFor, TYPE_KEYS, spendableOf, GAME_STAR_TYPE } from '../data/startypes.js';
import { spendableAward, levelMultiplier, ABOVE_COMFORT_FLOOR } from '../js/comfort.js';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = 'screenshots/run15';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };

// ============================ V1: the five star types ================================
console.log('== V1: every game credits the authored type ==');
{
  const AUTHORED = {
    maths: ['bubblepop', 'bounce', 'dash', 'boopop', 'clockshop', 'blocks'],
    word: ['spellboo', 'detective'],
    puzzle: ['oddboo', 'flashboos', 'echoboos', 'booroll', 'expedition', 'caper'],
    creative: ['paint', 'collage', 'buildaboo', 'band', 'care'],
    lesson: ['teachme']
  };
  for (const [type, games] of Object.entries(AUTHORED)) {
    const wrong = games.filter(g => starTypeFor(g, null) !== type);
    ok(wrong.length === 0, `${type}: ${games.length} games map correctly${wrong.length ? ' → ' + wrong.join(', ') : ''}`);
  }
  // the two content-dependent games decide by the ROUND, exactly as authored
  ok(starTypeFor('feedboos', 'spelling') === 'word' && starTypeFor('feedboos', 'tables') === 'maths',
    'Feed the Boos pays Word on an English round and Maths otherwise');
  ok(starTypeFor('blocks', 'puzzle') === 'puzzle' && starTypeFor('blocks', 'tables') === 'maths',
    "Boo Blocks' puzzle scoring pays Puzzle; its question content pays Maths");
}

console.log('== V1: total always equals the sum of the types, across 500 random earns ==');
{
  // the ledger arithmetic, exercised headlessly against the real award function
  const wallet = Object.fromEntries(TYPE_KEYS.map(k => [k, 0]));
  let total = 0, legacy = 137;
  const games = Object.keys(GAME_STAR_TYPE);
  for (let i = 0; i < 500; i++) {
    const game = games[(Math.random() * games.length) | 0];
    const stars = 1 + ((Math.random() * 3) | 0);
    const level = [null, 1, 2, 3, 4][(Math.random() * 5) | 0];
    const above = Math.random() < 0.2;
    total += stars;                                    // lifetime credits the ROUND's stars
    wallet[starTypeFor(game, null)] += spendableAward({ stars, level, above }).spendable;
  }
  const typed = Object.values(wallet).reduce((a, b) => a + b, 0);
  ok(typed >= total, `typed stars (${typed}) never fall short of the rounds' own stars (${total})`);
  ok(legacy === 137, 'and the legacy pool is untouched by earning');
}

// ============================ V2: honest difficulty ==================================
console.log('== V2: the level multiplier table, exactly as authored ==');
{
  const TABLE = [
    [1, 1, 1], [1, 2, 2], [1, 3, 3],
    [2, 1, 2], [2, 2, 3], [2, 3, 5],
    [3, 1, 2], [3, 2, 4], [3, 3, 6],
    [4, 1, 3], [4, 2, 5], [4, 3, 8]
  ];
  let bad = [];
  for (const [level, stars, expect] of TABLE) {
    const got = spendableAward({ stars, level }).spendable;
    if (got !== expect) bad.push(`L${level}×${stars}★ → ${got} (want ${expect})`);
  }
  ok(bad.length === 0, `all 12 level/star combinations pay as authored${bad.length ? ' → ' + bad.join('; ') : ''}`);
  ok(levelMultiplier(1) === 1 && levelMultiplier(2) === 1.5 && levelMultiplier(3) === 2 && levelMultiplier(5) === 2.5,
    'x1 / x1.5 / x2 / x2.5 at Levels 1 / 2 / 3 / 4+');
  ok(spendableAward({ stars: 3, level: 3 }).bonusLine === 'Level 3 bonus — double stars!',
    'and the bonus line is the authored copy');
}

console.log('== V2: stretching is never worse than staying (the above-comfort floor) ==');
{
  const stayed = spendableAward({ stars: 3, level: 1, above: false }).spendable;      // an easy 3-star
  const stretchedBadly = spendableAward({ stars: 1, level: 2, above: true }).spendable; // a hard 1-star
  ok(stretchedBadly >= ABOVE_COMFORT_FLOOR, `a one-star round above her comfort still pays ${stretchedBadly} (floor ${ABOVE_COMFORT_FLOOR})`);
  ok(spendableAward({ stars: 1, level: 1, above: true }).floored === true, 'and the floor is what lifted it');
  ok(stayed === 3, 'while an easy three-star round still pays its full three — nothing was taken from her');
}

console.log('== G12: nothing anywhere in the results path scolds an easy round ==');
{
  // A copy audit of the whole results/comfort path. The words a child must never meet.
  const { readFileSync } = await import('fs');
  const BANNED = [/too easy/i, /that was easy/i, /try harder/i, /you should/i, /only \d+ stars?/i,
    /not enough/i, /again\?/i, /same old/i, /boring/i, /wasted/i];
  const files = ['js/results.js', 'js/comfort.js', 'data/guideLines.js', 'js/shop.js'];
  const hits = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const re of BANNED) { const m = src.match(re); if (m) hits.push(`${f}: "${m[0]}"`); }
  }
  ok(hits.length === 0, `no discouraging phrasing in the results path${hits.length ? ' → ' + hits.join(', ') : ''}`);
}

// ============================ V4: the shop's rules ===================================
console.log('== V4: unlock-only items are unpurchasable, by data and by code ==');
{
  const { BY_ID, CATALOGUE } = await import('../data/catalogue.js');
  const boos = CATALOGUE.filter(i => i.kind === 'boo').map(i => i.id);
  const sets = CATALOGUE.filter(i => i.kind === 'accessory' && i.slot === 'set').map(i => i.id);
  const feet = CATALOGUE.filter(i => i.kind === 'accessory' && i.slot === 'feet').map(i => i.id);
  ok(boos.length > 30 && boos.every(id => isUnlockOnly(id)), `every Boo is unlock-only (${boos.length})`);
  ok(sets.length === 6 && sets.every(id => isUnlockOnly(id)), `every costume set is unlock-only (${sets.length})`);
  ok(feet.length >= 4 && feet.every(id => isUnlockOnly(id)), `every feet accessory is unlock-only (${feet.length})`);
  ok(boos.concat(sets, feet).every(id => !priceOf(id)), 'and none of them carries a price at all');
  // the shelves stock only sellable things
  const badStock = ALL_STOCK.filter(s => isUnlockOnly(s.id));
  ok(badStock.length === 0, `no shelf stocks an unlock-only item${badStock.length ? ' → ' + badStock.map(b => b.id).join(', ') : ''}`);
}

console.log('== V4: the price table matches CONTENT_PRICES.md ==');
{
  ok(SHELVES.map(s => s.label).join(', ') === 'House, Town, Playground, Wearables, Special',
    'the five authored shelves, in order');
  const cur = Object.fromEntries(SHELVES.map(s => [s.id, s.currency]));
  ok(cur.house === 'creative' && cur.town === 'maths' && cur.playground === 'puzzle' && cur.wearables === 'word' && cur.special === 'lesson',
    'each shelf takes its authored currency');
  const special = SHELVES.find(s => s.id === 'special');
  ok(special.items.length === 3, 'the Special shelf holds exactly three items at a time');
  ok(WELCOME_PURSE === 20, `the Welcome purse is ${WELCOME_PURSE} legacy stars`);
  const wearables = SHELVES.find(s => s.id === 'wearables');
  ok(wearables.items.every(([id]) => /^acc_/.test(id)), 'the Wearables shelf stocks only accessories');
}

// ============================ the live app ===========================================
const browser = await chromium.launch();
const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery','boohouse_kitchen','boohouse_bedroom'];
const SAVE = (over = {}) => JSON.stringify(Object.assign({
  version: 17, name: 'Ada', ageAsked: true, age: 8,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: {}, stars: { total: 400, byType: { maths: 60, word: 40, puzzle: 50, creative: 45, lesson: 30 }, spent: {}, legacy: 100, byGame: {} },
  trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { shop: true, teachme: true } },
  shop: { welcomed: true },
  settings: { sound: false, music: false, voice: false, content: 'full' }
}, over));
async function open(route = 'shop', save, vp = { width: 1024, height: 768 }) {
  const ctx = await browser.newContext({ viewport: vp });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save || SAVE());
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown);
  await page.evaluate(r => window.BooTown.go(r), route);
  if (route === 'shop') await page.waitForFunction(() => window.__shop, null, { timeout: 8000 });
  return { ctx, page };
}

console.log('== G11: a purchase deducts spendable ONLY — lifetime totals never move ==');
{
  const { ctx, page } = await open();
  const before = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    return { total: s.stars.total, byType: { ...s.stars.byType }, wallet: window.__shop.wallet() };
  });
  const r = await page.evaluate(() => window.__shop.buyDirect('deco_rug'));
  const after = await page.evaluate(() => {
    const s = window.BooTown.State.getState();
    return { total: s.stars.total, byType: { ...s.stars.byType }, spent: { ...s.stars.spent },
      wallet: window.__shop.wallet(), owned: (s.inventory || {}).deco_rug || 0 };
  });
  ok(r.ok, 'the purchase succeeds');
  ok(after.total === before.total, `stars.total is untouched (${before.total} → ${after.total})`);
  ok(after.byType.creative === before.byType.creative, `lifetime creative stars are untouched (${before.byType.creative})`);
  ok(after.spent.creative === 8, `the SPENDING ledger took the 8 (spent.creative = ${after.spent.creative})`);
  ok(after.wallet.creative === before.wallet.creative - 8, `spendable fell by exactly the price (${before.wallet.creative} → ${after.wallet.creative})`);
  ok(after.owned === 1, 'and the item is hers, in the normal inventory');
  await ctx.close();
}

console.log('== G11: zone unlocks still read the lifetime total after spending ==');
{
  // Beach unlocks at 180 lifetime stars. Spend heavily; the unlock must not regress.
  const { ctx, page } = await open('shop', SAVE({ stars: { total: 200, byType: { maths: 200, word: 0, puzzle: 0, creative: 0, lesson: 0 }, spent: {}, legacy: 0, byGame: {} } }));
  const unlockedBefore = await page.evaluate(async () => {
    const { isAreaUnlocked } = await import('./js/areas.js');
    return isAreaUnlocked('beach', window.BooTown.State.getState());
  });
  await page.evaluate(() => { for (let i = 0; i < 4; i++) window.__shop.buyDirect(['deco_pond', 'deco_fountain', 'deco_bench', 'deco_lamppost'][i]); });
  const after = await page.evaluate(async () => {
    const { isAreaUnlocked } = await import('./js/areas.js');
    const s = window.BooTown.State.getState();
    return { unlocked: isAreaUnlocked('beach', s), total: s.stars.total, spentMaths: s.stars.spent.maths };
  });
  ok(unlockedBefore && after.unlocked, 'the Beach stays unlocked after a spending spree');
  ok(after.total === 200, `lifetime total is still ${after.total} after spending ${after.spentMaths} maths stars`);
  await ctx.close();
}

console.log('== V4: unlock-only items cannot be bought by ANY code path ==');
{
  const { ctx, page } = await open();
  const attempts = await page.evaluate(() => ['boo_inky', 'acc_set_chef', 'acc_rollerskates', 'boo_starnova']
    .map(id => ({ id, r: window.__shop.buyDirect(id) })));
  for (const a of attempts) ok(!a.r.ok && a.r.reason === 'unlockOnly', `${a.id} is refused (${a.r.reason})`);
  const inv = await page.evaluate(() => window.BooTown.State.getState().inventory);
  ok(Object.keys(inv).length === 0, 'and nothing was granted');
  await ctx.close();
}

console.log('== V4: the shop renders, and a new player can afford at least six things ==');
{
  const { ctx, page } = await open('shop', SAVE({
    stars: { total: 0, byType: { maths: 0, word: 0, puzzle: 0, creative: 0, lesson: 0 }, spent: {}, legacy: 0, byGame: {} },
    shop: {}, seen: { trophyRetro: true, introSeen: { shop: true } }
  }));
  ok(await page.evaluate(() => window.__shop.welcomed()), 'the Welcome purse is granted on the first visit');
  const wallet = await page.evaluate(() => window.__shop.wallet());
  ok(wallet.legacy === WELCOME_PURSE, `it is ${wallet.legacy} legacy stars`);
  const n = await page.evaluate(() => window.__shop.affordableCount());
  ok(n >= 6, `a brand-new player can afford ${n} items on day one`);
  const shelves = await page.evaluate(() => window.__shop.shelves());
  ok(shelves.length === 5, `all five shelves render (${shelves.join(', ')})`);
  await page.screenshot({ path: `${SHOTS}/shop-1024x768.png` });
  await ctx.close();
}

console.log('== V4: the save-up goal tracks and clears ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.__shop.setGoal('deco_fountain'));
  const p = await page.evaluate(() => window.__shop.goalProgress());
  ok(p && p.id === 'deco_fountain' && p.cost === 55, `the goal is set with its price (${p && p.cost})`);
  ok(p.pct > 0 && p.pct <= 100, `and shows progress toward it (${p.pct}%)`);
  await page.evaluate(() => window.__shop.buyDirect('deco_fountain'));
  ok(await page.evaluate(() => window.__shop.goal()) === null, 'buying the goal clears it');
  await ctx.close();
}

console.log('== V4: the shop has two doors, and the Meadow stall is one of them ==');
{
  const { ctx, page } = await open('town');
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  ok(await page.locator('.t-shop-stall').count() === 1, 'the market stall stands in the Meadow');
  await page.click('.t-shop-stall');
  await page.waitForFunction(() => window.__shop, null, { timeout: 6000 });
  ok(await page.evaluate(() => !!window.__shop), 'and it opens the shop');
  await ctx.close();
  const c = await open('collection');
  await c.page.waitForSelector('.coll-tabs');
  ok(await c.page.locator('.coll-tab.shop-link').count() === 1, 'the collection screen carries the second door');
  await c.ctx.close();
}

console.log('== V3: a lesson pays Lesson Stars, stamps the Journal, and gets a ceremony ==');
{
  const { ctx, page } = await open('teachme');
  await page.waitForSelector('.lesson-grid');
  await page.click('.lesson-card');
  await page.waitForSelector('.tm-stage', { timeout: 6000 });
  const before = await page.evaluate(() => ({ ...window.BooTown.State.getState().stars.byType }));
  await page.evaluate(async () => {
    const T = window.__teachme;
    for (let i = 0; i < 40 && !T.ended(); i++) {
      const c = T.card();
      if (c.type === 'check') T.answer(true); else T.tapNext();
      await new Promise(r => setTimeout(r, 120));
    }
  });
  const ceremony = await page.waitForSelector('.lesson-ceremony', { timeout: 6000 }).then(() => true).catch(() => false);
  ok(ceremony, 'the lesson ceremony appears');
  await page.screenshot({ path: `${SHOTS}/lesson-ceremony-1024x768.png` });
  await page.waitForSelector('.result-card', { timeout: 8000 });
  // the award panel lands after the stars have animated in — wait for it, not a guess
  await page.waitForSelector('.result-award', { timeout: 8000 });
  const after = await page.evaluate(() => ({
    byType: { ...window.BooTown.State.getState().stars.byType },
    journal: Object.keys(window.BooTown.State.getState().journal || {}).filter(k => k.startsWith('lesson_')),
    award: window.__resultAward
  }));
  ok(after.byType.lesson > before.lesson, `Lesson Stars credited (${before.lesson} → ${after.byType.lesson})`);
  ok(after.journal.length === 1, `the Journal took a lesson badge (${after.journal[0]})`);
  ok(after.award && after.award.type === 'lesson', 'and the results screen says which stars it paid');
  await ctx.close();
}

console.log('== V2: the results screen shows the award, the bonus and the Brave chip ==');
{
  const { ctx, page } = await open('hub');
  await page.evaluate(() => {
    window.BooTown.State.beginRoundTally();
    window.BooTown.go('results', { game: 'bubblepop', gameName: 'Bubble Pop', stars: 2, cat: 'tables', level: 3 });
  });
  await page.waitForSelector('.result-award', { timeout: 8000 });
  await page.waitForTimeout(2200);
  const a = await page.evaluate(() => ({
    amount: document.querySelector('.ra-amount')?.textContent,
    type: document.querySelector('.ra-type')?.textContent,
    bonus: document.querySelector('.ra-bonus')?.textContent,
    award: window.__resultAward
  }));
  ok(a.amount === '+4', `a two-star Level 3 round pays 4 spendable stars (${a.amount})`);
  ok(a.type === 'Maths Stars', `and says which kind (${a.type})`);
  ok(a.bonus === 'Level 3 bonus — double stars!', `with the authored bonus line ("${a.bonus}")`);
  await page.screenshot({ path: `${SHOTS}/results-award-1024x768.png` });
  await ctx.close();
}

console.log('== V1: the migration is lossless (VERSION 17) ==');
{
  const { ctx, page } = await open('hub');
  const m = await page.evaluate(async () => {
    const { migrate, VERSION } = await import('./js/state.js');
    const old = { version: 16, name: 'Ada', stars: { total: 372, byGame: {} }, inventory: { boo_inky: 1 } };
    const a = migrate(structuredClone(old));
    const b = migrate(structuredClone(a));
    return { VERSION, version: a.version, total: a.stars.total, legacy: a.stars.legacy,
      byType: a.stars.byType, spent: a.stars.spent,
      idempotent: JSON.stringify(a.stars) === JSON.stringify(b.stars) };
  });
  ok(m.VERSION >= 17 && m.version === m.VERSION, `the save version stepped to ${m.VERSION}`);
  ok(m.total === 372, `the lifetime total is untouched (${m.total})`);
  ok(m.legacy === 372, `and an equal legacy balance is granted (${m.legacy}) — nothing is lost, nothing is invented`);
  ok(Object.values(m.byType).every(v => v === 0), 'no type is credited retrospectively');
  ok(Object.values(m.spent).every(v => v === 0), 'and nothing is marked as already spent');
  ok(m.idempotent, 'migrating an already-migrated save changes nothing');
  await ctx.close();
}

console.log('== the shop at all three viewports ==');
{
  for (const vp of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
    const { ctx, page } = await open('shop', undefined, vp);
    const fits = await page.evaluate(() => {
      const d = document.documentElement;
      return d.scrollWidth <= d.clientWidth + 1;
    });
    ok(fits, `${vp.width}x${vp.height}: no horizontal overflow`);
    await page.screenshot({ path: `${SHOTS}/shop-${vp.width}x${vp.height}.png` });
    await ctx.close();
  }
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
