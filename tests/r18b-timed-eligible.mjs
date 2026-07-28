// tests/r18b-timed-eligible.mjs — RUN18B Y10: the timed games practise mastered material.
//
// The pack: ONE policy function, `eligibleForTimed(item)` = ledger rights >= 2 OR the item is
// absent from ledger misses. Boo Beat and Bubble Pop draw only eligible items; if the
// eligible pool is smaller than the round's needs x1.5 they fall back to the full pool,
// SILENTLY. Untimed games and Teach Me are untouched — they are the introduction path.
//
// Assertions here: the truth table; a seeded ledger proving the filter in a REAL round of
// each game; a seeded ledger proving the fallback (and that nothing on screen mentions it);
// and a fresh save with an empty ledger playing exactly as before.
// Expected runtime: ~11s. Not @serial.

import { chromium } from 'playwright';
import { readFileSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const INTROS = ['bubblepop', 'beat', 'spellboo', 'feedboos', 'blocks', 'bounce', 'dash', 'teachme'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 }, trophies: {}, boxes: 0,
  meter: 0, spellingMastery: {}, ledger: {}, trickyPile: [],
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: Object.fromEntries(INTROS.map(g => [g, true])) },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open() {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  return { ctx, page };
}
// Seed the ledger through the app's own mutate: seeding localStorage and reloading races the
// hub's debounced autosave (CLAUDE.md's own pitfall list).
const seedLedger = (page, ledger) => page.evaluate(async (l) => {
  const st = await import('./js/state.js');
  st.mutate(s => { s.ledger = l; });
}, ledger);
const INELIGIBLE = { rights: 0, misses: 2, lastSeen: 1 };

// Bubble Pop, Times tables level 1: keys are `tmul{table}:{factor}`, tables 2/3/4/5/8/10,
// factors 1..12 — 72 identities, an enumerable pool to seed against.
const TABLES_L1 = [2, 3, 4, 5, 8, 10];
const tmul = (t, f) => `tmul${t}:${f}`;
const ALL_TABLE_KEYS = TABLES_L1.flatMap(t => Array.from({ length: 12 }, (_, i) => tmul(t, i + 1)));
const LOW_HALF = ALL_TABLE_KEYS.filter(k => +k.split(':')[1] <= 6);     // 36 seeded ineligible
// Boo Beat, Number bonds level 2: keys are `b{a}:100`, a = 1..99.
const ALL_BOND_KEYS = Array.from({ length: 99 }, (_, i) => `b${i + 1}:100`);
const BOND_BLOCK = ALL_BOND_KEYS.slice(0, 60);                          // 60 seeded ineligible

// ================== 1. the policy function ==================
console.log('== 1. eligibleForTimed: two rights, or never got wrong ==');
{
  const { ctx, page } = await open();
  await seedLedger(page, {
    twoRights: { rights: 2, misses: 5, lastSeen: 1 },
    oneRight: { rights: 1, misses: 1, lastSeen: 1 },
    onlyMisses: { rights: 0, misses: 3, lastSeen: 1 },
    neverWrong: { rights: 1, misses: 0, lastSeen: 1 }
  });
  const r = await page.evaluate(async () => {
    const { eligibleForTimed, TIMED_RIGHTS } = await import('./js/smartmix.js');
    return {
      need: TIMED_RIGHTS,
      twoRights: eligibleForTimed('twoRights'),
      oneRight: eligibleForTimed('oneRight'),
      onlyMisses: eligibleForTimed('onlyMisses'),
      neverWrong: eligibleForTimed('neverWrong'),
      absent: eligibleForTimed('nobodyHasEverSeenThis'),
      byKey: eligibleForTimed({ key: 'oneRight' }),
      byId: eligibleForTimed({ id: 'twoRights' })
    };
  });
  assert(r.need === 2, `TIMED_RIGHTS is 2 (${r.need})`);
  assert(r.twoRights === true, 'two rights is eligible even with more misses than rights');
  assert(r.oneRight === false, 'one right and one miss is NOT eligible');
  assert(r.onlyMisses === false, 'misses and no rights is NOT eligible');
  assert(r.neverWrong === true, 'never got wrong is eligible on one right');
  assert(r.absent === true, 'an item she has never met is eligible — a fresh save plays normally');
  assert(r.byKey === false && r.byId === true, 'a question object is read by .key, a pool item by .id');
  await ctx.close();
}

// ================== 2. Bubble Pop draws only eligible items ==================
console.log('== 2. Bubble Pop: a seeded ledger keeps the shaky half out of a timed round ==');
{
  const { ctx, page } = await open();
  await seedLedger(page, Object.fromEntries(LOW_HALF.map(k => [k, INELIGIBLE])));
  await page.evaluate(() => window.BooTown.go('bubblepop', { resume: { cat: 'tables', level: 1 } }));
  await page.waitForSelector('.bubble-field', { timeout: 15000 });
  const gate = await page.evaluate(() => window.__bubblepop.gate());
  // (the probe stops as soon as it has `want`, so `found` reads exactly `want` on success)
  assert(gate.on === true, `36 of the level's 72 identities are eligible — more than the round's 10 x1.5 = ${gate.want} — so the filter is on (probe found ${gate.found})`);
  const keys = await page.evaluate(async () => {
    const seen = [];
    for (let i = 0; i < 9; i++) { seen.push(window.__bubblepop.key()); window.__bubblepop.popCorrect(); await new Promise(r => setTimeout(r, 420)); }
    return seen;
  });
  const bad = keys.filter(k => LOW_HALF.includes(k));
  assert(keys.length === 9 && keys.every(Boolean), `nine questions were asked (${keys.join(' ')})`);
  assert(bad.length === 0, `every one of them is an eligible identity — none of the seeded shaky half (bad: ${bad.join(' ') || 'none'})`);
  await ctx.close();
}

