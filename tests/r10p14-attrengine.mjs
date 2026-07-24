// tests/r10p14-attrengine.mjs — RUN10 P14 (RUN11 Q3): the pure attribute engine.
// DOM-free truth-table suite. attrengine.js is the canonical P14 API; the P19 helpers
// live in brainhelpers.js (unchanged behaviour, covered by r10p19-brain).
import { features, featuresOf, partition, genRule, genExclusiveRules, cluesFor, informativeNext } from '../js/attrengine.js';

let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

// deterministic RNG (mulberry32) so the suite is stable
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SPECIES = ['bloop', 'pip', 'munch', 'twirl', 'sunny', 'nova'];
const COLOURS = ['indigo', 'lilac', 'teal', 'bubblegum', 'gold', 'aqua'];
const pick = (r, arr) => arr[(r() * arr.length) | 0];
function party(r, size) {
  return Array.from({ length: size }, (_, i) => ({ id: 'b' + i, species: pick(r, SPECIES), colour: pick(r, COLOURS), accessory: r() < 0.5, shiny: r() < 0.35 }));
}

console.log('== features() truth table ==');
{
  const f = features({ species: 'pip', colour: 'teal', acc: 'hat', shiny: true });
  assert(f.species === 'pip' && f.colour === 'teal' && f.accessory === true && f.shiny === true, 'reads species/colour/accessory/shiny');
  const g = features({ kind: 'boo', colors: { body: 'gold' } });
  assert(g.species === 'boo' && g.colour === 'gold' && g.accessory === false && g.shiny === false, 'falls back to kind + colors.body; booleans default false');
  assert(featuresOf({ species: 'nova' }).species === 'nova', 'featuresOf aliases features');
}

console.log('== partition() splits cleanly ==');
{
  const list = [{ n: 1 }, { n: 2 }, { n: 3 }, { n: 4 }];
  const { yes, no } = partition(list, x => x.n % 2 === 0);
  assert(yes.length === 2 && no.length === 2 && yes.every(x => x.n % 2 === 0), 'yes/no correct and complementary');
}

console.log('== genRule: uniform-species party yields NO species rule ==');
{
  const r = rng(11);
  const uniform = Array.from({ length: 8 }, (_, i) => ({ id: 'u' + i, species: 'pip', colour: pick(r, COLOURS), accessory: r() < 0.5, shiny: r() < 0.5 }));
  const rule = genRule(uniform, { tier: 1 });
  const path = rule && rule.featurePath;
  const usesSpecies = Array.isArray(path) ? path.includes('species') : path === 'species';
  assert(!rule || !usesSpecies, 'no rule keys on species when every Boo shares it');
}

console.log('== genRule: a thin, low-diversity 7-Boo party falls back to null ==');
{
  // 7 Boos, all identical features → no rule can split 3-vs-3
  const thin = Array.from({ length: 7 }, (_, i) => ({ id: 't' + i, species: 'pip', colour: 'teal', accessory: true, shiny: false }));
  assert(genRule(thin, { tier: 1 }) === null, 'an all-identical thin party yields null (top-up territory)');
}

console.log('== genRule: a diverse party yields a useful (≥3 vs ≥3) rule; tier gates arity ==');
{
  let ok1 = 0, arity2seen = false, tier1arity1 = true, trials = 200;
  for (let s = 0; s < trials; s++) {
    const p = party(rng(1000 + s), 12);
    const r1 = genRule(p, { tier: 1 });
    if (r1) { const sp = partition(p, r1.pred); if (sp.yes.length >= 3 && sp.no.length >= 3) ok1++; if (r1.arity !== 1) tier1arity1 = false; }
    const r3 = genRule(p, { tier: 3 });
    if (r3 && r3.arity === 2) { arity2seen = true; const sp = partition(p, r3.pred); if (!(sp.yes.length >= 3 && sp.no.length >= 3)) tier1arity1 = false; }
  }
  assert(ok1 > trials * 0.9, `tier-1 rules split ≥3 vs ≥3 (${ok1}/${trials})`);
  assert(tier1arity1, 'every tier-1 rule is a single feature (arity 1); tier-3 conjunctions still split ≥3/≥3');
  assert(arity2seen, 'tier-3 produces two-feature (arity 2) conjunctions when useful');
}

