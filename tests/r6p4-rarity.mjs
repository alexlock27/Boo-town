// tests/r6p4-rarity.mjs — RUN6 phase 4: the shared rarity VFX system (C2).
// Acceptance (RUN6 part D #5): frame evidence for Rare, Ultra, Shiny and Secret in
// the ceremony, the focused collection card, and the town, plus the degraded static
// sheen beyond the town emitter cap.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r6p4', { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: {}, boxes: 0, meter: 0, opened: 12, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {},
  town: [], stars: { total: 90, byGame: {} }, ledger: {}, shinies: {},
  delights: { hideDay: today, hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'] },
  trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch();
async function fresh(save, { rand = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 700 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  if (rand != null) await page.addInitScript((r) => { Math.random = () => r; }, rand);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
async function frames(page, sel, { pseudo = null, prop = 'transform', n = 6, span = 2200 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) { out.push(await page.evaluate(([s, ps, pr]) => { const e = document.querySelector(s); return e ? getComputedStyle(e, ps)[pr] : 'MISSING'; }, [sel, pseudo, prop])); await sleep(span / (n - 1)); }
  return out;
}
const distinct = a => new Set(a).size;
// per-tier: [rarity, sampleSelectorSuffix, pseudo]
const TIERS = [
  ['rare', '.rfx-glint', '::before'],
  ['ultra', '.rfx-mote', null],
  ['secret', '.rfx-aura', null],
  ['shiny', '.rfx-shiny-glint', null]
];

// ==================== collection focus: full effect per tier ====================
console.log('== collection focus: every tier animates ==');
{
  const inv = { boo_bubbles: 1, boo_disco: 1, boo_dj: 1, boo_inky: 1 };
  const { ctx, page } = await fresh(SAVE({ inventory: inv, shinies: { boo_inky: 1 } }));
  const tileSel = { rare: '.coll-tile.rar-rare.owned', ultra: '.coll-tile.rar-ultra.owned', secret: '.coll-tile.rar-secret.owned', shiny: '.coll-tile.has-shiny.owned' };
  for (const [tier, layer, pseudo] of TIERS) {
    await page.evaluate(() => { document.querySelectorAll('.overlay').forEach(o => o.remove()); window.BooTown.go('collection'); });
    await page.waitForSelector('.coll-grid');
    await page.click(tileSel[tier]);
    await page.waitForSelector('.item-detail-art');
    const has = await page.$('.item-detail-art ' + layer);
    assert(!!has, `collection focus — ${tier} shows its VFX layer (${layer})`);
    const fr = await frames(page, '.item-detail-art ' + layer, { pseudo });
    assert(distinct(fr) >= 2, `collection focus — ${tier} animates (${distinct(fr)} distinct frames)`);
  }
  await ctx.close();
}

// ==================== town: every tier animates + degrade beyond the cap ====================
console.log('== town: every tier animates ==');
{
  const town = [
    { zone: 'meadow', x: 0.25, item: 'boo_bubbles' }, { zone: 'meadow', x: 0.4, item: 'boo_disco' },
    { zone: 'meadow', x: 0.55, item: 'boo_dj' }, { zone: 'meadow', x: 0.7, item: 'boo_inky' }
  ];
  const inv = { boo_bubbles: 1, boo_disco: 1, boo_dj: 1, boo_inky: 1 };
  const { ctx, page } = await fresh(SAVE({ inventory: inv, shinies: { boo_inky: 1 }, town }));
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await sleep(400);
  const sel = { rare: '.t-item[data-item="boo_bubbles"] .rfx-glint', ultra: '.t-item[data-item="boo_disco"] .rfx-mote', secret: '.t-item[data-item="boo_dj"] .rfx-aura', shiny: '.t-item[data-item="boo_inky"] .rfx-shiny-glint' };
  for (const [tier, , pseudo] of TIERS) {
    assert(!!(await page.$(sel[tier])), `town — ${tier} shows its VFX layer`);
    const fr = await frames(page, sel[tier], { pseudo });
    assert(distinct(fr) >= 2, `town — ${tier} animates (${distinct(fr)} distinct)`);
  }
  await page.screenshot({ path: 'screenshots/r6p4/town-rarity-1000x700.png' });
  await ctx.close();
}

// ==================== town degrade: beyond the emitter cap → static sheen ====================
console.log('== town degrade beyond emitter cap ==');
{
  const rares = ['boo_bubbles', 'boo_minty', 'boo_skye', 'boo_candy', 'boo_gigi', 'boo_peppy', 'boo_sol', 'boo_comet'];
  const town = rares.map((id, i) => ({ zone: 'meadow', x: +(0.12 + i * 0.09).toFixed(2), item: id }));
  const inv = Object.fromEntries(rares.map(id => [id, 1]));
  const { ctx, page } = await fresh(SAVE({ inventory: inv, town }));
  await page.evaluate(() => window.BooTown.go('town'));
  await page.waitForSelector('.town2 .t-item');
  await sleep(400);
  const counts = await page.evaluate(() => ({ glint: document.querySelectorAll('.t-item .rfx-glint').length, sheen: document.querySelectorAll('.t-item .rfx-sheen').length }));
  assert(counts.glint <= 6, `at most RARITY_TOWN_CAP (6) items animate their glint (${counts.glint})`);
  assert(counts.sheen >= 2, `the rest degrade to a static sheen (${counts.sheen} sheened)`);
  // the sheen is genuinely static (no animation)
  const anim = await page.$eval('.t-item .rfx-sheen', el => getComputedStyle(el).animationName);
  assert(anim === 'none', 'the degraded sheen carries no animation (emitter cap holds)');
  await ctx.close();
}

// ==================== ceremony: every tier animates on the reveal ====================
console.log('== ceremony: every tier animates on the reveal ==');
{
  // pin the roll deterministically with the __forceRoll test hook (a Boo of each rarity)
  const cases = [['rare', 'rare', false], ['ultra', 'ultra', false], ['secret', 'secret', false], ['shiny', 'common', true]];
  for (const [tier, rarity, forceShiny] of cases) {
    const over = { boxes: 1, inventory: Object.fromEntries(['boo_inky', 'boo_plum', 'boo_pippin', 'boo_lolly', 'boo_chomp', 'boo_mallow', 'boo_curly', 'boo_wisp', 'boo_beam', 'boo_dot', 'boo_fuzz'].map(b => [b, 1])) };
    if (forceShiny) over.shinyDrops = 24;   // mercy → the next roll is shiny (RUN4 C8)
    const { ctx, page } = await fresh(SAVE(over));
    await page.evaluate(r => { window.__forceRoll = { type: 'boo', rarity: r }; }, rarity);
    await page.click('.gift-btn', { force: true });
    await page.waitForSelector('.gift-box');
    for (let i = 0; i < 3; i++) { await page.click('.gift-box', { force: true }); await sleep(230); }
    await page.waitForSelector('.reveal-art', { timeout: 6000 });
    await sleep(200);
    const layer = { rare: '.rfx-glint', ultra: '.rfx-mote', secret: '.rfx-aura', shiny: '.rfx-shiny-glint' }[tier];
    const pseudo = tier === 'rare' ? '::before' : null;
    assert(!!(await page.$('.reveal-art ' + layer)), `ceremony — ${tier} reveal shows its VFX layer`);
    const fr = await frames(page, '.reveal-art ' + layer, { pseudo });
    assert(distinct(fr) >= 2, `ceremony — ${tier} animates on the reveal (${distinct(fr)} distinct)`);
    if (tier === 'ultra') await page.screenshot({ path: 'screenshots/r6p4/ceremony-ultra-1000x700.png' });
    await ctx.close();
  }
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
