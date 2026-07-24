// tests/r11q6-courses-spec.mjs — RUN11 Q6: P8 course data vs the authored spec table,
// medal thresholds, trophy gating, and legacy RUN9 record preservation.
import { COURSES } from '../data/courses.js';
import { medalFor } from '../js/games/booroll.js';
import { migrate } from '../js/state.js';
import { CATALOG } from '../js/trophies.js';

let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The authored RUN10 P8 table, transcribed from the spec (this table IS the contract).
const SPEC = [
  { key: 'rolling-meadow', name: 'Rolling Meadow', world: 6000, parGold: 55, parSilver: 70, parBronze: 90,
    segments: [['flat',800],['slope',600,-8],['flat',400],['gap',120],['flat',500],['slope',700,10],['flat',600],['platform',500,-160],['slope',500,-12],['flat',null]],
    mechanisms: [['seesawPlank',2600],['lift',4400]], stars: [[900,-20],[3050,-40],[4650,-180]], flags: [2000,4200], finish: 5800 },
  { key: 'windy-hill', name: 'Windy Hill', world: 7000, parGold: 70, parSilver: 90, parBronze: 115,
    segments: [['slope',900,9],['gap',160],['flat',500],['slope',800,-11],['flat',600],['platform',600,-140],['slope',700,8],['gap',140],['flat',null]],
    mechanisms: [['quarterGirder',1400],['seesawPlank',2500],['gateFlap',3600],['lift',4600]], stars: [[1500,-60],[3300,-20],[5600,-170]], flags: [2400,4800], finish: 6800 },
  { key: 'sunset-ridge', name: 'Sunset Ridge', world: 8000, parGold: 85, parSilver: 110, parBronze: 140,
    segments: [['slope',700,10],['slope',700,-10],['slope',700,10],['gap',180],['flat',400],['platform',700,-160],['slope',900,-13],['gap',200],['flat',null]],
    mechanisms: [['seesawPlank',3000],['quarterGirder',3800],['lift',4900],['gateFlap',6200]], stars: [[2000,-50],[4200,-190],[6900,-30]], flags: [2600,5400], finish: 7800 }
];

console.log('== the three authored courses match the P8 spec exactly ==');
{
  assert(COURSES.length === 3, 'exactly three courses');
  for (const spec of SPEC) {
    const c = COURSES.find(x => x.key === spec.key);
    assert(!!c, `${spec.key} exists`);
    if (!c) continue;
    assert(c.name === spec.name, `${spec.key}: name "${spec.name}"`);
    assert(c.world === spec.world, `${spec.key}: world ${spec.world}`);
    assert(c.parGold === spec.parGold && c.parSilver === spec.parSilver && c.parBronze === spec.parBronze, `${spec.key}: pars ${spec.parGold}/${spec.parSilver}/${spec.parBronze}`);
    // segments: type, length and slope/platform values (final flat length is world-derived)
    assert(c.segments.length === spec.segments.length, `${spec.key}: ${spec.segments.length} segments`);
    let segOk = true;
    spec.segments.forEach(([t, len, val], i) => {
      const s = c.segments[i]; if (!s) { segOk = false; return; }
      if (s.t !== t) segOk = false;
      if (len !== null && s.len !== len) segOk = false;
      if (t === 'slope' && s.deg !== val) segOk = false;
      if (t === 'platform' && s.y !== val) segOk = false;
    });
    assert(segOk, `${spec.key}: every segment matches type/length/slope/platform`);
    // ground spans the world; the finish sits inside it
    const sum = c.segments.reduce((n, s) => n + s.len, 0);
    assert(sum === spec.world, `${spec.key}: segments span the world exactly (${sum})`);
    assert(c.finish.x === spec.finish && c.finish.x < c.world, `${spec.key}: finish at ${spec.finish}, inside the world`);
    // mechanisms, stars, flags
    assert(eq(c.mechanisms.map(m => [m.t, m.x]), spec.mechanisms), `${spec.key}: mechanisms at their authored positions`);
    assert(eq(c.stars.map(s => [s.x, s.y]), spec.stars), `${spec.key}: three stars at their authored coordinates`);
    assert(eq(c.flags.map(f => f.x), spec.flags), `${spec.key}: two flags at their authored positions`);
    assert(c.mechanisms.every(m => ['seesawPlank', 'lift', 'quarterGirder', 'gateFlap'].includes(m.t)), `${spec.key}: only the four authored mechanism types`);
  }
}

