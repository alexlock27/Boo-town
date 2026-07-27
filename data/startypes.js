// data/startypes.js — RUN15 V1: the five star types, and the exact game→type mapping.
// AUTHORED from RUN15.md's mapping list; nothing here is inferred. Pure data + pure
// functions, so the simulation, the shop, the results screen and the tests all read one
// source and cannot drift.

// Display names and colours, drawn from the existing palette (no new colours invented).
export const STAR_TYPES = [
  { key: 'maths',    name: 'Maths Stars',    icon: '➕', colour: 'var(--sky-mid)' },
  { key: 'word',     name: 'Word Stars',     icon: '🔤', colour: 'var(--pop)' },
  { key: 'puzzle',   name: 'Puzzle Stars',   icon: '🧩', colour: 'var(--zing)' },
  { key: 'creative', name: 'Creative Stars', icon: '🎨', colour: '#C6A9F0' },
  { key: 'lesson',   name: 'Lesson Stars',   icon: '📘', colour: 'var(--star)' }
];
export const TYPE_KEYS = STAR_TYPES.map(t => t.key);
// The Legacy pool: everything earned before the shop opened. It spends like any type —
// generous by design — and the shop says so in as many words.
export const LEGACY_KEY = 'legacy';
export const LEGACY_LABEL = 'Stars you earned before the shop opened';
export const SPENDABLE_KEYS = [...TYPE_KEYS, LEGACY_KEY];
export const typeByKey = (k) => STAR_TYPES.find(t => t.key === k) || null;

// The authored mapping (RUN15 V1). A game that spans two types is resolved by its
// ROUND CONTENT, not by its name — see starTypeFor().
export const GAME_STAR_TYPE = {
  // Maths — Bubble Pop, Boo Bounce, Boo Dash, Boo Pop, Clock Shop, Boo Blocks
  bubblepop: 'maths', bounce: 'maths', dash: 'maths', boopop: 'maths', clockshop: 'maths',
  blocks: 'maths',
  // Word — Spell Boo, Word Detective (Feed the Boos is content-dependent, below)
  spellboo: 'word', detective: 'word',
  // RUN16: the four literacy games are Word content end to end
  soundsorter: 'word', blendit: 'word', rhymetime: 'word', storyorder: 'word',
  // Puzzle — Odd Boo Out, Flash Boos, Echo Boos, Boo Roll, the Expedition, the Caper
  oddboo: 'puzzle', flashboos: 'puzzle', echoboos: 'puzzle', booroll: 'puzzle',
  expedition: 'puzzle', expeditionpuzzle: 'puzzle', caper: 'puzzle', booquest: 'puzzle',
  // Creative — the Studio (a finished painting, a sealed collage, a built Boo), the Band
  // (a saved jam), and completed Boo Care rituals
  paint: 'creative', collage: 'creative', buildaboo: 'creative', band: 'creative',
  bandroom: 'creative', care: 'creative', studio: 'creative',
  // Lesson — Teach Me
  teachme: 'lesson',
  // Golden Round follows its own content, resolved below (word by default: it is a
  // spelling-and-reading card).
  golden: 'word'
};
// Games whose type depends on the round's content (RUN15 V1, exact).
export const CONTENT_DEPENDENT = {
  // Feed the Boos: English templates pay Word, everything else Maths.
  feedboos: { word: ['spell', 'word', 'letters', 'rhyme', 'sounds', 'english', 'reading'], fallback: 'maths' },
  // Boo Blocks: its puzzle scoring pays Puzzle, its question content pays Maths.
  blocks: { puzzle: ['puzzle', 'shapes', 'blocks'], fallback: 'maths' }
};

// Resolve the type a round should credit.
//   game — the route key; cat — the round's category/content key (may be null);
//   hint — an explicit type a game may pass when it knows better than any table.
export function starTypeFor(game, cat = null, hint = null) {
  if (hint && TYPE_KEYS.includes(hint)) return hint;
  const rule = CONTENT_DEPENDENT[game];
  if (rule) {
    const c = String(cat || '').toLowerCase();
    for (const [type, words] of Object.entries(rule)) {
      if (type === 'fallback') continue;
      if (words.some(w => c.includes(w))) return type;
    }
    return rule.fallback;
  }
  return GAME_STAR_TYPE[game] || 'puzzle';
}

// ---- the ledger helpers -------------------------------------------------------------
// G11 IS ENFORCED HERE, not by convention: earning and spending are separate ledgers.
//   stars.total   — LIFETIME, the sum of everything ever earned. Zone unlocks, the meter
//                   and every card read this. A purchase NEVER touches it.
//   stars.byType  — LIFETIME per type. Also never reduced.
//   stars.spent   — per type, what the shop has taken. Spendable = byType − spent.
export function spendableOf(s, type) {
  const st = (s && s.stars) || {};
  const earned = type === LEGACY_KEY ? ((st.legacy || 0)) : (((st.byType || {})[type]) || 0);
  const spent = ((st.spent || {})[type]) || 0;
  return Math.max(0, earned - spent);
}
export function spendableAll(s) {
  return Object.fromEntries(SPENDABLE_KEYS.map(k => [k, spendableOf(s, k)]));
}
// What a price of `n` stars of `type` can draw on: that type first, then Legacy.
export function canAfford(s, type, n) {
  return spendableOf(s, type) + spendableOf(s, LEGACY_KEY) >= n;
}
// Plan a payment WITHOUT mutating: {fromType, fromLegacy} or null if unaffordable.
export function planPayment(s, type, n) {
  if (!canAfford(s, type, n)) return null;
  const own = Math.min(spendableOf(s, type), n);
  return { fromType: own, fromLegacy: n - own };
}
