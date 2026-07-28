// tests/r18b-pile-tiers.mjs — RUN18B Y9: Spell Boo joins the Tricky Pile, + the Bubble Pop
// tier gates.
//
// The pack's two assertions, and the two things that had to be true underneath them:
//   1. a seeded pile item is drawn ~3x as often as a peer (the pack says over 600 draws,
//      +/-20%; see the note in section 1 for why this runs more draws than that);
//   2. a light-tier save sees Number bonds AND Doubles & halves in Bubble Pop's picker;
//   3. Spell Boo's ledger ids are game-prefixed, and the pile keeps the SAME id — if those
//      two strings disagree the pile can never boost the pool item it came from, which is
//      exactly why Spell Boo's pile did nothing at all before today;
//   4. read-both-forms: a save written before Y9 keeps its history and its certificates.
// Expected runtime: ~25s. Not @serial.

import { chromium } from 'playwright';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const GAMES = ['spellboo', 'bubblepop'];
const save = (over = {}, settings = {}) => JSON.stringify(Object.assign({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 }, trophies: {}, boxes: 0,
  meter: 0, spellingMastery: {}, ledger: {}, trickyPile: [],
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: Object.fromEntries(GAMES.map(g => [g, true])) },
  settings: Object.assign({ sound: false, music: false, voice: false, content: 'full' }, settings)
}, over));

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(route, params = {}, over = {}, settings = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(over, settings));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.evaluate(([r, p]) => window.BooTown.go(r, p || {}), [route, params]);
  await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 20000 });
  return { ctx, page };
}

// ================== 1. a pile item is drawn ~3x as often as a peer ==================
// The pack asks for 600 draws at +/-20%. 600 draws is not enough evidence for that band:
// the boosted count's 1-sigma spread is well over 20% there, so the assertion would fail
// roughly one run in five on a perfectly correct implementation. The 600-draw figure is
// REPORTED (it is the pack's number) and the assertion is made on 60000 draws, where 1 sigma
// is ~3% and the +/-20% band is a real bound rather than a coin toss.
//
// Note what "3x weight" can and cannot mean. Smart Mix draws WITHOUT replacement, so an
// item's weight sets its odds on each pick, not its final frequency: once eight of a pool
// are taken, the boosted item's realised frequency lands slightly UNDER its nominal weight
// (measured: 3.00x at one draw per round, ~2.9x at the round's eight). Spell Boo's real pool
// is ~300 words and twin sets, so this uses 300 — on a 60-item pool the same correct code
// reads ~2.6x, which is the sampling, not the boost.
console.log('== 1. persisted pile items draw at 3x weight ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const st = await import('./js/state.js');
    // one seeded in the NEW form, one in the PRE-Y9 form: both must boost.
    st.mutate(s => { s.trickyPile = ['w:w007', 'spellboo:w023']; s.ledger = {}; });
    const { pileBoost, PILE_BOOST } = await import('./js/trickypile.js');
    const { buildSmartMix } = await import('./js/smartmix.js');
    const N = 300, ROUND = 8;
    const pool = [];
    for (let i = 0; i < N; i++) { const id = 'spellboo:w' + String(i).padStart(3, '0'); pool.push({ id, boost: pileBoost(id) }); }
    const counts = new Array(N).fill(0);
    const tally = (rounds) => { for (let r = 0; r < rounds; r++) for (const it of buildSmartMix(pool, ROUND)) counts[+it.id.slice(-3)]++; };
    const ratio = () => {
      const boosted = (counts[7] + counts[23]) / 2;
      const control = (counts.reduce((a, b) => a + b, 0) - counts[7] - counts[23]) / (N - 2);
      return boosted / control;
    };
    tally(75); const at600 = ratio();            // the pack's 600 draws, reported
    tally(7425); const at60000 = ratio();        // 60000 draws, asserted (1 sigma ~3%)
    return { boost: PILE_BOOST, seeded: [pool[7].boost, pool[23].boost], peer: pool[0].boost, at600, at60000 };
  });
  assert(r.boost === 3, `PILE_BOOST is 3 (${r.boost})`);
  assert(r.seeded[0] === 3, `a pre-Y9 pile id ("w:w007") still boosts its prefixed pool item x3 (${r.seeded[0]})`);
  assert(r.seeded[1] === 3, `a Y9 pile id ("spellboo:w023") boosts x3 (${r.seeded[1]})`);
  assert(r.peer === 1, `an item that is not in the pile is unboosted (${r.peer})`);
  console.log(`  · ratio over the pack's 600 draws: ${r.at600.toFixed(2)}x (reported, not asserted)`);
  assert(Math.abs(r.at60000 - 3) <= 0.6, `a seeded pile item is drawn ~3x as often as a peer over 60000 draws (${r.at60000.toFixed(2)}x, the pack's 3x +/-20% band 2.4–3.6)`);
  await ctx.close();
}