console.log('== medal thresholds award exactly at the pars ==');
{
  for (const c of COURSES) {
    assert(medalFor(c, c.parGold - 1) === 'gold' && medalFor(c, c.parGold) === 'gold', `${c.key}: gold at/under ${c.parGold}s`);
    assert(medalFor(c, c.parGold + 0.1) === 'silver' && medalFor(c, c.parSilver) === 'silver', `${c.key}: silver up to ${c.parSilver}s`);
    assert(medalFor(c, c.parSilver + 0.1) === 'bronze' && medalFor(c, c.parBronze) === 'bronze', `${c.key}: bronze up to ${c.parBronze}s`);
    assert(!medalFor(c, c.parBronze + 0.1), `${c.key}: over ${c.parBronze}s finishes with no medal`);
  }
}

console.log('== trophies gate on the three authored courses and grant once ==');
{
  const byKey = Object.fromEntries(CATALOG.map(t => [t.key, t]));
  for (const k of ['trophy_roll_first', 'trophy_roll_bronze', 'trophy_roll_gold']) assert(!!byKey[k], `catalog has ${k}`);
  const save = (medals) => ({ booRoll: { medals }, stars: { total: 0 }, trophies: {} });
  const none = save({});
  const one = save({ 'rolling-meadow': 'bronze' });
  const allB = save({ 'rolling-meadow': 'bronze', 'windy-hill': 'silver', 'sunset-ridge': 'bronze' });
  const allG = save({ 'rolling-meadow': 'gold', 'windy-hill': 'gold', 'sunset-ridge': 'gold' });
  assert(!byKey.trophy_roll_first.earned(none), 'First Medal not earned with no medals');
  assert(byKey.trophy_roll_first.earned(one), 'First Medal earned on the first medal');
  assert(!byKey.trophy_roll_bronze.earned(one), 'All Bronze needs every course');
  assert(byKey.trophy_roll_bronze.earned(allB), 'All Bronze earned when every course has a medal');
  assert(!byKey.trophy_roll_gold.earned(allB), 'All Gold needs gold everywhere');
  assert(byKey.trophy_roll_gold.earned(allG), 'All Gold earned on three golds');
  // legacy RUN9 ids must NOT satisfy the new trophies
  assert(!byKey.trophy_roll_bronze.earned(save({ roll1: 'gold', roll2: 'gold', roll3: 'gold' })), 'retired RUN9 course medals do not grant the new trophies');
  // expedition trophies are visible in the room
  assert(!!byKey.exp_first && !!byKey.exp_tier4, 'the two Expedition trophies appear in the Trophy Room catalog');
}

console.log('== legacy RUN9 Boo Roll records are preserved under booRoll.legacy ==');
{
  const v13 = { version: 13, name: 'Ada', inventory: {}, stars: { total: 50, byGame: {} },
    booRoll: { best: { roll1: 31200, roll2: 40100, 'rolling-meadow': 52000 }, medals: { roll1: 'gold', roll3: 'silver', 'rolling-meadow': 'bronze' } } };
  const m = migrate(structuredClone(v13));
  assert(m.booRoll.legacy && m.booRoll.legacy.best.roll1 === 31200 && m.booRoll.legacy.best.roll2 === 40100, 'legacy best times moved to booRoll.legacy.best');
  assert(m.booRoll.legacy.medals.roll1 === 'gold' && m.booRoll.legacy.medals.roll3 === 'silver', 'legacy medals moved to booRoll.legacy.medals');
  assert(!('roll1' in m.booRoll.best) && !('roll1' in m.booRoll.medals), 'legacy ids no longer sit in the live records');
  assert(m.booRoll.best['rolling-meadow'] === 52000 && m.booRoll.medals['rolling-meadow'] === 'bronze', 'current-course records are untouched');
}

console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
