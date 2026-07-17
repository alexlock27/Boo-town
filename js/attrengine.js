// RUN10 P14 — pure attribute reasoning shared by the expedition puzzles.
const LABEL = { species: 'species', colour: 'colour', accessory: 'wearing an accessory', shiny: 'shiny' };
export function features(boo = {}) { return { species: boo.species || boo.kind || 'boo', colour: boo.colour || boo.color || boo.colors?.body || 'unknown', accessory: !!(boo.accessory || boo.acc || boo.equips), shiny: !!boo.shiny }; }
export function featuresOf(obj = {}) { return features(obj); }
export function partition(list, pred) { const yes = [], no = []; for (const item of list) (pred(item) ? yes : no).push(item); return { yes, no }; }
function makeRule(path, value, negated = false, second = null) {
  const testOne = item => featuresOf(item)[path] === value;
  const pred = second ? item => (negated ? !testOne(item) : testOne(item)) && featuresOf(item)[second.path] === second.value : item => negated ? !testOne(item) : testOne(item);
  const describe = () => second ? `${negated ? 'not ' : ''}${path} ${value} and ${second.path} ${second.value}` : path === 'accessory' || path === 'shiny' ? (negated ? `not ${LABEL[path]}` : LABEL[path]) : `${negated ? 'not ' : ''}${value} ${LABEL[path]}`;
  const rule = { pred, text: describe(), describe, featurePath: second ? [path, second.path] : path, negated, arity: second ? 2 : 1 };
  rule.swap = () => makeRule(path, value, !negated, second);
  return rule;
}
function candidates(list, exclude = []) {
  const out = [];
  for (const path of ['species', 'colour', 'accessory', 'shiny']) {
    if (exclude.includes(path)) continue;
    const values = [...new Set(list.map(x => featuresOf(x)[path]))];
    for (const value of values) { const r = makeRule(path, value); const p = partition(list, r.pred); if (p.yes.length >= 3 && p.no.length >= 3) out.push({ path, value, yes: p.yes.length, no: p.no.length, rule: r }); }
  }
  return out;
}
export function genRule(list, { tier = 1, exclude = [] } = {}) {
  const singles = candidates(list, exclude); if (!singles.length) return null;
  if (tier >= 3) {
    for (const a of singles) for (const b of singles) if (a.path !== b.path) { const r = makeRule(a.path, a.value, false, b); const p = partition(list, r.pred); if (p.yes.length >= 3 && p.no.length >= 3) return r; }
  }
  const base = singles[0];
  return makeRule(base.path, base.value, tier >= 2 && base.no >= 3 && base.yes >= 3 ? false : false);
}
export function genExclusiveRules(list, n, { tier = 1 } = {}) {
  if (!list.length || n < 2) return null;
  for (const path of ['species', 'colour', 'accessory', 'shiny']) {
    const groups = new Map(); for (const item of list) { const value = featuresOf(item)[path]; groups.set(value, [...(groups.get(value) || []), item]); }
    if (groups.size !== n || [...groups.values()].some(g => g.length < 3)) continue;
    return [...groups.keys()].map(value => makeRule(path, value));
  }
  return null;
}
export function cluesFor(culprit, pool, n = 4) {
  const f = featuresOf(culprit), all = [];
  for (const path of ['species', 'colour', 'accessory', 'shiny']) all.push(makeRule(path, f[path]));
  const picked = [], remaining = pool.slice();
  while (picked.length < n && all.length) {
    all.sort((a, b) => partition(remaining, a.pred).yes.length - partition(remaining, b.pred).yes.length);
    const next = all.shift(); picked.push(next); const matches = remaining.filter(next.pred); remaining.splice(0, remaining.length, ...matches);
    if (remaining.length <= 1) break;
  }
  // Repeating a truthful clue is preferable to inventing one when a tiny pool runs out.
  while (picked.length < n && picked.length) picked.push(picked[picked.length - 1]);
  return picked;
}
export function informativeNext(list, history = []) {
  const tried = new Set(history.map(x => x.id || x));
  const choices = list.filter(x => !tried.has(x.id || x));
  let best = null, bestScore = -Infinity;
  for (const item of choices) {
    const f = featuresOf(item); let score = 0;
    for (const path of ['species', 'colour', 'accessory', 'shiny']) { const count = list.filter(x => featuresOf(x)[path] === f[path]).length; score += Math.min(count, list.length - count); }
    if (score > bestScore) { bestScore = score; best = item; }
  }
  return best;
}
