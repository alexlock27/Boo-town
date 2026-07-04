// data/sorting.js — Feed the Boos round templates (spec §10.2, §7).
// Each template exposes make() -> a round: { id, buckets:[labels], items:[{...,bucket}], hintFor(item) }.
// The engine samples ~12 items, balanced across buckets, no duplicates. Some templates have
// fewer possible items (round10 ~9, shapeSides ~11) — the round length adapts.

const rnd = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function sampleN(arr, n) { return shuffle(arr.slice()).slice(0, Math.min(n, arr.length)); }
function range(lo, hi) { const a = []; for (let i = lo; i <= hi; i++) a.push(i); return a; }

// Build a balanced round from per-bucket candidate pools.
// pools = [ [items...], [items...], ... ]  (each item already tagged {bucket})
function assemble(buckets, pools, total = 12) {
  const B = pools.length;
  const base = Math.floor(total / B);
  const picks = [];
  // first pass: up to `base` from each bucket
  const taken = pools.map(p => sampleN(p, base));
  taken.forEach(t => picks.push(...t));
  // top up toward total from buckets that still have unused unique items
  let guard = 0;
  while (picks.length < total && guard++ < 100) {
    let added = false;
    for (let b = 0; b < B && picks.length < total; b++) {
      const used = new Set(picks.filter(x => x.bucket === b).map(x => x.key));
      const spare = pools[b].filter(x => !used.has(x.key));
      if (spare.length) { picks.push(spare[rnd(spare.length)]); added = true; }
    }
    if (!added) break;
  }
  return shuffle(picks);
}

const numItem  = (v, bucket) => ({ key: 'n' + v, kind: 'num', value: v, bucket });
const fracItem = (n, d, bucket) => ({ key: `f${n}/${d}`, kind: 'frac', num: n, den: d, bucket });
const unitItem = (emoji, caption, bucket) => ({ key: 'u' + caption, kind: 'unit', emoji, caption, bucket });
const shapeItem = (sides, name, bucket) => ({ key: 's' + name, kind: 'shape', sides, name, bucket });

// rounding helpers
const roundTo = (n, m) => Math.round(n / m) * m; // Math.round does half-up for positive

