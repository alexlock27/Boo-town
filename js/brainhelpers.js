// RUN10 P19's small, pure attribute engine. It deliberately owns generation only:
// the held P14 authoring tools are not pulled into this recovery packet.
export const BRAIN_COLOURS = ['indigo', 'lilac', 'teal', 'bubblegum', 'gold', 'aqua'];
export const BRAIN_SPECIES = ['bloop', 'pip', 'munch', 'twirl', 'sunny', 'nova'];
export const FEATURES = ['colour', 'species', 'hat', 'shine'];
export const TIER_ARITY = { toddler: 1, light: 1, medium: 2, full: 3 };

const pick = (a, rng = Math.random) => a[Math.floor(rng() * a.length)];
const other = (a, value, rng) => pick(a.filter(x => x !== value), rng);
const boolOther = v => !v;
const shuffled = (values, rng) => {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export function randomBrainBoo(rng = Math.random) {
  return {
    colour: pick(BRAIN_COLOURS, rng),
    species: pick(BRAIN_SPECIES, rng),
    hat: rng() < .45,
    shine: rng() < .35
  };
}

function invert(boo, feature, rng) {
  if (feature === 'colour') boo.colour = other(BRAIN_COLOURS, boo.colour, rng);
  else if (feature === 'species') boo.species = other(BRAIN_SPECIES, boo.species, rng);
  else boo[feature] = boolOther(boo[feature]);
}

// ---- Odd Boo Out's grid (RUN12 S3) ---------------------------------------------------
// One uniform background, exactly one difference. Every non-odd Boo is IDENTICAL on every
// feature; the odd Boo differs on exactly one. The previous design built 2–4 visual
// "families", which meant a light grid always carried a 2-2 split and a full grid carried
// three simultaneous 6-6 splits — nothing was uniquely odd by looking, only by knowing
// which feature the generator had picked.
//
// 'shine' is NOT in the pool: sparkle is decoration or the answer, never ambiguously both,
// and the simplest compliant rule is to exclude it entirely and never render it in a grid.
export const ODD_FEATURES = ['colour', 'species', 'hat'];
export const ODD_GRID_SIZE = { toddler: 4, light: 4, medium: 9, full: 12 };

// Species rounds use an authored pair table so the EXPLANATION can name the part a child
// actually saw rather than an internal category. Each label was verified against the
// rendered SVG from js/art.js speciesGeom():
//   pip    — the only species with tall rabbit ears        -> "ears"
//   twirl  — the only one with a curly antenna             -> "antenna"
//   nova   — the only one with a swirly tail               -> "tail"
//   sunny  — the only one with star eyes                   -> "eyes"
//   munch  — a wide toothy grin against bloop's small fangs-> "mouth"
// The grid always wears `bloop`, whose own signature is the smallest in the set (two tiny
// fangs), so the odd Boo's signature is what stands out. For `munch` the mouth is the only
// difference of any substance at all — bloop is 43x43 against munch's 45x41, two pixels.
export const ODD_BASE_SPECIES = 'bloop';
export const ODD_SPECIES_PAIRS = [
  { odd: 'pip',   label: 'ears',    subtle: false },
  { odd: 'twirl', label: 'antenna', subtle: false },
  { odd: 'nova',  label: 'tail',    subtle: false },
  { odd: 'sunny', label: 'eyes',    subtle: true },
  { odd: 'munch', label: 'mouth',   subtle: true }
];
// Colours a child would call nearly the same. Higher tiers get subtler, never ambiguous.
export const ODD_NEAR_COLOURS = [['teal', 'aqua'], ['indigo', 'lilac'], ['lilac', 'bubblegum']];
const ODD_SUBTLETY = { toddler: 'loud', light: 'loud', medium: 'any', full: 'subtle' };

// RUN18D D7 — the guarantee is made at the point of SERVICE, not left to construction.
// Every board oddGrid is about to hand a child is checked first: exactly one item differs,
// it differs on exactly one feature, every other feature is constant across the whole
// board, and sparkle is not the difference unless the round's own rule names it (it never
// does — 'shine' is not in ODD_FEATURES). Returns null when the board is sound, or the
// reason it is not, so the caller can reject and regenerate.
export const ODD_CHECK_FEATURES = ['colour', 'species', 'hat', 'shine'];
export function oddGridFault(grid) {
  if (!grid || !Array.isArray(grid.items) || grid.items.length < 2) return 'no board';
  const { items, oddIndex, oddFeature } = grid;
  if (!(oddIndex >= 0 && oddIndex < items.length)) return 'the odd index is off the board';
  const base = items[oddIndex === 0 ? 1 : 0];
  const differs = [];
  for (const f of ODD_CHECK_FEATURES) {
    // every NON-odd item must agree with every other on every feature
    for (let i = 0; i < items.length; i++) {
      if (i === oddIndex) continue;
      if (items[i][f] !== base[f]) return `two ordinary Boos disagree on ${f}`;
    }
    if (items[oddIndex][f] !== base[f]) differs.push(f);
  }
  if (differs.length === 0) return 'no Boo is different — the board has no answer';
  if (differs.length > 1) return `the odd Boo differs on ${differs.length} features (${differs.join('+')})`;
  if (differs[0] !== oddFeature) return `the difference is ${differs[0]} but the rule says ${oddFeature}`;
  if (differs[0] === 'shine') return 'sparkle is the difference, and no rule names sparkle';
  return null;
}

export function oddGrid(tier = 'light', rng = Math.random, options = {}) {
  // Reject and regenerate: bounded, because a generator that cannot make a sound board in
  // eight goes is broken and silently looping forever would be worse than serving the last
  // one. In practice buildOddGrid is sound by construction and this never spends a retry —
  // which is exactly why it is worth having, since nothing else would notice if it stopped
  // being sound.
  let grid = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    grid = buildOddGrid(tier, rng, options);
    if (!oddGridFault(grid)) return grid;
  }
  console.warn('[oddGrid] served a board after 8 rejections:', oddGridFault(grid));
  return grid;
}

