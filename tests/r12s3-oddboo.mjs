// tests/r12s3-oddboo.mjs — RUN12 S3: Odd Boo Out is correct and honest.
//
// Two promises to a child:
//   1. the odd one is always findable BY LOOKING — exactly one item differs, on exactly one
//      feature, and every other feature is uniform across the whole grid;
//   2. the explanation names the part she actually saw — never an internal category, and
//      never a part that is identical between the odd Boo and the rest.
// Plus: sparkle is decoration OR the answer, never ambiguously both, so it is out of the
// answer pool entirely and never rendered inside a grid.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { oddGridFault } from '../js/brainhelpers.js';   // RUN18D D7
import { oddGrid, violatesOddPredicate, ODD_FEATURES, ODD_SPECIES_PAIRS, ODD_BASE_SPECIES,
         ODD_NEAR_COLOURS, ODD_GRID_SIZE, BRAIN_COLOURS } from '../js/brainhelpers.js';
import { renderBoo } from '../js/art.js';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run12/s3';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const ALL = ['colour', 'species', 'hat', 'shine'];
const TIERS = ['toddler', 'light', 'medium', 'full'];

// ---- 0. RUN18D D7: the guarantee is CHECKED at the point of service ------------------
// RUN12 S3 made the generator sound by construction, and §1 below still proves that at
// 1000 grids per tier. D7 asks for the promise to be made where the board is handed over,
// so that a future change to the construction cannot quietly un-make it. What is new here
// is the validator itself: it must pass every served board AND actually catch a broken one,
// because a check that never says no is not a check.
console.log('== every served board is validated, and the validator can say no ==');
{
  let served = 0, faults = [];
  for (const tier of TIERS) {
    for (let i = 0; i < 500; i++) {
      const g = oddGrid(tier);
      served++;
      const f = oddGridFault(g);
      if (f && faults.length < 3) faults.push(`${tier}: ${f}`);
      else if (f) served--;
    }
  }
  assert(served === TIERS.length * 500 && faults.length === 0,
    `${TIERS.length * 500} served boards, zero ambiguous (${faults.join(' | ') || 'none'})`);

  // …and it is not a rubber stamp. Four hand-broken boards, four different refusals.
  const twoDiffs = oddGrid('full');
  twoDiffs.items[twoDiffs.oddIndex] = { ...twoDiffs.items[twoDiffs.oddIndex], hat: !twoDiffs.items[twoDiffs.oddIndex].hat, colour: 'gold' };
  assert(!!oddGridFault(twoDiffs), 'a board whose odd Boo differs twice is refused');

  const noAnswer = oddGrid('full');
  noAnswer.items[noAnswer.oddIndex] = { ...noAnswer.items[(noAnswer.oddIndex + 1) % noAnswer.items.length] };
  assert(/no answer/.test(oddGridFault(noAnswer) || ''), 'a board with no odd Boo at all is refused');

  const mixedCrowd = oddGrid('full');
  const other = mixedCrowd.oddIndex === 0 ? 1 : 0;
  mixedCrowd.items[other] = { ...mixedCrowd.items[other], hat: !mixedCrowd.items[other].hat };
  assert(/ordinary Boos disagree/.test(oddGridFault(mixedCrowd) || ''), 'a board where two ORDINARY Boos disagree is refused');

  const sparkly = oddGrid('full');
  sparkly.items = sparkly.items.map((b, i) => ({ ...b, ...(i === sparkly.oddIndex ? {} : {}) }));
  const s0 = sparkly.items[sparkly.oddIndex === 0 ? 1 : 0];
  sparkly.items = sparkly.items.map((b, i) => (i === sparkly.oddIndex ? { ...s0, shine: true } : { ...s0 }));
  sparkly.oddFeature = 'shine';
  assert(/sparkle/.test(oddGridFault(sparkly) || ''), 'a board whose only difference is sparkle is refused');
}

