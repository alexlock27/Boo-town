// tests/r21h-norepeat.mjs — RUN21H A4: the session-scoped repeat-avoidance seam.
// One check per touched engine: sorting (data/sorting.js), sortingExtra, Blend It,
// Word Factory, Rhyme Time (targets + couplets), Sound Sorter (sounds + words),
// Twin Trouble, Apostrophe Patrol, Spell Boo (words + twins).
// The law under test: a session deals unseen items first and only repeats once the pool
// genuinely exhausts — at which point the cycle resets rather than starving.
// Pure builder calls through in-page imports; no frame evidence. Expected runtime: ~20s.

import { chromium } from 'playwright';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400 },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });

// ---- 1+2. sorting + sortingExtra: consecutive rounds cover the whole pool -------------
console.log('== 1. sorting/sortingExtra: fresh-first until the pool exhausts ==');
for (const [mod, ids] of [['./data/sorting.js', ['units1', 'halfEquivalent']], ['./data/sortingExtra.js', ['symmetry', 'timeUnits']]]) {
  const r = await page.evaluate(async ([m, wanted]) => {
    const { TEMPLATES, TEMPLATES_EXTRA } = await import(m).then(x => ({ TEMPLATES: x.TEMPLATES || [], TEMPLATES_EXTRA: x.TEMPLATES_EXTRA || [] }));
    const all = [...TEMPLATES, ...TEMPLATES_EXTRA];
    const out = [];
    for (const id of wanted) {
      const t = all.find(x => x.id === id);
      if (!t) { out.push({ id, missing: true }); continue; }
      // measure the pool (union over many rounds), then assert coverage in ceil(P/S)+2 rounds
      const pool = new Set();
      for (let i = 0; i < 60; i++) t.make().items.forEach(it => pool.add(it.key));
      const S = t.make().items.length;
      const need = Math.ceil(pool.size / S) + 2;
      const seen = new Set();
      let withinDup = false;
      for (let i = 0; i < need; i++) {
        const items = t.make().items;
        const keys = items.map(it => it.key);
        if (new Set(keys).size !== keys.length) withinDup = true;
        keys.forEach(k => seen.add(k));
      }
      out.push({ id, P: pool.size, S, need, covered: [...pool].every(k => seen.has(k)), withinDup });
    }
    return out;
  }, [mod, ids]);
  for (const t of r) {
    assert(!t.missing, `${t.id} template exists`);
    if (t.missing) continue;
    assert(t.covered, `${t.id}: every one of ${t.P} pool items dealt within ${t.need} rounds (round=${t.S})`);
    assert(!t.withinDup, `${t.id}: no item dealt twice within one round`);
  }
}

// ---- 3+4. Blend It + Word Factory: consecutive rounds are disjoint while pool allows ---
console.log('== 2. Blend It / Word Factory rounds do not repeat while the level has words ==');
{
  const r = await page.evaluate(async () => {
    const { buildBlendRound, buildFactoryRound } = await import('./js/games/blendit.js');
    const b1 = buildBlendRound(1, 8).map(e => e.w), b2 = buildBlendRound(1, 8).map(e => e.w);
    const f1 = buildFactoryRound(1, 8).map(i => i.id), f2 = buildFactoryRound(1, 8).map(i => i.id);
    const overlap = (a, b) => a.filter(x => b.includes(x)).length;
    return { blendOverlap: overlap(b1, b2), factoryOverlap: overlap(f1, f2), b1n: new Set(b1).size, f1n: new Set(f1).size };
  });
  assert(r.b1n === 8, `Blend It deals 8 distinct words (${r.b1n})`);
  assert(r.blendOverlap === 0, `two consecutive Blend It L1 rounds share no words (overlap ${r.blendOverlap})`);
  assert(r.f1n === 8, `Word Factory deals 8 distinct items (${r.f1n})`);
  assert(r.factoryOverlap === 0, `two consecutive Word Factory L1 rounds share no items (overlap ${r.factoryOverlap})`);
}

// ---- 5. Rhyme Time: a family leads with every member before repeating a target ---------
console.log('== 3. Rhyme Time targets cycle the family before repeating ==');
{
  const r = await page.evaluate(async () => {
    const { buildRhymeTarget, buildRhymeRound } = await import('./js/games/rhymetime.js');
    const { FAMILY_BY_KEY, COUPLETS } = await import('./data/rhymes.js');
    const fam = FAMILY_BY_KEY.at;
    const n = fam.members.length;
    const led = [];
    for (let i = 0; i < n; i++) led.push(buildRhymeTarget('at', 1).target);
    const allLed = new Set(led).size === n;
    // couplet rounds cover every couplet across consecutive sessions
    const seen = new Set();
    const sessions = Math.ceil(COUPLETS.length / Math.min(8, COUPLETS.length)) + 1;
    for (let i = 0; i < sessions; i++) buildRhymeRound(3).forEach(t => seen.add(t.index));
    return { allLed, n, couplets: COUPLETS.length, coupletsCovered: seen.size };
  });
  assert(r.allLed, `-at family leads with all ${r.n} members before any repeat`);
  assert(r.coupletsCovered === r.couplets, `couplet sessions cover all ${r.couplets} couplets (saw ${r.coupletsCovered})`);
}