function buildOddGrid(tier = 'light', rng = Math.random, options = {}) {
  const count = ODD_GRID_SIZE[tier] || 4;
  const subtlety = ODD_SUBTLETY[tier] || 'loud';
  const oddFeature = ODD_FEATURES.includes(options.oddFeature) ? options.oddFeature : pick(ODD_FEATURES, rng);
  const oddIndex = Math.floor(rng() * count);

  const base = {
    colour: pick(BRAIN_COLOURS, rng),
    // a species round needs the authored base; otherwise the whole grid may be any
    // single species, which varies the picture without varying the answer
    species: oddFeature === 'species' ? ODD_BASE_SPECIES : pick(BRAIN_SPECIES, rng),
    hat: rng() < 0.5,
    shine: false                                  // never rendered inside a grid
  };

  let oddValue, oddLabel;
  if (oddFeature === 'colour') {
    const near = ODD_NEAR_COLOURS.filter(pair => pair.includes(base.colour)).flat();
    if (subtlety === 'subtle') {
      const pair = shuffled(pick(ODD_NEAR_COLOURS, rng), rng);
      base.colour = pair[0]; oddValue = pair[1];
    } else if (subtlety === 'loud') {
      const far = BRAIN_COLOURS.filter(c => c !== base.colour && !near.includes(c));
      oddValue = pick(far.length ? far : BRAIN_COLOURS.filter(c => c !== base.colour), rng);
    } else {
      oddValue = other(BRAIN_COLOURS, base.colour, rng);
    }
    oddLabel = 'colour';
  } else if (oddFeature === 'species') {
    const pool = subtlety === 'any' ? ODD_SPECIES_PAIRS
      : ODD_SPECIES_PAIRS.filter(p => p.subtle === (subtlety === 'subtle'));
    const chosen = pick(pool.length ? pool : ODD_SPECIES_PAIRS, rng);
    oddValue = chosen.odd; oddLabel = chosen.label;
  } else {
    oddValue = !base.hat; oddLabel = 'hat';       // every other Boo wears the identical cap
  }

  const odd = { ...base, [oddFeature]: oddValue };
  const items = Array.from({ length: count }, (_, index) =>
    ({ ...(index === oddIndex ? odd : base), id: `odd-${index}` }));
  return {
    items, oddIndex, oddFeature, oddLabel,
    predicateFeatures: [oddFeature],
    distractorFeatures: [],                        // there are none, by design, any more
    expected: { [oddFeature]: base[oddFeature] }
  };
}

export function violatesOddPredicate(boo, grid) {
  return grid.predicateFeatures.some(feature => boo[feature] !== grid.expected[feature]);
}