// ================== 3. Bubble Pop falls back, and says nothing about it ==================
console.log('== 3. Bubble Pop: too few eligible identities falls back to the full pool ==');
{
  const { ctx, page } = await open();
  await seedLedger(page, Object.fromEntries(ALL_TABLE_KEYS.map(k => [k, INELIGIBLE])));
  await page.evaluate(() => window.BooTown.go('bubblepop', { resume: { cat: 'tables', level: 1 } }));
  await page.waitForSelector('.bubble-field', { timeout: 15000 });
  const gate = await page.evaluate(() => window.__bubblepop.gate());
  assert(gate.on === false && gate.found === 0, `no identity in the whole level is eligible, so the round falls back (found ${gate.found} of ${gate.want})`);
  const r = await page.evaluate(async () => {
    const seen = [];
    for (let i = 0; i < 4; i++) { seen.push(window.__bubblepop.key()); window.__bubblepop.popCorrect(); await new Promise(r => setTimeout(r, 420)); }
    return { seen, text: (document.querySelector('.game-shell') || document.body).innerText };
  });
  assert(r.seen.every(Boolean) && r.seen.length === 4, `the round plays on regardless (${r.seen.join(' ')})`);
  assert(r.seen.every(k => ALL_TABLE_KEYS.includes(k)), 'and it is still asking Times tables — the full pool, not an empty one');
  assert(!/easier|eligible|practis|master(ed)? (only|first)|not ready/i.test(r.text),
    'and NOTHING on screen tells her a bar was lowered for her');
  await ctx.close();
}

// ================== 4. a fresh save plays exactly as before ==================
console.log('== 4. an empty ledger: everything is eligible, the round is unchanged ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.BooTown.go('bubblepop', { resume: { cat: 'tables', level: 1 } }));
  await page.waitForSelector('.bubble-field', { timeout: 15000 });
  const gate = await page.evaluate(() => window.__bubblepop.gate());
  assert(gate.on === true, 'a fresh save finds a full eligible pool (nothing has ever been got wrong)');
  const st = await page.evaluate(async () => {
    for (let i = 0; i < 5; i++) { window.__bubblepop.popCorrect(); await new Promise(r => setTimeout(r, 420)); }
    return window.__bubblepop.state();
  });
  assert(st.solved === 5, `five pops solve five (${st.solved})`);
  await ctx.close();
}

// ================== 5. Boo Beat draws only eligible items ==================
// Beat's questions arrive on falling notes, so rather than fight the clock this mounts the
// round repeatedly and reads the question it opens on — the same gate.pick call the rest of
// the round uses. Eight independent mounts against a 60/99 seeded block: if the filter were
// off, the odds of all eight landing in the eligible 39 are about 1 in 3000.
console.log('== 5. Boo Beat: the same filter, in a game with a clock behind it ==');
{
  const { ctx, page } = await open();
  await seedLedger(page, Object.fromEntries(BOND_BLOCK.map(k => [k, INELIGIBLE])));
  const keys = [];
  let gate = null;
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.BooTown.go('beat', { resume: { cat: 'bonds', level: 2 } }));
    await page.waitForSelector('.beat-field', { timeout: 15000 });
    const r = await page.evaluate(() => ({ key: window.__beat.key(), gate: window.__beat.gate() }));
    keys.push(r.key); gate = r.gate;
    await page.evaluate(() => window.BooTown.go('hub'));
    await page.waitForSelector('.hub', { timeout: 15000 });
  }
  assert(gate.on === true, `39 of the level's 99 bonds are eligible — more than the round's 10 x1.5 = ${gate.want} (probe found ${gate.found})`);
  assert(keys.every(k => /^b\d+:100$/.test(k)), `eight rounds opened on a Number bonds question (${keys.join(' ')})`);
  const bad = keys.filter(k => BOND_BLOCK.includes(k));
  assert(bad.length === 0, `not one of them is a blocked identity (bad: ${bad.join(' ') || 'none'})`);
  await ctx.close();
}

// ================== 6. Boo Beat falls back too ==================
console.log('== 6. Boo Beat: nothing eligible falls back, silently ==');
{
  const { ctx, page } = await open();
  await seedLedger(page, Object.fromEntries(ALL_BOND_KEYS.map(k => [k, INELIGIBLE])));
  await page.evaluate(() => window.BooTown.go('beat', { resume: { cat: 'bonds', level: 2 } }));
  await page.waitForSelector('.beat-field', { timeout: 15000 });
  const r = await page.evaluate(() => ({ key: window.__beat.key(), gate: window.__beat.gate(), text: document.body.innerText }));
  assert(r.gate.on === false && r.gate.found === 0, `no eligible bond at all, so the gate is off (found ${r.gate.found} of ${r.gate.want})`);
  assert(/^b\d+:100$/.test(r.key), `and the round still opens on a real question (${r.key})`);
  assert(!/easier|eligible|practis|not ready/i.test(r.text), 'with nothing on screen about it');
  await ctx.close();
}

// ================== 7. the untimed path is untouched ==================
console.log('== 7. the introduction path still introduces ==');
for (const f of ['spellboo', 'feedboos', 'teachme', 'blendit', 'soundsorter']) {
  const body = readFileSync(`js/games/${f}.js`, 'utf8');
  assert(body.length > 0 && !/eligibleForTimed|timedGate/.test(body),
    `${f} does not filter by timed eligibility — the untimed games are where she MEETS things`);
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no page errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
