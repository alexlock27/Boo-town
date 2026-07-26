// tests/r11q6-courses-spec.mjs — course data vs the authored spec, medal thresholds,
// trophy gating, and legacy record preservation.
//
// SUPERSEDED, justified in-file (RUN14 U1): this suite used to carry a transcription of
// RUN10 P8's three-course table and check data/courses.js against it. That pack is retired
// — CONTENT_COURSES.md's six single-screen courses replaced it wholesale — and the new
// table is transcribed and asserted in r14u1-booroll.mjs, where it belongs beside the
// physics that gives it meaning. Duplicating it here would create two sources of truth for
// authored content, which is exactly the drift the content law forbids.
//
// What stays is what this suite uniquely guards and what is unchanged in kind: medal
// thresholds award EXACTLY at the authored pars, the three Boo Roll trophies gate on the
// courses a child can actually play, and every retired pack's records are preserved.
import { COURSES, PLAYABLE_KEYS } from '../data/courses.js';
import { medalFor } from '../js/games/booroll.js';
import { migrate } from '../js/state.js';
import { CATALOG } from '../js/trophies.js';

let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

console.log('== medal thresholds award exactly at the authored pars ==');
{
  for (const c of COURSES) {
    const { gold, silver, bronze } = c.pars;
    assert(medalFor(c, gold - 1) === 'gold' && medalFor(c, gold) === 'gold', `${c.key}: gold at/under ${gold}s`);
    assert(medalFor(c, gold + 0.1) === 'silver' && medalFor(c, silver) === 'silver', `${c.key}: silver up to ${silver}s`);
    assert(medalFor(c, silver + 0.1) === 'bronze' && medalFor(c, bronze) === 'bronze', `${c.key}: bronze up to ${bronze}s`);
    assert(!medalFor(c, bronze + 0.1), `${c.key}: over ${bronze}s finishes with no medal`);
  }
}

console.log('== trophies gate on the courses a child can actually play, and grant once ==');
{
  const byKey = Object.fromEntries(CATALOG.map(t => [t.key, t]));
  for (const k of ['trophy_roll_first', 'trophy_roll_bronze', 'trophy_roll_gold']) assert(!!byKey[k], `catalog has ${k}`);
  const save = (medals) => ({ booRoll: { medals }, stars: { total: 0 }, trophies: {} });
  const none = save({});
  const one = save({ [PLAYABLE_KEYS[0]]: 'bronze' });
  const allB = save(Object.fromEntries(PLAYABLE_KEYS.map((k, i) => [k, i % 2 ? 'silver' : 'bronze'])));
  const allG = save(Object.fromEntries(PLAYABLE_KEYS.map(k => [k, 'gold'])));
  assert(!byKey.trophy_roll_first.earned(none), 'First Medal not earned with no medals');
  assert(byKey.trophy_roll_first.earned(one), 'First Medal earned on the first medal');
  assert(!byKey.trophy_roll_bronze.earned(one), 'All Bronze needs every playable course');
  assert(byKey.trophy_roll_bronze.earned(allB), 'All Bronze earned when every playable course has a medal');
  assert(!byKey.trophy_roll_gold.earned(allB), 'All Gold needs gold everywhere');
  assert(byKey.trophy_roll_gold.earned(allG), 'All Gold earned on golds across the playable set');
  // A trophy a child CANNOT earn is a taunt: the blocked course must not be required.
  assert(PLAYABLE_KEYS.length === 5 && !PLAYABLE_KEYS.includes('lift-off'),
    'the blocked course is excluded from the trophy requirement (BLOCKED.md)');
  // retired ids from either previous pack must NOT satisfy the trophies
  assert(!byKey.trophy_roll_bronze.earned(save({ roll1: 'gold', roll2: 'gold', roll3: 'gold' })), 'retired RUN9 course medals do not grant the trophies');
  assert(!byKey.trophy_roll_bronze.earned(save({ 'rolling-meadow': 'gold', 'windy-hill': 'gold' })), 'retired RUN10 P8 course medals do not grant them either');
  assert(!!byKey.exp_first && !!byKey.exp_tier4, 'the two Expedition trophies appear in the Trophy Room catalog');
}

console.log('== every retired pack\'s records are preserved under booRoll.legacy ==');
{
  // RUN9's roll1..roll6 ids (retired at v14) AND RUN10 P8's course keys (retired at v16)
  const v13 = { version: 13, name: 'Ada', inventory: {}, stars: { total: 50, byGame: {} },
    booRoll: { best: { roll1: 31200, roll2: 40100, 'rolling-meadow': 52000 }, medals: { roll1: 'gold', roll3: 'silver', 'rolling-meadow': 'bronze' } } };
  const m = migrate(structuredClone(v13));
  assert(m.booRoll.legacy && m.booRoll.legacy.best.roll1 === 31200 && m.booRoll.legacy.best.roll2 === 40100, 'RUN9 best times moved to booRoll.legacy.best');
  assert(m.booRoll.legacy.medals.roll1 === 'gold' && m.booRoll.legacy.medals.roll3 === 'silver', 'RUN9 medals moved to booRoll.legacy.medals');
  assert(m.booRoll.legacy.best['rolling-meadow'] === 52000 && m.booRoll.legacy.medals['rolling-meadow'] === 'bronze',
    'and the P8 course records joined them at v16, preserved verbatim');
  assert(!('roll1' in m.booRoll.best) && !('rolling-meadow' in m.booRoll.best), 'no retired id sits in the live records');
  assert(Object.keys(m.booRoll.best).length === 0, 'nothing was invented for the new courses');
}

console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
