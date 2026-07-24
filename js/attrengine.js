// RUN10 P14 — the DOM-free attribute brain used by Expedition, Caper and games.
// Rules deliberately describe only things that are visibly present in the supplied
// group.  That keeps every puzzle discoverable from play rather than from a secret.

const PATHS = ['species', 'colour', 'accessory', 'shiny'];
const LABELS = {
  species: 'species', colour: 'colour', accessory: 'wearing an accessory', shiny: 'shiny'
};

export function features(boo = {}) {
  return {
    species: boo.species || boo.kind || 'boo',
    colour: boo.colour || boo.color || boo.colors?.body || 'unknown',
    accessory: Boolean(boo.accessory || boo.acc || boo.equip || boo.equips),
    shiny: Boolean(boo.shiny || boo.isShiny)
  };
}

export function featuresOf(obj = {}) { return features(obj); }

export function partition(list, pred) {
  const yes = [], no = [];
  for (const item of list || []) (pred(item) ? yes : no).push(item);
  return { yes, no };
}

function plain(path, value, negated) {
  if (path === 'accessory' || path === 'shiny') {
    const hasIt = negated ? !value : !!value;
    return hasIt ? LABELS[path] : `not ${LABELS[path]}`;
  }
  return `${negated ? 'not ' : ''}${value} ${LABELS[path]}`;
}

function ruleFor(parts, { swap = false } = {}) {
  const pred = item => parts.every(part => {
    const same = featuresOf(item)[part.path] === part.value;
    return part.negated ? !same : same;
  });
  const text = parts.map(part => plain(part.path, part.value, part.negated)).join(' and ');
  const rule = {
    pred,
    text,
    describe: () => text,
    featurePath: parts.length === 1 ? parts[0].path : parts.map(part => part.path),
    negated: parts.some(part => part.negated),
    arity: parts.length
  };
  // Tier four has one harmless, explicit mid-scene change: flip the first condition.
  if (swap) rule.swap = () => ruleFor(parts.map((part, index) => index ? { ...part } : { ...part, negated: !part.negated }), { swap: true });
  return rule;
}

function bucketRule(path, values, domain, { swap = false } = {}) {
  const chosen = new Set(values);
  const pred = item => chosen.has(featuresOf(item)[path]);
  const words = values.map(value => (path === 'accessory' || path === 'shiny') ? (value ? LABELS[path] : `not ${LABELS[path]}`) : String(value));
  const text = (path === 'accessory' || path === 'shiny') ? words.join(' or ') : `${words.join(' or ')} ${LABELS[path]}`;
  const rule = { pred, text, describe: () => text, featurePath: path, negated: false, arity: 1 };
  if (swap) rule.swap = () => bucketRule(path, domain.filter(value => !chosen.has(value)), domain, { swap: true });
  return rule;
}

function valueParts(list, exclude = []) {
  const parts = [];
  for (const path of PATHS) {
    if (exclude.includes(path)) continue;
    for (const value of new Set((list || []).map(item => featuresOf(item)[path]))) parts.push({ path, value, negated: false });
  }
  return parts;
}

function isUseful(list, rule) {
  const split = partition(list, rule.pred);
  return split.yes.length >= 3 && split.no.length >= 3;
}

// Generate the first deterministic valid rule.  Callers can top up a thin party when
// this returns null, rather than presenting a rule the child cannot infer.
export function genRule(list, { tier = 1, exclude = [] } = {}) {
  if (!Array.isArray(list) || list.length < 6) return null;
  const parts = valueParts(list, exclude);
  const singles = [];
  for (const part of parts) {
    const equal = ruleFor([part], { swap: tier >= 4 });
    if (isUseful(list, equal)) singles.push(equal);
    if (tier >= 2) {
      const notEqual = ruleFor([{ ...part, negated: true }], { swap: tier >= 4 });
      if (isUseful(list, notEqual)) singles.push(notEqual);
    }
  }
  if (tier >= 3) {
    for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
      if (parts[i].path === parts[j].path) continue;
      const both = ruleFor([parts[i], parts[j]], { swap: tier >= 4 });
      if (isUseful(list, both)) return both;
    }
  }
  return singles[0] || null;
}