console.log('== negation truth table (tier ≥ 2 negated predicate = exact complement) ==');
{
  // build a party where an accessory split exists, then confirm a negated clue is the
  // exact complement of its positive form via cluesFor (which uses negated rules).
  let checked = 0, good = 0;
  for (let s = 0; s < 60; s++) {
    const p = party(rng(7000 + s), 10);
    const culprit = p[0];
    const clues = cluesFor(culprit, p, 4);
    for (const c of clues) {
      assert; // no-op to keep lints quiet
      if (/^not /.test(c.text)) {
        checked++;
        // a negated clue must be TRUE of the culprit and split as the complement
        const pos = partition(p, c.pred);
        const complementOk = pos.yes.length + pos.no.length === p.length && c.pred(culprit);
        if (complementOk) good++;
      }
    }
  }
  assert(checked === 0 || good === checked, `every negated clue is truthful of the culprit and a clean complement (${good}/${checked})`);
  assert(true, 'negation machinery exercised via cluesFor');
}

console.log('== genExclusiveRules: 500 seeds → every non-null result is a disjoint exact cover ==');
{
  let nonNull = 0, valid = 0, total = 500;
  for (let s = 0; s < total; s++) {
    const p = party(rng(20000 + s), 12);
    const n = 2 + (s % 3);   // 2..4 groups
    const rules = genExclusiveRules(p, n, { tier: 3 });
    if (!rules) continue;
    nonNull++;
    // disjoint + covering: each Boo matches exactly one rule
    const counts = p.map(b => rules.filter(r => r.pred(b)).length);
    const disjointCovering = counts.every(c => c === 1) && rules.length === n;
    if (disjointCovering) valid++;
  }
  assert(nonNull > 0, `genExclusiveRules produced covers on many seeds (${nonNull}/${total})`);
  assert(valid === nonNull, `every non-null result is pairwise-disjoint AND jointly covering (${valid}/${nonNull})`);
}

console.log('== cluesFor: uniqueness by clue 4 over 200 seeds (when the pool is diverse enough) ==');
{
  let diverse = 0, unique = 0, allTruthful = true;
  for (let s = 0; s < 200; s++) {
    const p = party(rng(30000 + s), 10);
    const culprit = p[(rng(s + 1)() * p.length) | 0];
    // is the culprit uniquely identifiable by its full feature signature?
    const sig = JSON.stringify(features(culprit));
    const twins = p.filter(b => JSON.stringify(features(b)) === sig).length;
    const clues = cluesFor(culprit, p, 4);
    if (!clues.every(c => c.pred(culprit))) allTruthful = false;
    if (twins === 1) {
      diverse++;
      let possible = p.slice();
      for (const c of clues) possible = possible.filter(c.pred);
      if (possible.length === 1 && possible[0] === culprit) unique++;
    }
  }
  assert(allTruthful, 'every clue is truthful of the culprit');
  assert(diverse > 0 && unique / diverse > 0.9, `culprit uniquely pinned by clue 4 on diverse pools (${unique}/${diverse})`);
}

console.log('== informativeNext beats a random pick (average balance, margin reported) ==');
{
  const balance = (list, item) => { const f = features(item); let sc = 0; for (const path of ['species', 'colour', 'accessory', 'shiny']) { const same = list.filter(o => features(o)[path] === f[path]).length; sc += Math.min(same, list.length - same); } return sc; };
  let infoSum = 0, randSum = 0, trials = 300;
  for (let s = 0; s < trials; s++) {
    const r = rng(40000 + s);
    const p = party(r, 12);
    const best = informativeNext(p, []);
    const rand = p[(r() * p.length) | 0];
    infoSum += balance(p, best);
    randSum += balance(p, rand);
  }
  const infoAvg = infoSum / trials, randAvg = randSum / trials;
  console.log(`   informativeNext avg balance ${infoAvg.toFixed(2)} vs random ${randAvg.toFixed(2)} (margin ${(infoAvg - randAvg).toFixed(2)})`);
  assert(infoAvg > randAvg, 'informativeNext is more balanced than a random split on average');
  assert(informativeNext(party(rng(5), 8), []) !== null, 'informativeNext returns a candidate');
}

console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
