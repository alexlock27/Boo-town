export const BLOOM_PETALS = [
  { id: 'identify', display: 'Spot it!', games: ['oddboo', 'feedboos'] },
  { id: 'memorize', display: 'Remember it!', games: ['flashboos', 'echoboos', 'pairs', 'tpairs'] },
  { id: 'analyze', display: 'Figure it out!', games: ['expedition', 'caper', 'detective'] },
  { id: 'compute', display: 'Number it!', games: ['bubblepop', 'boopop', 'bounce', 'clockshop'] },
  { id: 'visualize', display: 'Picture it!', games: ['booroll', 'blocks'] }
];

export const BLOOM_COPY = [
  'Your {petal} petal is blooming!',
  'Look how {petal} has grown!',
  '{petal} power: sparkling!',
  'A new leaf on {petal}!',
  'The garden loves your {petal}!'
];

const clamp = n => Math.max(0, Math.min(100, n));
const belongs = (key, game) => key === game || key.startsWith(`${game}:`) || key.startsWith(`${game}-`);

export function bloomStats(state, now = Date.now()) {
  const ledger = state.ledger || {};
  const stars = (state.stars && state.stars.byGame) || {};
  return BLOOM_PETALS.map(petal => {
    const entries = Object.entries(ledger).filter(([key]) => petal.games.some(game => belongs(key, game)));
    const mastered = entries.filter(([, e]) => (e.rights || 0) >= 3 && ((e.rights || 0) - (e.misses || 0)) >= 2).length;
    const plays = petal.games.reduce((sum, game) => sum + ((stars[game] && stars[game].plays) || 0), 0);
    const lastPlayed = Math.max(0, ...entries.map(([, e]) => e.lastSeen || 0));
    const calculated = clamp(mastered * 2 + plays * .2);
    const previous = ((state.bloom && state.bloom.max) || {})[petal.id] || 0;
    return { ...petal, mastered, plays, lastPlayed, growth: Math.max(previous, calculated), calculated, quiet: plays === 0 && (!lastPlayed || now - lastPlayed >= 14 * 86400000) };
  });
}

export function persistBloomMax(state) {
  state.bloom = state.bloom || { max: {} };
  state.bloom.max = state.bloom.max || {};
  for (const row of bloomStats(state)) state.bloom.max[row.id] = Math.max(state.bloom.max[row.id] || 0, row.calculated);
  return state.bloom.max;
}