export const TEMPLATES = [
  // 1. oddEven (L1)
  { id: 'oddEven', level: 1, make() {
    const buckets = ['Odd', 'Even'];
    const odds = range(1, 99).filter(n => n % 2).map(n => numItem(n, 0));
    const evens = range(2, 100).filter(n => n % 2 === 0).map(n => numItem(n, 1));
    return round(buckets, assemble(buckets, [odds, evens]),
      it => `Is ${it.value} odd or even? Look at the last digit.`);
  }},

  // 2. compare (L1/L2/L3 variants)
  ...[[50, 1, 1, 99], [500, 2, 100, 999], [5000, 3, 1000, 9999]].map(([T, lvl, lo, hi]) => ({
    id: 'compare' + T, level: lvl, make() {
      const buckets = [`Less than ${T}`, `More than ${T}`];
      const less = range(lo, T - 1).map(n => numItem(n, 0));
      const more = range(T + 1, hi).map(n => numItem(n, 1));
      return round(buckets, assemble(buckets, [sampleN(less, 40), sampleN(more, 40)]),
        it => `Is ${it.value} less than ${T} or more than ${T}?`);
    }
  })),

  // 3. round10 (L1)
  { id: 'round10', level: 1, make() {
    const N = 20 + rnd(7) * 10;          // 20..80
    const buckets = [`Rounds to ${N}`, `Rounds to ${N + 10}`];
    const pool0 = range(N + 1, N + 4).map(n => numItem(n, 0));
    const pool1 = [...range(N + 6, N + 9).map(n => numItem(n, 1)), numItem(N + 5, 1)];
    return round(buckets, assemble(buckets, [pool0, pool1], 9),
      it => `${it.value} rounds to the nearest ten. Remember, a 5 rounds up!`);
  }},

  // 4. round100 (L2)
  { id: 'round100', level: 2, make() {
    const H = (1 + rnd(9)) * 100;        // 100..900
    const buckets = [`Rounds to ${H}`, `Rounds to ${H + 100}`];
    const pool0 = range(H + 1, H + 49).map(n => numItem(n, 0));
    const pool1 = [...range(H + 51, H + 99).map(n => numItem(n, 1)), numItem(H + 50, 1)];
    return round(buckets, assemble(buckets, [sampleN(pool0, 20), sampleN(pool1, 20)]),
      it => `${it.value} rounds to the nearest hundred. Look at the tens digit — 50 rounds up!`);
  }},

  // 5. tableMember (L1 [2,5,10], L2 [3,4,8], L3 [6,7,9])
  ...[[[2, 5, 10], 1], [[3, 4, 8], 2], [[6, 7, 9], 3]].map(([tables, lvl]) => ({
    id: 'tableMember' + lvl, level: lvl, make() {
      const N = tables[rnd(tables.length)];
      const buckets = [`In the ${N} times table`, `Not in it`];
      const isMul = (x) => x % N === 0;
      const inPool = range(1, 12).map(k => numItem(k * N, 0));
      const nearSet = new Set();
      range(1, 12).forEach(k => [1, 2, -1, -2].forEach(d => { const v = k * N + d; if (v > 0 && !isMul(v)) nearSet.add(v); }));
      const notPool = [...nearSet].map(v => numItem(v, 1));
      return round(buckets, assemble(buckets, [inPool, notPool]),
        it => `Is ${it.value} in the ${N} times table? Try counting up in ${N}s.`);
    }
  })),

  // 6. halfEquivalent (L2)
  { id: 'halfEquivalent', level: 2, make() {
    const buckets = ['Equal to a half', 'Not equal'];
    const eq = [[2,4],[3,6],[4,8],[5,10],[6,12],[50,100]].map(([n,d]) => fracItem(n, d, 0));
    const ne = [[1,3],[1,4],[2,5],[3,4],[2,3],[3,8],[5,8],[1,5]].map(([n,d]) => fracItem(n, d, 1));
    return round(buckets, assemble(buckets, [eq, ne]),
      it => `Is ${it.num}/${it.den} the same as a half? Is the top exactly half of the bottom?`);
  }},

  // 7. fractionSize (L3)
  { id: 'fractionSize', level: 3, make() {
    const buckets = ['Less than a half', 'Equal to a half', 'More than a half'];
    const less = [[1,3],[1,4],[2,5],[3,8],[1,5],[2,6]].map(([n,d]) => fracItem(n, d, 0));
    const eq   = [[2,4],[3,6],[5,10],[4,8]].map(([n,d]) => fracItem(n, d, 1));
    const more = [[3,4],[2,3],[5,8],[7,8],[4,5],[5,6]].map(([n,d]) => fracItem(n, d, 2));
    return round(buckets, assemble(buckets, [less, eq, more]),
      it => `Is ${it.num}/${it.den} less than, equal to, or more than a half?`);
  }},

  // 8. units (L1 & L2)
  ...[1, 2].map(lvl => ({ id: 'units' + lvl, level: lvl, make() {
    const buckets = ['centimetres', 'kilograms', 'millilitres'];
    const cm = [['✏️','a pencil'],['📕','a book'],['🖐️','your hand span'],['👟','a shoe'],['🪵','the width of a table'],['🪱','a worm']].map(([e,c]) => unitItem(e, c, 0));
    const kg = [['🐕','a dog'],['🍉','a watermelon'],['🥔','a bag of potatoes'],['🚲','a bicycle'],['🎃','a pumpkin'],['🎒','a school bag']].map(([e,c]) => unitItem(e, c, 1));
    const ml = [['🥤','water in a cup'],['🧃','juice in a carton'],['🥄','a spoon of medicine'],['🥛','milk on cereal'],['🥫','a can of pop'],['🎨','paint in a pot']].map(([e,c]) => unitItem(e, c, 2));
    return round(buckets, assemble(buckets, [cm, kg, ml]),
      it => `Would you measure ${it.caption} in centimetres, kilograms or millilitres?`);
  }})),

  // 9. shapeSides (L1)
  { id: 'shapeSides', level: 1, make() {
    const buckets = ['3 sides', '4 sides', '5 or more'];
    const three = [[3,'triangle'],[3,'right-angled triangle']].map(([s,n]) => shapeItem(s, n, 0));
    const four = [[4,'square'],[4,'rectangle'],[4,'rhombus'],[4,'kite']].map(([s,n]) => shapeItem(s, n, 1));
    const more = [[5,'pentagon'],[6,'hexagon'],[7,'heptagon'],[8,'octagon'],[10,'decagon']].map(([s,n]) => shapeItem(s, n, 2));
    return round(buckets, assemble(buckets, [three, four, more], 12),
      it => `Count the sides of the ${it.name}. How many are there?`);
  }}
];

function round(buckets, items, hintFor) {
  return { buckets, items, hintFor, length: items.length };
}

export function pickTemplate(level) {
  const opts = TEMPLATES.filter(t => t.level === level);
  return opts[rnd(opts.length)];
}
