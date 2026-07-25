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

export function oddGrid(tier = 'light', rng = Math.random, options = {}) {
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

const FLASH_PROPS = ['ball', 'hat-stand', 'swing', 'bench'];
export function flashScene(tier = 'light', rng = Math.random, { toddler = false } = {}) {
  const count = toddler ? 2 : tier === 'full' ? 6 : tier === 'medium' ? 5 : tier === 'light' ? 4 : 3;
  const boos = Array.from({ length: count }, (_, index) => ({
    ...randomBrainBoo(rng), id: `flash-${index}`, position: index,
    name: ['Pip','Dot','Momo','Fizz','Tink','Bop'][index]
  }));
  // Position/identity questions need visible differences.
  boos.forEach((boo, i) => { boo.colour = BRAIN_COLOURS[i % BRAIN_COLOURS.length]; boo.species = BRAIN_SPECIES[i % BRAIN_SPECIES.length]; });
  // Count questions always have visible evidence to circle on the reveal-again.
  boos[0].hat = true;
  boos[Math.min(1, boos.length - 1)].shine = true;
  const propCount = toddler ? 1 : Math.floor(rng() * 3);
  const props = FLASH_PROPS.slice().sort(() => rng() - .5).slice(0, propCount);
  const links = {};
  props.forEach((prop, i) => { links[prop] = boos[i % boos.length].id; });
  // Always make every exact template possible; only visible props are drawn.
  if (!links.ball) links.ball = boos[Math.floor(rng() * boos.length)].id;
  if (!links.swing) links.swing = boos[0].id;
  if (!links.bench) links.bench = boos[boos.length - 1].id;
  return { boos, props, links };
}

function countNear(correct, n) {
  const candidates = [correct - 1, correct + 1, correct + 2, correct - 2].filter(x => x >= 0 && x <= n && x !== correct);
  while (candidates.length < 2) candidates.push((correct + candidates.length + 1) % (n + 1));
  return [...new Set(candidates)].slice(0, 2);
}

export function flashQuestion(scene, rng = Math.random) {
  const templates = ['countWearing:hat', 'countWearing:shine', 'colourOfPosition:leftmost', 'colourOfPosition:rightmost', 'howManyTotal'];
  if (scene.props.includes('swing')) templates.push('whichSatOn:swing');
  if (scene.props.includes('bench')) templates.push('whichSatOn:bench');
  if (scene.props.includes('ball')) templates.push('whoHeldThe:ball');
  const template = pick(templates, rng);
  const [kind, arg] = template.split(':');
  let prompt, correct, near, answerType, targetId = null;
  if (kind === 'countWearing') {
    correct = scene.boos.filter(b => b[arg]).length;
    near = countNear(correct, scene.boos.length);
    prompt = `How many wore ${arg === 'hat' ? 'hats' : 'a shine'}?`;
    answerType = 'number';
  } else if (kind === 'howManyTotal') {
    correct = scene.boos.length; near = countNear(correct, 7);
    prompt = 'How many Boos were there?'; answerType = 'number';
  } else if (kind === 'colourOfPosition') {
    const target = arg === 'leftmost' ? scene.boos[0] : scene.boos.at(-1);
    correct = target.colour; targetId = target.id;
    const neighbour = arg === 'leftmost' ? scene.boos[1] : scene.boos.at(-2);
    near = [neighbour.colour, BRAIN_COLOURS.find(c => c !== correct && c !== neighbour.colour)];
    prompt = `What colour was the ${arg} Boo?`; answerType = 'colour';
  } else {
    const prop = kind === 'whichSatOn' ? arg : 'ball';
    targetId = scene.links[prop];
    correct = targetId;
    near = scene.boos.filter(b => b.id !== correct).slice(0, 2).map(b => b.id);
    prompt = kind === 'whichSatOn' ? `Who sat on the ${prop}?` : 'Who held the ball?';
    answerType = 'boo';
  }
  const answers = [correct, ...near].sort(() => rng() - .5);
  return { template, prompt, correct, answers, answerType, targetId };
}

export function validateFlashQuestion(scene, q) {
  return q.answers.length === 3 && new Set(q.answers).size === 3 && q.answers.includes(q.correct) &&
    (q.answerType !== 'boo' || scene.boos.some(b => b.id === q.correct)) &&
    (q.answerType !== 'colour' || BRAIN_COLOURS.includes(q.correct)) &&
    (q.answerType !== 'number' || Number.isInteger(q.correct));
}
