import { features, partition, genRule, genExclusiveRules, cluesFor, informativeNext } from '../js/attrengine.js';
import { SUSPECTS } from '../js/caper/state.js';
let failed = false;
const ok = (v, m) => { console.log((v ? '✓' : 'FAIL:'), m); if (!v) failed = true; };

const pool = Array.from({ length: 12 }, (_, i) => ({ id: i, species: i % 2 ? 'pip' : 'nova', colors: { body: i % 3 ? 'teal' : 'lilac' }, acc: i % 4 === 0 ? 'bow' : null, shiny: i % 5 === 0 }));
ok(features(pool[0]).colour === 'lilac', 'features normalises catalogue colour');
ok(!genRule(pool.map(x => ({ ...x, species: 'pip' })), { tier: 1, exclude: ['colour', 'accessory', 'shiny'] }), 'uniform species never creates a species rule');

function toyParty(seed) {
  const species = ['pip', 'nova', 'munch']; const colours = ['teal', 'lilac'];
  return Array.from({ length: 12 }, (_, i) => ({ id: `${seed}-${i}`, species: species[(i + seed) % 3], colors: { body: colours[(i * 2 + seed) % 2] }, acc: (i + seed) % 4 === 0 ? 'bow' : null, shiny: (i * 3 + seed) % 5 === 0 }));
}
let engineSafe = true;
for (let seed = 0; seed < 50; seed++) {
  const party = toyParty(seed);
  for (let tier = 1; tier <= 4; tier++) {
    const rule = genRule(party, { tier }); const split = rule && partition(party, rule.pred);
    engineSafe = engineSafe && !!rule && split.yes.length >= 3 && split.no.length >= 3;
    if (tier === 4) engineSafe = engineSafe && typeof rule.swap === 'function' && typeof rule.swap().pred === 'function';
  }
  for (const count of [2, 3]) {
    const rules = genExclusiveRules(party, count, { tier: 3 });
    engineSafe = engineSafe && !!rules && rules.length === count && party.every(item => rules.filter(rule => rule.pred(item)).length === 1);
  }
}
ok(engineSafe, '50 seeded toy parties generate balanced rules and exact exclusive covers at all tiers');

let cluesUnique = true;
for (let seed = 0; seed < 200; seed++) {
  const culprit = SUSPECTS[seed % SUSPECTS.length];
  const shuffled = [...SUSPECTS].sort((a, b) => ((a.id.charCodeAt(0) * (seed + 3)) % 7) - ((b.id.charCodeAt(0) * (seed + 3)) % 7));
  const clues = cluesFor(culprit, shuffled, 4);
  cluesUnique = cluesUnique && clues.length === 4 && clues.every(clue => clue.pred(culprit)) && shuffled.filter(s => clues.every(clue => clue.pred(s))).length === 1;
}
ok(cluesUnique, 'Caper clues identify exactly one suspect by card four across 200 seeded orderings');
ok(informativeNext(pool, [pool[0]]) !== pool[0], 'informative next never repeats history');
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS')); process.exit(failed ? 1 : 0);