// ---- 1. uniqueness, at 1000 grids per tier ------------------------------------------
console.log('== 1000 grids per tier: exactly one item, differing on exactly one feature ==');
for (const tier of TIERS) {
  let bad = null, shinyOdd = 0, evenSplit = 0, accessoryMixed = 0;
  for (let i = 0; i < 1000 && !bad; i++) {
    const g = oddGrid(tier, Math.random, {});
    const others = g.items.filter((_, ix) => ix !== g.oddIndex);
    const oddBoo = g.items[g.oddIndex];

    if (g.items.length !== ODD_GRID_SIZE[tier]) bad = `grid size ${g.items.length}`;
    // every non-odd Boo identical on every feature
    const nonUniform = ALL.filter(f => new Set(others.map(o => String(o[f]))).size > 1);
    if (!bad && nonUniform.length) bad = `non-odd items differ on ${nonUniform.join('+')}`;
    // the odd Boo differs on exactly one, and it is the declared one
    const diffs = ALL.filter(f => oddBoo[f] !== others[0][f]);
    if (!bad && diffs.length !== 1) bad = `odd Boo differs on ${diffs.length} features (${diffs.join('+')})`;
    if (!bad && diffs[0] !== g.oddFeature) bad = `odd differs on ${diffs[0]} but declares ${g.oddFeature}`;
    // exactly one violator by the game's own predicate
    const violators = g.items.filter(it => violatesOddPredicate(it, g)).length;
    if (!bad && violators !== 1) bad = `${violators} violators by violatesOddPredicate`;

    if (g.oddFeature === 'shine') shinyOdd++;
    if (g.items.some(it => it.shine)) shinyOdd++;
    // accessory uniformity: every non-odd Boo wears the SAME hat state (not merely "a hat")
    if (new Set(others.map(o => String(o.hat))).size > 1) accessoryMixed++;
    // no feature may split the grid evenly — that is the "no unique odd one" shape
    for (const f of ALL) {
      const counts = {};
      g.items.forEach(o => { counts[String(o[f])] = (counts[String(o[f])] || 0) + 1; });
      const vals = Object.values(counts);
      if (vals.length === 2 && vals[0] === vals[1]) evenSplit++;
    }
  }
  assert(!bad, `${tier}: 1000 grids all uniform-with-one-difference${bad ? ' → ' + bad : ''}`);
  assert(shinyOdd === 0, `${tier}: shine is never the odd feature and never renders in a grid (${shinyOdd})`);
  assert(accessoryMixed === 0, `${tier}: the non-odd Boos always wear the IDENTICAL accessory (${accessoryMixed})`);
  assert(evenSplit === 0, `${tier}: no grid contains an even split on any feature (${evenSplit})`);
}

console.log('== the answer pool excludes shine, and cannot be talked into it ==');
assert(!ODD_FEATURES.includes('shine'), 'ODD_FEATURES has no shine');
assert(oddGrid('full', Math.random, { oddFeature: 'shine' }).oddFeature !== 'shine',
  'asking for shine explicitly still returns a real feature');

// ---- 2. difficulty rises without becoming ambiguous ---------------------------------
console.log('== higher tiers get subtler, never ambiguous ==');
{
  const nearSet = new Set(ODD_NEAR_COLOURS.map(p => [...p].sort().join('|')));
  const colourPairs = { light: [], full: [] };
  const speciesLabels = { light: new Set(), full: new Set() };
  for (const tier of ['light', 'full']) {
    for (let i = 0; i < 500; i++) {
      const g = oddGrid(tier, Math.random, { oddFeature: 'colour' });
      const others = g.items.filter((_, ix) => ix !== g.oddIndex);
      colourPairs[tier].push([g.items[g.oddIndex].colour, others[0].colour].sort().join('|'));
      speciesLabels[tier].add(oddGrid(tier, Math.random, { oddFeature: 'species' }).oddLabel);
    }
  }
  const lightNear = colourPairs.light.filter(p => nearSet.has(p)).length;
  const fullNear = colourPairs.full.filter(p => nearSet.has(p)).length;
  assert(lightNear === 0, `light never pairs two near-identical colours (${lightNear}/500)`);
  assert(fullNear === 500, `full always pairs visually close colours (${fullNear}/500)`);
  const loud = new Set(ODD_SPECIES_PAIRS.filter(p => !p.subtle).map(p => p.label));
  const subtle = new Set(ODD_SPECIES_PAIRS.filter(p => p.subtle).map(p => p.label));
  assert([...speciesLabels.light].every(l => loud.has(l)), `light uses only the loud signatures (${[...speciesLabels.light]})`);
  assert([...speciesLabels.full].every(l => subtle.has(l)), `full uses only the subtle signatures (${[...speciesLabels.full]})`);
}