// n exact feature buckets are the clearest exclusive rules.  Each bucket must contain
// at least three members, which preserves the Expedition's "try and compare" play.
export function genExclusiveRules(list, n, { tier = 1 } = {}) {
  if (!Array.isArray(list) || list.length < n || n < 2) return null;
  // Enumerate observable condition groups (one feature at early tiers, a conjunction
  // once the puzzles are ready for it).  We then find a true partition, rather than
  // assuming one feature happens to have enough values for every room/bridge.
  const parts = valueParts(list);
  const maxArity = tier >= 3 ? 2 : 1;
  const candidates = [];
  const add = (rule) => {
    const mask = list.reduce((bits, item, index) => rule.pred(item) ? bits | (1 << index) : bits, 0);
    if (!mask || mask === (1 << list.length) - 1) return;
    candidates.push({ rule, mask, size: list.filter(rule.pred).length });
  };
  for (const part of parts) {
    add(ruleFor([part], { swap: tier >= 4 }));
    add(ruleFor([{ ...part, negated: true }], { swap: tier >= 4 }));
  }
  // A visible feature may have more values than rooms. Grouping those values into
  // explicit “A or B” buckets gives a simple exact cover (especially for Hotel).
  for (const path of PATHS) {
    const values = [...new Set(list.map(item => featuresOf(item)[path]))];
    if (values.length < n) continue;
    const buckets = Array.from({ length: n }, () => []);
    values.forEach((value, index) => buckets[index % n].push(value));
    buckets.forEach(valuesInBucket => add(bucketRule(path, valuesInBucket, values, { swap: tier >= 4 })));
  }
  if (maxArity > 1) for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) {
    if (parts[i].path !== parts[j].path) add(ruleFor([parts[i], parts[j]], { swap: tier >= 4 }));
  }
  // Multiple predicates may describe exactly the same group; keep the simplest wording.
  const unique = new Map();
  for (const candidate of candidates) {
    const old = unique.get(candidate.mask);
    if (!old || candidate.rule.arity < old.rule.arity || candidate.rule.text < old.rule.text) unique.set(candidate.mask, candidate);
  }
  const all = (1 << list.length) - 1;
  const groups = [...unique.values()].sort((a, b) => Math.abs(a.size - list.length / n) - Math.abs(b.size - list.length / n) || a.rule.arity - b.rule.arity || a.rule.text.localeCompare(b.rule.text));
  const solve = (covered, chosen) => {
    if (chosen.length === n) return covered === all ? chosen : null;
    const remainingSlots = n - chosen.length;
    const first = list.findIndex((_, index) => !(covered & (1 << index)));
    if (first < 0) return null;
    for (const candidate of groups) {
      if (!(candidate.mask & (1 << first)) || (candidate.mask & covered)) continue;
      const nextCovered = covered | candidate.mask;
      const left = list.length - nextCovered.toString(2).replace(/0/g, '').length;
      if (left < remainingSlots - 1) continue;
      const answer = solve(nextCovered, [...chosen, candidate.rule]);
      if (answer) return answer;
    }
    return null;
  };
  return solve(0, []);
}

function truthfulRules(culprit, pool) {
  const f = featuresOf(culprit);
  const rules = [];
  for (const path of PATHS) {
    rules.push(ruleFor([{ path, value: f[path], negated: false }]));
    rules.push(ruleFor([{ path, value: f[path], negated: true }]));
  }
  for (let i = 0; i < PATHS.length; i++) for (let j = i + 1; j < PATHS.length; j++) {
    rules.push(ruleFor([{ path: PATHS[i], value: f[PATHS[i]], negated: false }, { path: PATHS[j], value: f[PATHS[j]], negated: false }]));
  }
  return rules.filter(rule => rule.pred(culprit) && partition(pool, rule.pred).yes.length > 0);
}

// Pick the predicate that eliminates the most remaining suspects at each step.  The
// returned sequence is true of the culprit, and its final conjunction is unique whenever
// the supplied pool contains enough visible diversity.
export function cluesFor(culprit, pool, n = 4) {
  if (!culprit || !Array.isArray(pool) || !pool.length || n < 1) return [];
  const candidates = truthfulRules(culprit, pool);
  const clues = [];
  let possible = pool.slice();
  while (clues.length < n && candidates.length) {
    const unused = candidates.filter(rule => !clues.some(old => old.text === rule.text));
    const source = unused.length ? unused : candidates;
    source.sort((a, b) => partition(possible, a.pred).yes.length - partition(possible, b.pred).yes.length || a.text.localeCompare(b.text));
    const next = source[0];
    clues.push(next);
    possible = possible.filter(next.pred);
    if (possible.length === 1) break;
  }
  // A card fan always has n cards. Prefer a fresh truthful observation after the culprit
  // is already identified; repeat only when the data itself has no fourth visible fact.
  for (const candidate of candidates) {
    if (clues.length >= n) break;
    if (!clues.some(old => old.text === candidate.text)) clues.push(candidate);
  }
  while (clues.length < n && clues.length) clues.push(clues[clues.length - 1]);
  return clues;
}

// The candidate carrying the most balanced set of visible feature groups is the most
// informative next experiment. History accepts either objects or ids.
export function informativeNext(list, history = []) {
  const tried = new Set((history || []).map(item => typeof item === 'object' ? item.id : item));
  const choices = (list || []).filter(item => !tried.has(item.id));
  let best = null, bestScore = -Infinity;
  for (const item of choices) {
    const f = featuresOf(item);
    let score = 0;
    for (const path of PATHS) {
      const same = (list || []).filter(other => featuresOf(other)[path] === f[path]).length;
      score += Math.min(same, (list || []).length - same);
    }
    if (score > bestScore) { best = item; bestScore = score; }
  }
  return best;
}
