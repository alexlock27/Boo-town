// RUN10 P19 — Brain Bloom is a child-facing celebration, with a neutral grown-up view.

import { el } from './ui.js';
import { getState, mutate } from './state.js';
import { PETALS, BLOOM_LINES } from '../data/bloom.js';

const clamp = value => Math.max(0, Math.min(100, value));
const mastered = entry => entry && entry.rights >= 3 && entry.rights - entry.misses >= 2;
const QUIET_MS = 14 * 24 * 60 * 60 * 1000;
const LEDGER_PREFIX = {
  feed: 'feedboos', flash: 'flashboos', echo: 'echoboos', odd: 'oddboo',
  detective: 'detective', expedition: 'expedition', caper: 'caper', roll: 'booroll',
  blocks: 'blocks', bubble: 'bubblepop', boopop: 'boopop', bounce: 'bounce', clock: 'clockshop',
  tmul: 'bubblepop', spell: 'detective', pairs: 'pairs'
};

export function ledgerGame(key, entry = {}) {
  if (entry.game) return entry.game;
  const raw = String(key || '').toLowerCase();
  if (/^tmul\d+/.test(raw) || /^b\d+/.test(raw)) return 'bubblepop';
  const prefix = raw.split(/[:_]/)[0];
  if (LEDGER_PREFIX[prefix]) return LEDGER_PREFIX[prefix];
  return null;
}

export function bloomRows(save = getState(), now = Date.now()) {
  const byGame = (save.stars && save.stars.byGame) || {};
  const ledger = save.ledger || {};
  return PETALS.map(petal => {
    const games = new Set(petal.games);
    const entries = Object.entries(ledger).filter(([key, entry]) => games.has(ledgerGame(key, entry)));
    const masteredCount = entries.filter(([, entry]) => mastered(entry)).length;
    const plays = petal.games.reduce((total, game) => total + ((byGame[game] && byGame[game].plays) || 0), 0);
    const gameLast = petal.games.reduce((latest, game) => Math.max(latest, (byGame[game] && byGame[game].lastPlayed) || 0), 0);
    const ledgerLast = entries.reduce((latest, [, entry]) => Math.max(latest, entry.lastSeen || 0), 0);
    const lastPlayed = Math.max(gameLast, ledgerLast);
    const rawGrowth = clamp(masteredCount * 2 + plays * .2);
    const maxGrowth = Math.max(rawGrowth, ((save.bloom && save.bloom.max && save.bloom.max[petal.id]) || 0));
    return { ...petal, plays, mastered: masteredCount, lastPlayed, quiet: !lastPlayed || now - lastPlayed > QUIET_MS, rawGrowth, growth: maxGrowth };
  });
}

export function keepBloomMax() {
  const rows = bloomRows();
  mutate(save => {
    save.bloom = save.bloom || { max: {} }; save.bloom.max = save.bloom.max || {};
    rows.forEach(row => { save.bloom.max[row.id] = Math.max(save.bloom.max[row.id] || 0, row.rawGrowth); });
  });
  return rows;
}

export function renderBloomCard(container) {
  const rows = keepBloomMax();
  const card = el('section', { class: 'bloom-card' });
  card.appendChild(el('h3', { text: '🌸 Brain Bloom' }));
  const flower = el('div', { class: 'bloom-flower' });
  rows.forEach((row, index) => {
    const petal = el('button', { class: `bloom-petal bloom-${row.id}`, style: { '--grow': String(Math.max(.22, row.growth / 100)), '--delay': `${index * .12}s` }, text: row.display, title: `${row.growth}%` });
    petal.addEventListener('click', () => { const line = BLOOM_LINES[index % BLOOM_LINES.length].replaceAll('{petal}', row.display); card.querySelector('.bloom-line').textContent = line; });
    flower.appendChild(petal);
  });
  card.append(flower, el('p', { class: 'bloom-line', text: 'Tap a petal to see it sparkle.' }));
  container.appendChild(card); return card;
}

function dateLabel(timestamp) {
  if (!timestamp) return '—';
  try { return new Date(timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return '—'; }
}

export function renderBloomTable() {
  const rows = bloomRows();
  const table = el('table', { class: 'gu-ledger bloom-table' });
  table.appendChild(el('tr', { class: 'gl-head' }, [el('th', { text: 'Petal' }), el('th', { text: 'Mastered' }), el('th', { text: 'Plays' }), el('th', { text: 'Last played' })]));
  rows.forEach(row => table.appendChild(el('tr', { class: 'gl-row' }, [el('td', { text: row.display }), el('td', { text: String(row.mastered) }), el('td', { text: String(row.plays) }), el('td', { text: dateLabel(row.lastPlayed) })])));
  const quiet = rows.filter(row => row.quiet).map(row => row.display).join(', ') || 'None';
  return el('div', { class: 'gu-card' }, [el('h3', { text: '🌸 Brain Bloom' }), table, el('p', { class: 'gu-note', text: `Quiet lately: ${quiet}` })]);
}
