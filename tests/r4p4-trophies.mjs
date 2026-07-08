// tests/r4p4-trophies.mjs — RUN4 phase 4 (C4): the Trophy Room.
// Acceptance (RUN4 part D #6): every certificate, medal and trophy in C4 exists
// with silhouette hints; a simulated mastery of the 4 times table awards its
// certificate with ceremony and Journal stamp; filter chips work; a migrated
// legacy save retro-awards every derivable item on first load in ONE combined
// ceremony; per-game medal counters start at zero.
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
  ledger: {}, journal: {}, customs: [],
  settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true }, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch();
async function fresh(save) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

// ---- the catalogue is complete per C4 ----
console.log('== catalogue completeness ==');
{
  const { ctx, page } = await fresh(SAVE());
  const cat = await page.evaluate(() => import('./js/trophies.js').then(m => m.CATALOG.map(c => ({ key: c.key, type: c.type, group: c.group }))));
  const keys = new Set(cat.map(c => c.key));
  for (const t of [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) assert(keys.has(`cert_table_${t}`), `certificate: ${t} times table`);
  for (const k of ['cert_bonds10', 'cert_bonds20', 'cert_bonds100', 'cert_clock_1', 'cert_clock_2', 'cert_clock_3', 'cert_teachme']) assert(keys.has(k), 'certificate: ' + k);
  assert(cat.filter(c => c.key.startsWith('cert_spell_')).length === 17, 'one certificate per spelling set (17: Big List + 16 banks)');
  assert(cat.filter(c => c.key.startsWith('cert_twin_')).length >= 13, 'one certificate per Sound Twins set (13+)');
  for (const g of ['bubblepop', 'feedboos', 'spellboo', 'blocks', 'bounce', 'beat', 'teachme', 'dash', 'clockshop'])
    for (const tier of ['bronze', 'silver', 'gold']) assert(keys.has(`medal_${g}_${tier}`), `medal: ${g} ${tier}`);
  for (const k of ['medal_stars_100', 'medal_stars_500', 'medal_stars_1000', 'medal_boos_10', 'medal_boos_25', 'medal_boos_40',
                   'medal_shiny_1', 'medal_shiny_5', 'medal_shiny_10', 'medal_decos', 'medal_accs']) assert(keys.has(k), 'medal: ' + k);
  for (const k of ['trophy_zones', 'trophy_lessons', 'trophy_custom', 'trophy_golden']) assert(keys.has(k), 'trophy: ' + k);
  await ctx.close();
}

// ---- Trophy Room tab: cabinet, silhouettes with hints, filter chips ----
console.log('== Trophy Room tab ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-tabs');
  const tabNames = await page.$$eval('.coll-tab', ts => ts.map(t => t.textContent));
  assert(tabNames.some(t => /Boos|Collection/.test(t)) && tabNames.some(t => /Troph/.test(t)) && tabNames.some(t => /Journal/.test(t)), 'Collection has Boos / Trophies / Journal tabs (' + tabNames.join(' | ') + ')');
  await page.click('.coll-tab:has-text("Troph")');
  await page.waitForSelector('.trophy-cabinet');
  const sil = await page.$$eval('.trophy-card.silhouette', els => els.length);
  assert(sil > 10, `unearned items show as silhouettes (${sil})`);
  const hint = await page.$eval('.trophy-card.silhouette .tc-hint', n => n.textContent);
  assert(hint.length > 5 && /…/.test(hint), `silhouettes carry a hint line ("${hint}")`);
  // filter chips swap the shelves
  const mathsLabels = await page.$$eval('.trophy-card .tc-label', els => els.map(e => e.textContent));
  assert(mathsLabels.some(l => /times table/.test(l)), 'Maths chip shows the table certificates');
  await page.click('.troph-chip:has-text("Words")');
  await sleep(200);
  const wordLabels = await page.$$eval('.trophy-card .tc-label', els => els.map(e => e.textContent));
  assert(wordLabels.some(l => /Word Starters 1/.test(l)) && !wordLabels.some(l => /times table/.test(l)), 'Words chip swaps to spelling certificates');
  await page.click('.troph-chip:has-text("Collector")');
  await sleep(200);
  const collLabels = await page.$$eval('.trophy-card .tc-label', els => els.map(e => e.textContent));
  assert(collLabels.some(l => /unique Boos/.test(l)) && collLabels.some(l => /Every decoration/.test(l)), 'Collector chip shows collector medals');
  await ctx.close();
}

