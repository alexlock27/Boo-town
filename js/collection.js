// js/collection.js — the collection shelf (spec §5.6) + wardrobe (RUN2 C2).

import { el, dialog } from './ui.js';
import { getState } from './state.js';
import { renderItem, renderGuide } from './art.js';
import { COLLECTIBLES, ACCESSORIES, TOTAL_ITEMS, RARITY } from '../data/catalogue.js';
import { equippedArt, openDressUp, openRename, openEquipPicker, getDisplayName, officialName } from './accessories.js';
import { sfx, music } from './sfx.js';

export function mount(container, params, ctx) {
  const s = getState();
  music.play('calm');
  const owned = s.inventory;
  const foundCount = COLLECTIBLES.filter(it => owned[it.id] > 0).length;

  const root = el('div', { class: 'collection' });

  const header = el('header', { class: 'coll-header' }, [
    el('button', { class: 'icon-btn back-btn', html: backArrow(), 'aria-label': 'Back', onclick: () => { sfx.tap(); ctx.go('hub'); } }),
    el('h2', { text: 'My Collection' }),
    el('span', { class: 'coll-count', text: `${foundCount} of ${TOTAL_ITEMS} found` })
  ]);

  // "My character" card — opens the full creator (spec RUN2 C1).
  const myCharCard = el('button', {
    class: 'mychar-card', 'aria-label': 'Edit my character',
    onclick: () => { sfx.tap(); ctx.go('editguide', { from: 'collection' }); }
  }, [
    el('div', { class: 'mychar-art', html: renderGuide(s.guide, { view: 'full', size: 96, cls: 'art-idle' }) }),
    el('div', { class: 'mychar-meta' }, [
      el('div', { class: 'mychar-title', text: 'My character' }),
      el('div', { class: 'mychar-name', text: s.guide.name || 'Twiggy' }),
      el('div', { class: 'mychar-hint', text: 'Tap to change anything ✏️' })
    ])
  ]);

  const grid = el('div', { class: 'coll-grid' });
  for (const item of COLLECTIBLES) {
    const count = owned[item.id] || 0;
    const has = count > 0;
    const equip = has && item.kind === 'boo' ? equippedArt(item.id) : null;
    const tile = el('button', {
      class: 'coll-tile' + (has ? ' owned' : ' locked') + ' rar-' + item.rarity,
      onclick: () => { sfx.tap(); if (has) showItem(item, count); }
    }, [
      el('div', { class: 'coll-art' + (has ? '' : ' mystery'), html: renderItem(item, { size: 84, equipArt: equip }) }),
      el('div', { class: 'coll-name', text: has ? getDisplayName(item.id) : '???' }),
      count > 1 ? el('div', { class: 'coll-badge', text: 'x' + count }) : null
    ]);
    grid.appendChild(tile);
  }

  // Wardrobe — accessories collected, tap an owned one to put it on someone.
  const wardrobeOwned = ACCESSORIES.filter(a => owned[a.id] > 0).length;
  const wardGrid = el('div', { class: 'coll-grid wardrobe-grid' });
  for (const acc of ACCESSORIES) {
    const has = (owned[acc.id] || 0) > 0;
    const tile = el('button', {
      class: 'coll-tile' + (has ? ' owned' : ' locked') + ' rar-' + acc.rarity,
      onclick: () => { sfx.tap(); if (has) openEquipPicker(acc, { onDone: () => ctx.go('collection') }); }
    }, [
      el('div', { class: 'coll-art' + (has ? '' : ' mystery'), html: renderItem(acc, { size: 84 }) }),
      el('div', { class: 'coll-name', text: has ? acc.name : '???' })
    ]);
    wardGrid.appendChild(tile);
  }
  const wardrobe = el('section', { class: 'wardrobe' }, [
    el('div', { class: 'wardrobe-head' }, [
      el('h3', { text: '👒 Wardrobe' }),
      el('span', { class: 'coll-count small', text: `${wardrobeOwned} of ${ACCESSORIES.length}` })
    ]),
    wardGrid
  ]);

  const scroll = el('div', { class: 'coll-scroll' }, [myCharCard, grid, wardrobe]);
  root.append(header, scroll);
  container.appendChild(root);

  function showItem(item, count) {
    const isBoo = item.kind === 'boo';
    const nick = getDisplayName(item.id);
    const showsNick = isBoo && nick !== officialName(item.id);
    const body = el('div', { class: 'item-detail' }, [
      el('div', { class: 'item-detail-art', html: renderItem(item, { size: 150, equipArt: isBoo ? equippedArt(item.id) : null, cls: item.fx ? '' : 'art-idle' }) }),
      showsNick ? el('div', { class: 'item-detail-official', text: officialName(item.id) }) : null,
      el('div', { class: 'item-detail-rarity', text: RARITY[item.rarity].label + (count > 1 ? ` · you have ${count}` : '') }),
      el('p', { class: 'item-detail-blurb', text: item.blurb })
    ]);
    const buttons = isBoo
      ? [
          { label: '👒 Dress up', value: 'dress' },
          { label: '✏️ Nickname', value: 'rename', kind: 'soft' },
          { label: 'Close', value: 'close', kind: 'soft' }
        ]
      : [{ label: 'Close', value: 'close', kind: 'soft' }];
    dialog({ title: nick, body, buttons, dismissable: true }).then(v => {
      if (v === 'dress') openDressUp(item, { onDone: () => ctx.go('collection') });
      else if (v === 'rename') openRename(item.id, { onDone: () => ctx.go('collection') });
    });
  }

  return { unmount() {} };
}

function backArrow() {
  return `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M15 5l-7 7 7 7" fill="none" stroke="var(--card)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
