// js/collection.js — the collection shelf (spec §5.6).

import { el, dialog } from './ui.js';
import { getState } from './state.js';
import { renderItem } from './art.js';
import { CATALOGUE, TOTAL_ITEMS, RARITY } from '../data/catalogue.js';
import { sfx, music } from './sfx.js';

export function mount(container, params, ctx) {
  const s = getState();
  music.play('calm');
  const owned = s.inventory;
  const foundCount = Object.keys(owned).filter(id => owned[id] > 0).length;

  const root = el('div', { class: 'collection' });

  const header = el('header', { class: 'coll-header' }, [
    el('button', { class: 'icon-btn back-btn', html: backArrow(), 'aria-label': 'Back', onclick: () => { sfx.tap(); ctx.go('hub'); } }),
    el('h2', { text: 'My Collection' }),
    el('span', { class: 'coll-count', text: `${foundCount} of ${TOTAL_ITEMS} found` })
  ]);

  const grid = el('div', { class: 'coll-grid' });
  for (const item of CATALOGUE) {
    const count = owned[item.id] || 0;
    const has = count > 0;
    const tile = el('button', {
      class: 'coll-tile' + (has ? ' owned' : ' locked') + ' rar-' + item.rarity,
      onclick: () => { sfx.tap(); if (has) showItem(item, count); }
    }, [
      el('div', { class: 'coll-art' + (has ? '' : ' mystery'), html: renderItem(item, { size: 84 }) }),
      el('div', { class: 'coll-name', text: has ? item.name : '???' }),
      count > 1 ? el('div', { class: 'coll-badge', text: 'x' + count }) : null
    ]);
    grid.appendChild(tile);
  }

  const footer = el('div', { class: 'coll-footer' }, [
    el('button', { class: 'btn', text: '✏️ Edit my guide', onclick: () => { sfx.tap(); ctx.go('editguide', { from: 'collection' }); } })
  ]);

  root.append(header, grid, footer);
  container.appendChild(root);

  function showItem(item, count) {
    const body = el('div', { class: 'item-detail' }, [
      el('div', { class: 'item-detail-art', html: renderItem(item, { size: 150, cls: item.fx ? '' : 'art-idle' }) }),
      el('div', { class: 'item-detail-rarity', text: RARITY[item.rarity].label + (count > 1 ? ` · you have ${count}` : '') }),
      el('p', { class: 'item-detail-blurb', text: item.blurb })
    ]);
    dialog({ title: item.name, body, buttons: [{ label: 'Close', value: true, kind: 'secondary' }], dismissable: true });
  }

  return { unmount() {} };
}

function backArrow() {
  return `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M15 5l-7 7 7 7" fill="none" stroke="var(--card)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