// ---- Flash Boos: COMPOSED SCENES (RUN10 P19, recomposed RUN18B Y4) -------------------
// A scene used to be a row of Boos with a strip of tiny prop icons underneath, and the
// generator forced a link for ball/swing/bench whether or not the prop was drawn — so a
// question could name a relation the picture never showed. A scene is now a PICTURE: every
// prop is sat on, held or worn BY a named Boo, and a question may only ask about a
// relation that composition actually put on screen (flashRelationHolds, asserted below).
//
// pose: 'on' seats the Boo on the prop through the prop's own socket in data/sockets.js
// (the same seat geometry the town uses); 'holding' draws the prop over the Boo's front at
// hand height; 'wearing' is the existing equip render.
export const FLASH_PROP_POOL = [
  { key: 'swing',    label: 'swing',     pose: 'on',      deco: 'swings', socket: 'deco_swings', booFrac: 0.52 },
  { key: 'bench',    label: 'bench',     pose: 'on',      deco: 'bench',  socket: 'deco_bench',  booFrac: 0.56 },
  // A held prop is anchored by the point on it that the Boo is holding (holdInk, in its own
  // 120x130 viewBox) landing on a point on the Boo (holdAnchor, in the Boo's box): the ball
  // by its middle at the Boo's lower right, the balloon by the END OF ITS STRING at hand
  // height with the balloon itself floating clear. Both anchors keep the prop off the FACE
  // — a prop over an eye does not read as something held; the critic read the first cut as
  // an eyepatch, and was right.
  { key: 'ball',    label: 'ball',    pose: 'holding', deco: 'ball',
    holdAnchor: [0.82, 0.87], holdInk: [0.5, 90 / 130] },
  { key: 'balloon', label: 'balloon', pose: 'holding', deco: 'balloon',
    holdAnchor: [0.95, 0.80], holdInk: [56 / 120, 118 / 130] },
  { key: 'partyhat', label: 'party hat', pose: 'wearing', acc: 'partyhat' },
  { key: 'sunhat',   label: 'sun hat',   pose: 'wearing', acc: 'sunhat' }
];
export const FLASH_PROP_BY_KEY = Object.fromEntries(FLASH_PROP_POOL.map(p => [p.key, p]));
// Pack tiers 1/2/3+ are this app's light/medium/full. Toddler is not a pack tier; it keeps
// the gentlest scene there is, but at THREE Boos rather than two so that a "who" question
// can always offer the three answers every other screen in the app offers.
export const FLASH_TIER_RULES = {
  toddler: { boos: 3, propped: [1, 1], variation: false, counting: false },
  light:   { boos: 4, propped: [1, 1], variation: false, counting: false },
  medium:  { boos: 5, propped: [2, 2], variation: false, counting: false },
  full:    { boos: 6, propped: [2, 3], variation: true,  counting: true }
};
export const FLASH_VARIATIONS = ['eyesClosed', 'waving'];
const FLASH_NAMES = ['Pip', 'Dot', 'Momo', 'Fizz', 'Tink', 'Bop'];

export function flashScene(tier = 'light', rng = Math.random, { toddler = false } = {}) {
  const key = toddler ? 'toddler' : (FLASH_TIER_RULES[tier] ? tier : 'light');
  const rules = FLASH_TIER_RULES[key];
  const count = rules.boos;
  // Colour variation across ALL of them (the pack's tier-1 rule, kept at every tier): six
  // body colours, each used once, so "what colour was Momo?" is always answerable by looking.
  const colours = shuffled(BRAIN_COLOURS, rng).slice(0, count);
  const species = shuffled(BRAIN_SPECIES, rng).slice(0, count);
  const boos = Array.from({ length: count }, (_, index) => ({
    id: `flash-${index}`, position: index, name: FLASH_NAMES[index],
    colour: colours[index], species: species[index],
    hat: false, shine: false,                    // legacy attribute flags: no longer composed
    seatedOn: null, holding: null, wearing: null, variation: null
  }));
  const [lo, hi] = rules.propped;
  const want = Math.min(lo + Math.floor(rng() * (hi - lo + 1)), count);
  const chosen = shuffled(FLASH_PROP_POOL, rng).slice(0, want);
  const hosts = shuffled(boos, rng).slice(0, want);   // distinct Boos: one prop each
  const items = chosen.map((prop, i) => {
    const boo = hosts[i];
    if (prop.pose === 'wearing') boo.wearing = prop.key;
    else if (prop.pose === 'holding') boo.holding = prop.key;
    else boo.seatedOn = prop.key;
    return { prop: prop.key, pose: prop.pose, booId: boo.id };
  });
  if (rules.variation) {
    // one feature variation: a closed-eyes Boo or a waving Boo. Never the seated one — a
    // pose on top of a pose muddles both.
    const free = boos.filter(b => !b.seatedOn);
    pick(free.length ? free : boos, rng).variation = pick(FLASH_VARIATIONS, rng);
  }
  const links = {};
  items.forEach(it => { links[it.prop] = it.booId; });
  return { tier: key, boos, items, props: items.map(it => it.prop), links, counting: rules.counting };
}

