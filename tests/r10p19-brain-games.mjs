import { makeRound } from '../js/games/oddboo.js';
import { makeScene } from '../js/games/flashboos.js';
import { bloomRows, ledgerGame } from '../js/bloom.js';

let failed = false;
const assert = (v, m) => { console.log((v ? '✓' : 'FAIL:'), m); if (!v) failed = true; };
for (let tier = 1; tier <= 3; tier++) {
  let exact = true;
  for (let i = 0; i < 100; i++) {
    const round = makeRound(tier);
    const value = round.path === 'species' ? round.items[round.odd].species : round.items[round.odd].colors.body;
    exact = exact && round.items.filter(item => (round.path === 'species' ? item.species : item.colors.body) === value).length === 1;
  }
  assert(exact, `tier ${tier} has exactly one odd Boo across 100 grids`);
}
for (let tier = 1; tier <= 3; tier++) { const scene = makeScene(tier); assert(scene.options.includes(scene.answer), `Flash tier ${tier} includes its answer`); }

const NOW = Date.UTC(2026, 6, 17), OLD = NOW - 15 * 86400000;
const save = {
  stars: { byGame: { oddboo: { plays: 10, lastPlayed: NOW }, feedboos: { plays: 5, lastPlayed: OLD }, flashboos: { plays: 3, lastPlayed: NOW } } },
  ledger: { 'odd:one': { rights: 3, misses: 0, lastSeen: NOW }, 'feed:one': { rights: 2, misses: 0, lastSeen: OLD }, 'flash:one': { rights: 4, misses: 1, lastSeen: NOW }, 'tmul7:8': { rights: 3, misses: 0, lastSeen: NOW } },
  bloom: { max: { identify: 18 } }
};
const byId = Object.fromEntries(bloomRows(save, NOW).map(row => [row.id, row]));
assert(byId.identify.mastered === 1 && byId.identify.plays === 15 && byId.identify.rawGrowth === 5 && byId.identify.growth === 18, 'Bloom matches mastered×2 + plays×0.2 and persists max growth');
assert(byId.memorize.mastered === 1 && byId.memorize.plays === 3 && !byId.memorize.quiet, 'Bloom uses ledger game identity and recent play dates');
assert(byId.analyze.quiet && byId.compute.mastered === 1, 'quiet-lately means no play in 14 days and legacy table keys map to Compute');
assert(ledgerGame('feed:round') === 'feedboos' && ledgerGame('tmul7:8') === 'bubblepop', 'ledger prefixes map safely to their Bloom petals');
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
