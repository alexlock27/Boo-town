// data/tablesConfig.js — Bubble Pop maths config (spec §10.3, §6).

export const LEVELS = {
  1: { tables: [2, 3, 4, 5, 8, 10], ops: ['mul'] },
  2: { tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], ops: ['mul', 'div'] },
  3: { tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], ops: ['mul', 'div', 'missing'] }
};

export const LEVEL_LABELS = {
  1: 'Club 1 · easy tables',
  2: 'Club 2 · all tables + sharing',
  3: 'Club 3 · everything mixed'
};

export const FACTOR_MIN = 1;
export const FACTOR_MAX = 12;
