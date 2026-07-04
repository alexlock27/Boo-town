// tests/content.mjs — curriculum-correctness regression (no browser needed).
// A learning game MUST teach the right answers: verify spelling list, maths generator, sorting engine.
import { readFileSync } from 'fs';
import { WORDS } from '../data/spelling.js';
import { genTarget, distractors } from '../js/games/bubblepop.js';
import { TEMPLATES } from '../data/sorting.js';

let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const roundTo = (n, x) => Math.round(n / x) * x;

console.log('== spelling list matches the DfE statutory list in the spec exactly ==');
{
  const spec = readFileSync(new URL('../BUILD_SPEC.md', import.meta.url), 'utf8');
  const grab = (n) => (spec.match(new RegExp('Tier ' + n + ': ([^\\n]+)')) || [, ''])[1].split(',').map(s => s.trim()).filter(Boolean);
  let ok = true;
  for (const t of [1, 2, 3]) {
    const mine = WORDS.filter(w => w.t === t).map(w => w.w);
    const spc = grab(String(t));
    if (mine.length !== spc.length || spc.some(w => !mine.includes(w)) || mine.some(w => !spc.includes(w))) ok = false;
  }
  assert(ok && WORDS.length === 109, 'all 109 words present, correct tiers, no typos');
}

console.log('== maths generator: correct answers + no distractor equals the answer (12k samples) ==');
{
  let bad = 0, clash = 0;
  const parse = (d) => { let mm;
    if ((mm = d.match(/^(\d+) × (\d+) = \?$/))) return +mm[1] * +mm[2];
    if ((mm = d.match(/^(\d+) ÷ (\d+) = \?$/))) return +mm[1] / +mm[2];
    if ((mm = d.match(/^\? × (\d+) = (\d+)$/))) return +mm[2] / +mm[1];
    return NaN; };
  for (const lvl of [1, 2, 3]) for (let i = 0; i < 4000; i++) {
    const t = genTarget(lvl, null);
    if (!Number.isInteger(parse(t.display)) || parse(t.display) !== t.answer) bad++;
    if (distractors(t).includes(t.answer)) clash++;
  }
  assert(bad === 0, 'every generated answer is mathematically correct');
  assert(clash === 0, 'no distractor ever equals the correct answer');
}

console.log('== sorting engine: every item bucketed correctly (~49k items) ==');
{
  let bad = 0;
  for (const tpl of TEMPLATES) for (let r = 0; r < 300; r++) {
    const round = tpl.make(); const B = round.buckets;
    for (const it of round.items) {
      let want = null;
      if (tpl.id === 'oddEven') want = it.value % 2 === 0 ? 1 : 0;
      else if (tpl.id.startsWith('compare')) want = it.value < +B[0].match(/(\d+)/)[1] ? 0 : 1;
      else if (tpl.id === 'round10') want = roundTo(it.value, 10) === +B[0].match(/(\d+)/)[1] ? 0 : 1;
      else if (tpl.id === 'round100') want = roundTo(it.value, 100) === +B[0].match(/(\d+)/)[1] ? 0 : 1;
      else if (tpl.id.startsWith('tableMember')) want = it.value % +B[0].match(/(\d+)/)[1] === 0 ? 0 : 1;
      else if (tpl.id === 'halfEquivalent') want = Math.abs(it.num / it.den - 0.5) < 1e-9 ? 0 : 1;
      else if (tpl.id === 'fractionSize') { const v = it.num / it.den; want = v < 0.5 - 1e-9 ? 0 : (v > 0.5 + 1e-9 ? 2 : 1); }
      else if (tpl.id === 'shapeSides') want = it.sides === 3 ? 0 : (it.sides === 4 ? 1 : 2);
      if (want !== null && it.bucket !== want) bad++;
    }
  }
  assert(bad === 0, 'all number/fraction/shape items land in the right bucket');
}

console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