// ---- simulated mastery of the 4 times table → certificate + ceremony + stamp ----
console.log('== 4 times table certificate ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => {
    window.BooTown.State.mutate(s => {
      for (let f = 1; f <= 12; f++) s.ledger['tmul4:' + f] = { rights: 5, misses: 0, lastSeen: 1 };
    });
    window.BooTown.State.beginRoundTally();
    window.BooTown.go('results', { game: 'bubblepop', gameName: 'Bubble Pop', stars: 2, cat: 'tables', level: 1 });
  });
  await page.waitForSelector('.trophy-ceremony', { timeout: 8000 });
  const txt = await page.$eval('.trophy-ceremony', n => n.textContent);
  assert(/certificate/i.test(txt), 'the ceremony announces a certificate');
  assert(/4 times table/.test(txt), 'the 4 times table certificate is the one shown');
  await page.click('.trophy-ceremony .btn');
  await sleep(300);
  const st = await page.evaluate(() => window.BooTown.State.getState());
  assert(st.trophies && st.trophies.cert_table_4, 'certificate recorded in the save');
  assert(st.journal && st.journal.trophy_cert_table_4, 'Journal stamped');
  await ctx.close();
}

// ---- migrated legacy save: retro-award everything derivable, in ONE ceremony ----
console.log('== retroactive award on first load ==');
{
  const inv = { deco_pond: 1 };
  const boos = ['boo_inky', 'boo_plum', 'boo_pippin', 'boo_lolly', 'boo_chomp', 'boo_mallow', 'boo_curly', 'boo_wisp', 'boo_beam', 'boo_dot'];
  for (const b of boos) inv[b] = 1;
  const ledger = {};
  for (let f = 1; f <= 12; f++) ledger['tmul2:' + f] = { rights: 5, misses: 0, lastSeen: 1 };
  const { ctx, page } = await fresh(SAVE({
    seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } }, inventory: inv, ledger,
    stars: { total: 300, byGame: {} },   // ≥280: every zone open incl. the Boo Funfair
    catBest: { 'clockshop:l1': 3 },
    journal: { golden3: '2026-07-01' }
  }));
  await page.waitForSelector('.trophy-ceremony', { timeout: 8000 });
  const txt = await page.$eval('.trophy-ceremony', n => n.textContent);
  assert(/Trophy Room is open/.test(txt), 'the retro ceremony is the gentle cabinet-opening');
  const ceremonies = await page.$$eval('.trophy-ceremony', els => els.length);
  assert(ceremonies === 1, 'exactly ONE combined ceremony');
  await page.click('.trophy-ceremony .btn');
  const st = await page.evaluate(() => window.BooTown.State.getState());
  for (const k of ['cert_table_2', 'cert_clock_1', 'medal_boos_10', 'medal_stars_100', 'trophy_zones', 'trophy_golden'])
    assert(st.trophies[k], 'retro-awarded: ' + k);
  assert(!st.trophies.medal_bubblepop_bronze, 'per-game medals NOT retro-awarded (counters start at zero)');
  assert(Object.keys(st.gameThrees || {}).length === 0, 'gameThrees counters start at zero');
  // never again: revisit the hub — no new ceremony
  await page.evaluate(() => window.BooTown.go('collection'));
  await sleep(300);
  await page.evaluate(() => window.BooTown.go('hub'));
  await sleep(600);
  const again = await page.$('.trophy-ceremony');
  assert(!again, 'the retro ceremony happens exactly once');
  await ctx.close();
}

// ---- a fresh save: retro pass runs silently, nothing earned, no ceremony ----
console.log('== fresh save: silent ==');
{
  const { ctx, page } = await fresh(SAVE({ seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } }, stars: { total: 4, byGame: {} }, inventory: { boo_inky: 1 } }));
  await sleep(800);
  const ov = await page.$('.trophy-ceremony');
  assert(!ov, 'no ceremony when nothing is earned');
  const st = await page.evaluate(() => window.BooTown.State.getState());
  assert(st.seen.trophyRetro === true, 'the retro pass still marks itself done');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nr4p4-trophies: FAIL' : '\nr4p4-trophies: ALL PASS');
process.exit(failed ? 1 : 0);