// ---- 3. label honesty, checked against the RENDERED art -----------------------------
// Each species label names a part. Prove that part genuinely differs in the SVG between
// the grid's base Boo and the odd Boo — a label may never name something identical.
console.log('== every species label names a part that really is different ==');
{
  const svg = (species) => renderBoo({ species, colors: { body: 'indigo' } }, { size: 128 });
  // the marker for each named part, taken from js/art.js speciesGeom()
  const PART_MARKER = {
    ears:    (s) => /rotate\(-8 44 26\)/.test(s),                     // pip's tall rabbit ears
    antenna: (s) => /M60 46 C58 24 80 24 78 12/.test(s),              // twirl's curly antenna
    tail:    (s) => /M96 84 C118 80 116 104 98 104/.test(s),          // nova's swirl tail
    // sunny's star pupils: a gold star path, not the ink circle every other species gets.
    // (twirl's antenna bobble is also gold but is a circle at stroke-width 3.)
    eyes:    (s) => /fill="#FFC93C" stroke="#2A1B4E" stroke-width="1\.5"/.test(s),
    mouth:   (s) => /M42 93 Q60 114 78 93/.test(s)                    // munch's wide toothy grin
  };
  const baseSvg = svg(ODD_BASE_SPECIES);
  for (const pair of ODD_SPECIES_PAIRS) {
    const oddSvg = svg(pair.odd);
    const marker = PART_MARKER[pair.label];
    assert(!!marker, `'${pair.label}' has a rendered marker to check against`);
    if (!marker) continue;
    assert(marker(oddSvg) !== marker(baseSvg),
      `'${pair.label}' really differs between ${ODD_BASE_SPECIES} and ${pair.odd} in the rendered art`);
    assert(marker(oddSvg), `${pair.odd} is the one that HAS the ${pair.label}`);
  }
  // and every label the generator can emit is a part word, never an internal category
  const emitted = new Set();
  for (let i = 0; i < 600; i++) emitted.add(oddGrid('medium', Math.random, {}).oddLabel);
  const allowed = new Set(['colour', 'hat', ...ODD_SPECIES_PAIRS.map(p => p.label)]);
  assert([...emitted].every(l => allowed.has(l)), `every emitted label is authored (${[...emitted].sort().join(', ')})`);
  assert(!emitted.has('shape'), "the word 'shape' is gone — it named nothing a child could see");
  assert(!emitted.has('sparkle'), "the word 'sparkle' is gone with the feature");
}

// ---- 4. the live game says what the generator meant ---------------------------------
const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const save = (content) => JSON.stringify({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { oddboo: true } },
  settings: { sound: false, music: false, voice: false, content }
});

const browser = await chromium.launch({ args: RESOLVE });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save('full'));
await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });

