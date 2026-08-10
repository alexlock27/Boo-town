// data/sorting.js — Feed the Boos round templates (spec §10.2, §7).
// Each template exposes make() -> a round: { id, buckets:[labels], items:[{...,bucket}], hintFor(item) }.
// The engine samples ~12 items, balanced across buckets, no duplicates. Some templates have
// fewer possible items (round10 ~9, shapeSides ~11) — the round length adapts.

const rnd = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// RUN21H A4: session-scoped repeat avoidance. A round prefers items this session has not
// dealt yet; only when a pool genuinely exhausts does its membership reset and a fresh
// cycle begin. Module state only — nothing saved, nothing decays, nothing punishes a
// return visit (a reload simply starts a fresh cycle).
const SEEN = new Set();
function freshFirst(arr) {
  const unseen = arr.filter(it => !SEEN.has(it.key));
  if (!unseen.length && arr.length) { arr.forEach(it => SEEN.delete(it.key)); return arr.slice(); }
  return unseen;
}
function sampleN(arr, n) {
  const want = Math.min(n, arr.length);
  const picks = shuffle(freshFirst(arr)).slice(0, want);
  if (picks.length < want) {
    const have = new Set(picks.map(it => it.key));
    for (const it of shuffle(arr.slice())) {
      if (picks.length >= want) break;
      if (!have.has(it.key)) { picks.push(it); have.add(it.key); }
    }
  }
  picks.forEach(it => SEEN.add(it.key));
  return picks;
}
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
      if (spare.length) {
        // RUN21H A4: top-ups prefer items this session has not seen either
        const fresh = spare.filter(x => !SEEN.has(x.key));
        const it = (fresh.length ? fresh : spare)[rnd((fresh.length ? fresh : spare).length)];
        SEEN.add(it.key);
        picks.push(it); added = true;
      }
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
      const r = round(buckets, assemble(buckets, [sampleN(less, 40), sampleN(more, 40)]),
        it => `Is ${it.value} less than ${T} or more than ${T}?`);
      // RUN18B Y5: the threshold MOVES partway through the round (feedboos.js
      // RULE_SHIFT_AT). Sorting the same numbers against a line that has moved is the
      // whole skill; a round where the answer never changes is a round she can sleepwalk.
      r.rule = `More or less than ${T}?`;
      r.shifts = [T + T * 0.4, T - T * 0.4].map(T2 => ({
        buckets: [`Less than ${T2}`, `More than ${T2}`],
        rule: `Now: more or less than ${T2}?`,
        hintFor: it => `Is ${it.value} less than ${T2} or more than ${T2}?`,
        rebucket(it) { if (it.value === T2) it.value = T2 + 1; return it.value < T2 ? 0 : 1; }
      }));
      return r;
    }
  })),

  // 3. round10 (L1)
  { id: 'round10', level: 1, make() {
    const N = 20 + rnd(7) * 10;          // 20..80
    const buckets = [`Rounds to ${N}`, `Rounds to ${N + 10}`];
    const pool0 = range(N + 1, N + 4).map(n => numItem(n, 0));
    const pool1 = [...range(N + 6, N + 9).map(n => numItem(n, 1)), numItem(N + 5, 1)];
    return round(buckets, assemble(buckets, [pool0, pool1], 9),
      it => `Round ${it.value} to the nearest ten. Remember, a 5 rounds up!`);
  }},

  // 4. round100 (L2)
  { id: 'round100', level: 2, make() {
    const H = (1 + rnd(9)) * 100;        // 100..900
    const buckets = [`Rounds to ${H}`, `Rounds to ${H + 100}`];
    const pool0 = range(H + 1, H + 49).map(n => numItem(n, 0));
    const pool1 = [...range(H + 51, H + 99).map(n => numItem(n, 1)), numItem(H + 50, 1)];
    return round(buckets, assemble(buckets, [sampleN(pool0, 20), sampleN(pool1, 20)]),
      it => `Round ${it.value} to the nearest hundred. If the tens digit is 5 or more, round up!`);
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
    // RUN21H A3: 14 -> 36 items, so all three of a sitting's rounds are fresh.
    const eq = [[2,4],[3,6],[4,8],[5,10],[6,12],[50,100],[7,14],[8,16],[10,20],[9,18],
      [11,22],[12,24],[15,30],[20,40],[25,50],[30,60],[14,28],[13,26]].map(([n,d]) => fracItem(n, d, 0));
    const ne = [[1,3],[1,4],[2,5],[3,4],[2,3],[3,8],[5,8],[1,5],[1,6],[5,6],[2,7],[7,8],
      [3,10],[7,10],[1,8],[4,5],[2,9],[5,7]].map(([n,d]) => fracItem(n, d, 1));
    return round(buckets, assemble(buckets, [eq, ne]),
      it => `Is ${it.num}/${it.den} the same as a half? Is the top exactly half of the bottom?`);
  }},

  // 7. fractionSize (L3)
  { id: 'fractionSize', level: 3, make() {
    const buckets = ['Less than a half', 'Equal to a half', 'More than a half'];
    // RUN21H A3: 16 -> 36 items.
    const less = [[1,3],[1,4],[2,5],[3,8],[1,5],[2,6],[1,6],[1,8],[2,7],[3,10],
      [1,10],[2,8],[1,7],[3,12],[2,10]].map(([n,d]) => fracItem(n, d, 0));
    const eq   = [[2,4],[3,6],[5,10],[4,8],[6,12],[50,100]].map(([n,d]) => fracItem(n, d, 1));
    const more = [[3,4],[2,3],[5,8],[7,8],[4,5],[5,6],[3,5],[7,10],[9,10],[5,7],
      [7,12],[9,16],[4,6],[6,10],[11,12]].map(([n,d]) => fracItem(n, d, 2));
    return round(buckets, assemble(buckets, [less, eq, more]),
      it => `Is ${it.num}/${it.den} less than, equal to, or more than a half?`);
  }},

  // 8. units (L1 small units, L2 big units)
  // RUN21H A2: these two were a `[1,2].map(...)` of ONE template, so levelling up served the
  // identical round advertised as harder. They are now two templates with two different unit
  // families — small (cm/kg/ml) then big (metres/tonnes-ish/litres) — so level 2 is a step up
  // rather than a relabel. Captions that named a THING a child could defensibly measure two
  // ways ('a book', 'a dog', 'a bicycle') now name the ATTRIBUTE, the way the authored
  // 'the width of a table' already did.
  { id: 'units1', level: 1, make() {
    const buckets = ['centimetres', 'kilograms', 'millilitres'];
    const cm = [['✏️','a pencil'],['🎀','a ribbon'],['🖐️','your hand span'],['👟','the length of a shoe'],['🪵','the width of a table'],['🪱','a worm'],
      ['📏','the length of a ruler'],['🍴','the length of a fork'],['🧦','the length of a sock'],['🔑','the length of a key'],['🖊️','the length of a pen'],['🍌','the length of a banana']].map(([e,c]) => unitItem(e, c, 0));
    const kg = [['🐕','how heavy a dog is'],['🍉','how heavy a watermelon is'],['🥔','a bag of potatoes'],['🧳','a heavy suitcase'],['🎃','how heavy a pumpkin is'],['🎒','a full school bag'],
      ['🧱','how heavy a brick is'],['🐑','how heavy a sheep is'],['📚','how heavy a pile of books is'],['🛒','how heavy the shopping is'],['🧸','how heavy a big teddy is'],['🎳','how heavy a bowling ball is']].map(([e,c]) => unitItem(e, c, 1));
    const ml = [['🥤','water in a cup'],['🧃','juice in a carton'],['🥄','a spoon of medicine'],['🥛','milk on cereal'],['🥫','a can of pop'],['🎨','paint in a pot'],
      ['🍵','tea in a mug'],['🧴','shampoo in a bottle'],['🍯','honey in a jar'],['💧','water in a small bottle'],['🧪','liquid in a test tube'],['🥣','soup in a bowl']].map(([e,c]) => unitItem(e, c, 2));
    return round(buckets, assemble(buckets, [cm, kg, ml]),
      it => `Would you measure ${it.caption} in centimetres, kilograms or millilitres?`);
  }},
  { id: 'units2', level: 2, make() {
    const buckets = ['metres', 'grams', 'litres'];
    const m = [['🏊','the length of a swimming pool'],['🌳','how tall a tree is'],['🏠','how wide a house is'],['🚌','the length of a bus'],['⚽','how far you can kick a ball'],['🪜','how tall a ladder is'],
      ['🏰','how tall a castle is'],['🛤️','the length of a railway platform'],['🎪','how wide a big top is'],['🌉','the length of a bridge'],['🏟️','the length of a football pitch'],['🗼','how tall a lighthouse is']].map(([e,c]) => unitItem(e, c, 0));
    const g = [['🪶','how heavy a feather is'],['🍬','how heavy a sweet is'],['📎','how heavy a paperclip is'],['🍪','how heavy a biscuit is'],['🔑','how heavy a key is'],['🍇','how heavy one grape is'],
      ['🥜','how heavy a peanut is'],['🪙','how heavy a coin is'],['🍓','how heavy a strawberry is'],['✉️','how heavy a letter is'],['🧷','how heavy a safety pin is'],['🍫','how heavy a chocolate bar is']].map(([e,c]) => unitItem(e, c, 1));
    const l = [['🪣','water in a bucket'],['⛽','petrol in a car'],['🛁','water in a bath'],['🥛','milk in a big bottle'],['💧','water in a watering can'],['🐟','water in a fish tank'],
      ['🫗','juice in a big jug'],['🚿','water in a shower'],['🧊','water in a paddling pool'],['☕','water in a kettle'],['🛢️','water in a water butt'],['🚰','water in a fish bowl']].map(([e,c]) => unitItem(e, c, 2));
    return round(buckets, assemble(buckets, [m, g, l]),
      it => `Would you measure ${it.caption} in metres, grams or litres?`);
  }},

  // 10. twoRule (L3) — RUN18B Y5. Two predicates at once, from the authored set; the rule
  // is spoken and shown exactly as written. Both halves have to be true to feed the left Boo.
  { id: 'twoRule', level: 3, make() {
    const RULES = [
      { text: 'less than 50 AND even',            test: n => n < 50 && n % 2 === 0 },
      { text: 'more than 30 AND ends in 0 or 5',  test: n => n > 30 && (n % 10 === 0 || n % 10 === 5) },
      { text: 'even AND more than 40',            test: n => n % 2 === 0 && n > 40 },
      { text: 'odd AND less than 60',             test: n => n % 2 === 1 && n < 60 }
    ];
    const rule = RULES[rnd(RULES.length)];
    const buckets = [rule.text, 'Not this one'];
    const all = range(1, 99);
    const yes = all.filter(rule.test).map(n => numItem(n, 0));
    const no = all.filter(n => !rule.test(n)).map(n => numItem(n, 1));
    const r = round(buckets, assemble(buckets, [sampleN(yes, 40), sampleN(no, 40)]),
      it => `Is ${it.value} ${rule.text}? BOTH parts have to be true.`);
    r.rule = rule.text;
    r.predicates = rule.text.split(' AND ');
    return r;
  }},

  // 9. shapeSides (L1)
  // RUN21H A2 + A3. feedboos.js draws these with polygonSVG(sides), which is always a
  // REGULAR polygon — so a name is only honest here if a regular polygon really is one.
  // 'right-angled triangle' was NOT: it was drawn as an equilateral triangle, a label
  // contradicting its own picture. It is replaced rather than redrawn, because the task is
  // counting sides and a bespoke scalene drawing is an art job, not a content one.
  // The three additions all pass the same test: a regular triangle IS equilateral and IS
  // isosceles; a square IS a parallelogram; a regular 9-gon IS a nonagon.
  // The pool is genuinely bounded by the shape names a Y3/4 child meets, so the round is
  // shortened to 9 (the file header's own "the round length adapts") rather than padded
  // with names the drawing would make false.
  { id: 'shapeSides', level: 1, make() {
    const buckets = ['3 sides', '4 sides', '5 or more'];
    const three = [[3,'triangle'],[3,'equilateral triangle']].map(([s,n]) => shapeItem(s, n, 0));
    const four = [[4,'square'],[4,'rectangle'],[4,'rhombus'],[4,'kite'],[4,'parallelogram']].map(([s,n]) => shapeItem(s, n, 1));
    const more = [[5,'pentagon'],[6,'hexagon'],[7,'heptagon'],[8,'octagon'],[9,'nonagon'],[10,'decagon']].map(([s,n]) => shapeItem(s, n, 2));
    return round(buckets, assemble(buckets, [three, four, more], 9),
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
