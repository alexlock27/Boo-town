// RUN10 P6 — the Band Room: six clear destinations, no playfield squeezed under menus.

import { el, backControl } from '../ui.js';
import { music, sfx } from '../sfx.js';
import { resolveItem } from '../customs.js';
import { renderItem } from '../art.js';
import { bandTrio } from '../band.js';

const CARDS = [
  ['band-drums', 'Drums', '🥁'],
  ['band-keys', 'Keys', '🎹'],
  ['band-guitar', 'Guitar', '🎸'],
  ['band-xylophone', 'Xylophone', '🌈'],
  ['band-songs', 'Songs', '🎶'],
  ['band-jams', 'My Jams', '🎛️']
];

export function mount(container, params, ctx) {
  music.play('calm');
  const root = el('div', { class: 'screen band-room' });
  const header = el('header', { class: 'band-room-header' }, [
    backControl(() => ctx.go('town', { area: 'funfair' })),
    el('h2', { text: 'The Boo Band' }),
    el('span', { class: 'band-header-spacer' })
  ]);
  const trio = bandTrio();
  const trioRow = el('div', { class: 'band-room-trio', 'aria-label': "Today's Boo band" });
  for (const [role, icon] of [['drummer', '🥁'], ['keys', '🎹'], ['guitarist', '🎸']]) {
    const item = resolveItem(trio[role]);
    trioRow.appendChild(el('div', { class: 'band-room-bopper' }, [
      el('div', { html: item ? renderItem(item, { size: 74 }) : '' }),
      el('span', { text: icon })
    ]));
  }
  const grid = el('div', { class: 'band-room-grid' });
  for (const [route, label, icon] of CARDS) {
    grid.appendChild(el('button', {
      class: 'band-room-card',
      onclick: () => { sfx.tap(); ctx.go(route); }
    }, [
      el('span', { class: 'band-room-card-art', text: icon }),
      el('strong', { text: label })
    ]));
  }
  root.append(header, trioRow, grid);
  container.appendChild(root);
  window.__bandRoom = { cards: () => [...grid.children].map(c => c.textContent.trim()) };
  return { unmount() {} };
}