// ---- 6. Sound Sorter: rounds visit every sound before repeating ------------------------
console.log('== 4. Sound Sorter sounds cycle before repeating ==');
{
  const r = await page.evaluate(async () => {
    const { buildRound } = await import('./js/games/soundsorter.js');
    const { PHONEME_KEYS } = await import('./data/phonemes.js');
    const s1 = buildRound(PHONEME_KEYS, 4, 8).map(t => t.sound);
    const s2 = buildRound(PHONEME_KEYS, 4, 8).map(t => t.sound);
    const union = new Set([...s1, ...s2]);
    return { d1: new Set(s1).size, union: union.size, total: PHONEME_KEYS.length };
  });
  assert(r.d1 === 8, `a round asks 8 distinct sounds (${r.d1})`);
  assert(r.union === r.total, `two rounds visit all ${r.total} sounds (saw ${r.union})`);
}

// ---- 7. Twin Trouble: consecutive L2 rounds share no sentences -------------------------
console.log('== 5. Twin Trouble deals fresh sentences ==');
{
  const r = await page.evaluate(async () => {
    const { buildTwinTroubleRound } = await import('./js/games/soundtwins.js');
    const c1 = buildTwinTroubleRound(2).cases.map(c => c.sentence);
    const c2 = buildTwinTroubleRound(2).cases.map(c => c.sentence);
    return { overlap: c1.filter(x => c2.includes(x)).length, n: new Set(c1).size };
  });
  assert(r.n === 8, `an L2 round deals 8 distinct sentences (${r.n})`);
  assert(r.overlap === 0, `two consecutive L2 rounds share no sentences (overlap ${r.overlap})`);
}

// ---- 8. Apostrophe Patrol: pickN cycles the pool ---------------------------------------
console.log('== 6. Apostrophe Patrol deals fresh items ==');
{
  const r = await page.evaluate(async () => {
    const { pickN } = await import('./js/games/apostrophepatrol.js');
    const { SQUEEZE } = await import('./data/apostrophe.js');
    const p1 = pickN(SQUEEZE, 8).map(i => i.id);
    const p2 = pickN(SQUEEZE, 8).map(i => i.id);
    const p3 = pickN(SQUEEZE, 8).map(i => i.id);   // pool of 16 exhausts; cycle resets
    return { overlap12: p1.filter(x => p2.includes(x)).length, n3: new Set(p3).size, pool: SQUEEZE.length };
  });
  assert(r.overlap12 === 0, `two squeeze rounds of 8 from ${r.pool} share nothing (overlap ${r.overlap12})`);
  assert(r.n3 === 8, `after the pool exhausts the cycle resets and still deals 8 distinct (${r.n3})`);
}

// ---- 9. Spell Boo: word and twin rounds avoid repeats ----------------------------------
console.log('== 7. Spell Boo deals fresh words and twin sentences ==');
{
  const r = await page.evaluate(async () => {
    const { pickWords, pickTwins } = await import('./js/games/spellboo.js');
    const w1 = pickWords('big', 1).map(w => w.w), w2 = pickWords('big', 1).map(w => w.w);
    const t1 = pickTwins(1).map(t => t.sentence), t2 = pickTwins(1).map(t => t.sentence);
    return {
      wOverlap: w1.filter(x => w2.includes(x)).length, wn: new Set(w1).size,
      tOverlap: t1.filter(x => t2.includes(x)).length, tn: new Set(t1).size
    };
  });
  assert(r.wn === 8, `a tier-1 round deals 8 distinct words (${r.wn})`);
  assert(r.wOverlap === 0, `two tier-1 rounds share no words (overlap ${r.wOverlap})`);
  assert(r.tn === 8, `a twins round deals 8 distinct sentences (${r.tn})`);
  assert(r.tOverlap === 0, `two twins rounds share no sentences (overlap ${r.tOverlap})`);
}

assert(errors.length === 0, `no JS page errors ${errors.length ? '! ' + errors[0] : ''}`);
await browser.close();
console.log(failed ? 'RESULT: FAIL' : 'RESULT: PASS');
process.exit(failed ? 1 : 0);