// Does the picture actually show what the question asks about? The generator filters every
// candidate through this BEFORE choosing one, and r18b-flashboos re-checks it over 400
// scenes — the two together are what stop a question inventing a relation.
export function flashRelationHolds(scene, q) {
  const find = id => scene.boos.find(b => b.id === id);
  if (q.kind === 'on' || q.kind === 'holding' || q.kind === 'wearing') {
    const propKey = q.template.split(':')[1];
    return scene.items.some(it => it.prop === propKey && it.pose === q.kind && it.booId === q.correct);
  }
  if (q.kind === 'colour') { const b = find(q.targetId); return !!b && b.colour === q.correct; }
  if (q.kind === 'nextTo') {
    const b = find(q.targetId), n = find(q.correct);
    return !!b && !!n && Math.abs(b.position - n.position) === 1;
  }
  if (q.kind === 'count') return q.correct === scene.boos.length;
  return false;
}

function countNear(correct, n) {
  const candidates = [correct - 1, correct + 1, correct + 2, correct - 2].filter(x => x >= 0 && x <= n && x !== correct);
  while (candidates.length < 2) candidates.push((correct + candidates.length + 1) % (n + 1));
  return [...new Set(candidates)].slice(0, 2);
}

// Six question types, every one of them drawn from a relation the scene composed.
// `kind` is the ledger-facing type; `template` carries the instance (which prop, which Boo).
export function flashQuestion(scene, rng = Math.random) {
  const VERB = { on: 'ON', holding: 'HOLDING', wearing: 'WEARING' };
  const candidates = [];
  for (const it of scene.items) {
    const prop = FLASH_PROP_BY_KEY[it.prop];
    candidates.push({
      kind: it.pose, template: `${it.pose}:${it.prop}`,
      prompt: `Who was ${VERB[it.pose]} the ${prop.label}?`,
      correct: it.booId, answerType: 'boo', targetId: it.booId
    });
  }
  for (const b of scene.boos) {
    candidates.push({
      kind: 'colour', template: `colour:${b.id}`, prompt: `What colour was ${b.name}?`,
      correct: b.colour, answerType: 'colour', targetId: b.id
    });
  }
  // NEXT TO is asked only about the two Boos at the ENDS of the line. They have exactly one
  // neighbour each, so the question has exactly one right answer — and they keep that same
  // neighbour whether the row is drawn on one line or wrapped onto two (flashboos.js sizes
  // the grid so the ends never end up alone on a line).
  if (scene.boos.length >= 4) {
    for (const i of [0, scene.boos.length - 1]) {
      const b = scene.boos[i], n = scene.boos[i === 0 ? 1 : i - 1];
      candidates.push({
        kind: 'nextTo', template: `nextTo:${b.id}`, prompt: `Who was NEXT TO ${b.name}?`,
        correct: n.id, answerType: 'boo', targetId: b.id
      });
    }
  }
  if (scene.counting) {
    candidates.push({
      kind: 'count', template: 'count', prompt: 'How many Boos were there?',
      correct: scene.boos.length, answerType: 'number', targetId: null
    });
  }
  const legal = candidates.filter(q => flashRelationHolds(scene, q));
  // Pick the TYPE first, then an instance of it. Picking an instance straight out of the
  // pool buries the composed relations: a scene offers one colour question per Boo but only
  // two or three prop questions in total, so 8 rounds would average 1.6 questions about the
  // picture this packet exists to compose. The pack lists question TYPES; this samples them.
  const pool = legal.length ? legal : candidates;
  const kinds = [...new Set(pool.map(q => q.kind))];
  const kind = pick(kinds, rng);
  const q = pick(pool.filter(c => c.kind === kind), rng);

  let near;
  if (q.answerType === 'boo') {
    // a "next to" question never offers the Boo it just named as an answer
    const barred = q.kind === 'nextTo' ? [q.targetId] : [];
    near = shuffled(scene.boos.filter(b => b.id !== q.correct && !barred.includes(b.id)), rng)
      .slice(0, 2).map(b => b.id);
  } else if (q.answerType === 'colour') {
    near = [...new Set(shuffled(scene.boos, rng).map(b => b.colour).filter(c => c !== q.correct))].slice(0, 2);
    while (near.length < 2) {
      near.push(pick(BRAIN_COLOURS.filter(c => c !== q.correct && !near.includes(c)), rng));
    }
  } else {
    near = countNear(q.correct, 7);
  }
  return { ...q, answers: shuffled([q.correct, ...near], rng) };
}

export function validateFlashQuestion(scene, q) {
  return q.answers.length === 3 && new Set(q.answers).size === 3 && q.answers.includes(q.correct) &&
    (q.answerType !== 'boo' || scene.boos.some(b => b.id === q.correct)) &&
    (q.answerType !== 'colour' || BRAIN_COLOURS.includes(q.correct)) &&
    (q.answerType !== 'number' || Number.isInteger(q.correct));
}