console.log('== 200 scripted rounds: the explanation always matches the generator ==');
{
  // RUN14 U-0 board diet: the SAME 200 rounds and the SAME assertions, but the product's
  // own pacing timers (the 1.5s anti-brute-force lockout, the 720ms round advance) are
  // fast-forwarded through Playwright's stubbed clock instead of slept through. This is
  // a logic-honesty suite, not frame evidence, so the evidence law permits clock stubbing.
  // Real time before: ~2.3s × 200 rounds ≈ 7½ minutes of pure waiting.
  await page.clock.install();
  await page.evaluate(() => window.BooTown.go('oddboo'));
  await page.clock.runFor(1500);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.clock.runFor(400);
  const r = { rounds: 0, mismatches: [], shineRendered: 0, wrongHintMismatch: 0, labels: {} };
  for (let i = 0; i < 200; i++) {
    const g = await page.evaluate(() => {
      const g = window.__oddboo && window.__oddboo.grid();
      return g ? { oddIndex: g.oddIndex, oddLabel: g.oddLabel, oddFeature: g.oddFeature, n: g.items.length,
        shine: [...document.querySelectorAll('.odd-art svg')].some(s => /shimmer|rfx-|sparkle/i.test(s.outerHTML)) } : null;
    });
    if (!g) break;
    r.labels[g.oddLabel] = (r.labels[g.oddLabel] || 0) + 1;
    if (g.shine) r.shineRendered++;
    // tap a WRONG Boo first: the nudge must name the same part
    const nudge = await page.evaluate((wrongIndex) => {
      window.__oddboo.choose(wrongIndex, document.querySelectorAll('.odd-choice')[wrongIndex]);
      return (document.querySelector('.peek-bubble') || {}).textContent || '';
    }, (g.oddIndex + 1) % g.n);
    if (!nudge.includes(g.oddLabel)) r.wrongHintMismatch++;
    await page.clock.runFor(1520);   // the lockout expires
    const said = await page.evaluate((oddIndex) => {
      window.__oddboo.choose(oddIndex, document.querySelectorAll('.odd-choice')[oddIndex]);
      return (document.querySelector('.peek-bubble') || {}).textContent || '';
    }, g.oddIndex);
    if (!said.includes(g.oddLabel)) r.mismatches.push({ said, expected: g.oddLabel, feature: g.oddFeature });
    r.rounds++;
    await page.clock.runFor(760);    // the round advances; the game restarts itself after 10
    const alive = await page.evaluate(() => !!window.__oddboo);
    if (!alive) {
      // results screen: clear any celebration overlays it stacked, then a fresh game
      await page.evaluate(() => { document.querySelectorAll('.trophy-ceremony, .overlay').forEach(n => n.remove()); window.BooTown.go('oddboo'); });
      await page.clock.runFor(1200);
    }
  }
  assert(r.rounds >= 200, `drove ${r.rounds} scripted rounds`);
  assert(r.mismatches.length === 0,
    `the spoken explanation names the generator's own label every time${r.mismatches.length ? ' → ' + JSON.stringify(r.mismatches[0]) : ''}`);
  assert(r.wrongHintMismatch === 0, `the wrong-tap nudge names the same part every time (${r.wrongHintMismatch} off)`);
  assert(r.shineRendered === 0, `no shimmer ever rendered inside a grid (${r.shineRendered})`);
  assert(Object.keys(r.labels).length >= 3, `the rotation exercised several labels (${JSON.stringify(r.labels)})`);
  assert(errors.length === 0, `zero page errors across 200 rounds${errors.length ? ' → ' + errors[0] : ''}`);
}

// ---- 5. a rendered screenshot per feature ------------------------------------------
console.log('== a rendered example per answer feature ==');
for (const feature of ODD_FEATURES) {
  const labels = feature === 'species' ? ODD_SPECIES_PAIRS.map(p => p.odd) : [feature];
  for (const variant of labels) {
    const got = await page.evaluate(async ([f, v]) => {
      const { oddGrid, ODD_SPECIES_PAIRS } = await import('./js/brainhelpers.js');
      const { renderBoo } = await import('./js/art.js');
      let g = null;
      for (let i = 0; i < 400; i++) {
        const cand = oddGrid('medium', Math.random, { oddFeature: f });
        if (f !== 'species' || cand.items[cand.oddIndex].species === v) { g = cand; break; }
      }
      if (!g) return null;
      const board = document.createElement('div');
      board.className = 'odd-grid';
      board.dataset.count = String(g.items.length);
      g.items.forEach((b, i) => {
        const btn = document.createElement('button');
        btn.className = 'odd-choice' + (b.hat ? ' has-hat' : '');
        btn.innerHTML = '<span class="odd-art">' + renderBoo({ species: b.species, colors: { body: b.colour },
          acc: b.hat ? 'cap' : null, fx: null }, { size: 128, cls: 'odd-boo-svg' }) + '</span>';
        board.appendChild(btn);
      });
      const area = document.querySelector('.game-area') || document.body;
      area.querySelectorAll('.odd-grid').forEach(n => n.remove());
      area.appendChild(board);
      return { label: g.oddLabel, odd: g.items[g.oddIndex].species };
    }, [feature, variant]);
    assert(!!got, `a ${feature}/${variant} grid could be generated for the screenshot`);
    if (!got) continue;
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/label-${got.label}.png` });
    console.log(`    → ${SHOTS}/label-${got.label}.png (odd = ${got.odd})`);
  }
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
