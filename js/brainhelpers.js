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

export function oddGrid(tier = 'light', rng = Math.random, options = {}) {
  const count = tier === 'full' ? 12 : tier === 'medium' ? 9 : 4;
  const base = randomBrainBoo(rng);
  const oddIndex = Math.floor(rng() * count);
  const oddFeature = FEATURES.includes(options.oddFeature) ? options.oddFeature : pick(FEATURES, rng);
  const distractorFeatures = shuffled(FEATURES.filter(feature => feature !== oddFeature), rng)
    .slice(0, TIER_ARITY[tier] || 1);

  // Build repeated visual families, then change one feature on one Boo. Other
  // differences remain interesting but always occur in groups of 2+, so none can
  // masquerade as a second answer. Medium uses 3 families; Full uses 4.
  const familySize = tier === 'light' ? 2 : 3;
  const familyCount = count / familySize;
  const families = Array.from({ length: familyCount }, () => ({ ...base }));
  distractorFeatures.forEach((feature, featureIndex) => {
    const alternate = { ...base };
    invert(alternate, feature, rng);
    families.forEach((family, familyIndex) => {
      if ((familyIndex + featureIndex) % 2 === 1) family[feature] = alternate[feature];
    });
  });
  const positions = shuffled(Array.from({ length: count }, (_, index) => index), rng);
  const familyForIndex = new Map(positions.map((index, position) => [index, Math.floor(position / familySize)]));
  const items = Array.from({ length: count }, (_, index) => ({
    ...families[familyForIndex.get(index)], id:`odd-${index}`
  }));
  invert(items[oddIndex], oddFeature, rng);
  const predicateFeatures = [oddFeature];
  return {
    items, oddIndex, oddFeature, predicateFeatures, distractorFeatures,
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
