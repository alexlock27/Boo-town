import { el } from './ui.js';
import { getState, mutate } from './state.js';
import { PETALS, BLOOM_LINES } from '../data/bloom.js';

const clamp = value => Math.max(0, Math.min(100, value));
const mastered = entry => entry && entry.rights >= 3 && entry.rights - entry.misses >= 2;

export function bloomRows(save = getState()) {
  const byGame = (save.stars && save.stars.byGame) || {};
  const ledgerMastered = Object.values(save.ledger || {}).filter(mastered).length;
  return PETALS.map((petal, index) => {
    const plays = petal.games.reduce((total, game) => total + ((byGame[game] && byGame[game].plays) || 0), 0);
    const threes = petal.games.reduce((total, game) => total + ((save.gameThrees && save.gameThrees[game]) || 0), 0);
    // Ledger questions are not all tagged with their game in older saves. Spread their
    // earned mastery evenly, then let actual game rounds provide the visible detail.
    const masteredCount = threes + Math.floor((ledgerMastered + index) / PETALS.length);
    const raw = clamp(masteredCount * 2 + plays * .2);
    const max = Math.max(raw, ((save.bloom && save.bloom.max && save.bloom.max[petal.id]) || 0));
    return { ...petal, plays, mastered: masteredCount, growth: max };
  });
}

export function keepBloomMax() {
  const rows = bloomRows();
  mutate(save => { save.bloom = save.bloom || { max: {} }; save.bloom.max = save.bloom.max || {}; rows.forEach(row => { save.bloom.max[row.id] = Math.max(save.bloom.max[row.id] || 0, row.growth); }); });
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

export function renderBloomTable() {
  const rows = bloomRows();
  const table = el('table', { class: 'gu-ledger bloom-table' });
  table.appendChild(el('tr', { class: 'gl-head' }, [el('th', { text: 'Petal' }), el('th', { text: 'Mastered' }), el('th', { text: 'Plays' }), el('th', { text: 'Last played' })]));
  rows.forEach(row => table.appendChild(el('tr', { class: 'gl-row' }, [el('td', { text: row.display }), el('td', { text: String(row.mastered) }), el('td', { text: String(row.plays) }), el('td', { text: row.plays ? 'Recently' : '—' })])));
  const quiet = rows.filter(row => !row.plays).map(row => row.display).join(', ') || 'None';
  return el('div', { class: 'gu-card' }, [el('h3', { text: '🌸 Brain Bloom' }), table, el('p', { class: 'gu-note', text: `Quiet lately: ${quiet}` })]);
}