// ================== 2. Spell Boo's ledger id and its pile id are the SAME string ==========
console.log('== 2. game-prefixed ledger ids, and a pile id that matches them ==');
{
  // Light tier: at Full the sets sit under collapsed group headers and the card is not
  // clickable without opening one — Th Words is a Light set and is on the face of the picker.
  const { ctx, page } = await open('spellboo', {}, {}, { content: 'light' });
  await page.waitForSelector('.picker');
  await page.click('.picker-choice:has-text("Th Words")');
  await page.click('.picker-levels .level-btn >> nth=0');
  await page.waitForSelector('.spell-stage');
  await sleep(150);
  const word = await page.evaluate(() => window.__spell.word());
  assert(!!word, `a Th Words round is running on "${word}"`);
  await page.evaluate(() => window.__spell.typeWrong());
  await sleep(800);
  const led = await page.evaluate(() => JSON.parse(JSON.stringify(window.BooTown.State.getState().ledger)));
  assert(!!led['spellboo:' + word], `the miss is recorded under the game-prefixed id "spellboo:${word}"`);
  assert(!led[word], `nothing is written to the bare word "${word}" any more`);
  assert(led['spellboo:' + word].misses === 1, 'exactly one miss recorded');
  // finish the round, then skip the rescue so the miss persists into the pile
  for (let g = 0; g < 20; g++) { if (await page.$('.result-card')) break; await page.evaluate(() => window.__spell.typeCorrect()); await sleep(1500); }
  await page.waitForSelector('.result-card', { timeout: 6000 });
  await page.waitForSelector('.rescue-panel', { timeout: 5000 });
  await sleep(300);
  for (let g = 0; g < 5; g++) { if (!(await page.evaluate(() => window.__rescue.remaining()))) break; await page.evaluate(() => window.__rescue.skip()); await sleep(200); }
  const pile = await page.evaluate(() => window.BooTown.State.getState().trickyPile.slice());
  assert(pile.includes('spellboo:' + word), `the unrescued miss persists as "spellboo:${word}" — the same string the ledger uses (${JSON.stringify(pile)})`);
  assert(!pile.includes('w:' + word), 'the old "w:" pile form is not written any more');
  // and that id is exactly what Spell Boo's Smart Mix pool asks the pile about
  const boosted = await page.evaluate(async (w) => (await import('./js/trickypile.js')).pileBoost('spellboo:' + w), word);
  assert(boosted === 3, `so Smart Mix boosts it x3 next time (${boosted})`);
  await ctx.close();
}

// ================== 3. read both forms: a pre-Y9 save keeps its history ==================
console.log('== 3. a save written before Y9 still counts ==');
{
  const LEGACY = { 'Thursday': { rights: 0, misses: 3, lastSeen: 1 }, 'twin:toTooTwo': { rights: 5, misses: 0, lastSeen: 2 } };
  const { ctx, page } = await open('hub', {}, { ledger: LEGACY });
  const r = await page.evaluate(async () => {
    const st = await import('./js/state.js');
    const { buildCatalog } = await import('./js/trophies.js');
    const cert = buildCatalog().find(c => c.key === 'cert_twin_toTooTwo');
    return {
      weak: st.ledgerClass('spellboo:Thursday'),
      misses: st.ledgerEntry('spellboo:Thursday').misses,
      mastered: st.isMastered('spellboo:twin:toTooTwo'),
      cert: !!(cert && cert.earned()),
      unrelated: st.ledgerEntry('blendit:Thursday').misses   // another game must NOT read it
    };
  });
  assert(r.weak === 'weak' && r.misses === 3, `a pre-Y9 miss on "Thursday" still classes "spellboo:Thursday" as weak (${r.weak}, ${r.misses} misses)`);
  assert(r.mastered === true, 'a pre-Y9 "twin:toTooTwo" mastery still reads through the prefixed id');
  assert(r.cert === true, 'and the Sound Twins certificate she already earned is still earned');
  assert(r.unrelated === 0, 'the fallback is Spell Boo\'s alone — "blendit:Thursday" reads nothing');
  await ctx.close();
}

// ================== 4. a rescue clears BOTH forms from the pile ==================
console.log('== 4. rescuing a word clears its old pile entry too ==');
{
  const { ctx, page } = await open('hub', {}, { trickyPile: ['w:because', 'spellboo:because', 'spellboo:keep'] });
  const pile = await page.evaluate(async () => {
    const { clearPersisted } = await import('./js/trickypile.js');
    clearPersisted(['spellboo:because']);
    return window.BooTown.State.getState().trickyPile.slice();
  });
  assert(!pile.includes('spellboo:because') && !pile.includes('w:because'),
    `clearing "spellboo:because" takes the pre-Y9 "w:because" with it (${JSON.stringify(pile)})`);
  assert(pile.includes('spellboo:keep'), 'and leaves everything else alone');
  await ctx.close();
}

// ================== 5. the Bubble Pop tier gates ==================
console.log('== 5. BUBBLE_CAT_TIER: bonds and doubles are Light, more-or-less is Medium ==');
{
  const { ctx, page } = await open('hub');
  const table = await page.evaluate(async () => (await import('./js/content.js')).BUBBLE_CAT_TIER);
  assert(table.tables === 'light', `tables: light (${table.tables})`);
  assert(table.bonds === 'light', `bonds: light (${table.bonds})`);
  assert(table.doubles === 'light', `doubles: light (${table.doubles})`);
  assert(table.moreless === 'medium', `moreless: medium (${table.moreless})`);
  assert(table.addsub === 'medium', `addsub: unchanged at medium (${table.addsub})`);
  await ctx.close();
}
{
  // the assertion the pack actually names: a LIGHT save, in the real picker.
  const { ctx, page } = await open('bubblepop', {}, {}, { content: 'light' });
  await page.waitForSelector('.picker');
  const names = await page.$$eval('.picker-choice .pc-name', ns => ns.map(n => n.textContent));
  assert(names.includes('Number bonds'), `a light-tier save sees Number bonds (${names.join(' · ')})`);
  assert(names.includes('Doubles & halves'), 'a light-tier save sees Doubles & halves');
  assert(!names.includes('More or less'), 'and still not More or less, which is Medium');
  assert(!names.includes('Add & subtract'), 'and still not Add & subtract, which is Medium');
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no page errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
