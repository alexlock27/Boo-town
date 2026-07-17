// Shared, DOM-free Caper facts. The clue engine only reads these visible features.
export const SUSPECTS = [
  { id: 'fig', name: 'Fig', species: 'pip', colors: { body: 'teal' }, acc: 'cap' },
  { id: 'biscuit', name: 'Biscuit', species: 'pip', colors: { body: 'lilac' }, acc: 'bow' },
  { id: 'nutmeg', name: 'Nutmeg', species: 'nova', colors: { body: 'teal' }, shiny: true },
  { id: 'pickle', name: 'Pickle', species: 'nova', colors: { body: 'lilac' } },
  { id: 'waffle', name: 'Waffle', species: 'pip', colors: { body: 'teal' }, acc: 'bow', shiny: true }
];

export const CAPER_SIGNS = {
  meadow: '→ THE MOON', beach: 'NO SPLASHING (much)', funfair: '→ SNAIL RACES',
  hilltop: 'BEWARE OF SOCKS', riverside: 'PUDDLE HQ'
};

export function culpritFor(seed = 0) { return SUSPECTS[Math.abs(Number(seed) || 0) % SUSPECTS.length].id; }
export function freshCaper(seed = Date.now()) {
  return { open: true, culpritSeed: seed, culprit: culpritFor(seed), clues: 0, cluesToday: 0, clueDay: '', guesses: 0, marked: [], nextAt: 0 };
}
