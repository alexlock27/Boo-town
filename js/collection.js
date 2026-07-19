// js/collection.js — the collection shelf (spec §5.6) + wardrobe (RUN2 C2).

import { el, dialog, backControl } from './ui.js';
import { getState } from './state.js';
import { renderItem, renderGuide } from './art.js';
import { applyRarityFx } from './rarityfx.js';
import { COLLECTIBLES, ACCESSORIES, TOTAL_ITEMS, RARITY, BIRTHDAY_BOOS } from '../data/catalogue.js';
import { equippedArt, openDressUp, openRename, openEquipPicker, getDisplayName, officialName } from './accessories.js';
import { sfx, music } from './sfx.js';
import { journalEntries } from './quests.js';
import { renderTrophyRoom } from './trophies.js';
import { ownedCustomItems } from './customs.js';
import { micEnabled, openVoiceRecorder } from './voices.js';
import { contentTier } from './content.js';
import { openCare, renderCareSummary, heartBadge, isBestFriend } from './care.js';

export function mount(container, params, ctx) {
  const s = getState();
  music.play('calm');
  const owned = s.inventory;
  const foundCount = COLLECTIBLES.filter(it => owned[it.id] > 0).length;
  const shinyTotal = Object.values(s.shinies || {}).reduce((a, b) => a + b, 0);   // RUN4 C8

  const root = el('div', { class: 'collection' });

  const header = el('header', { class: 'coll-header' }, [
    backControl(() => ctx.go((params && params.from) || 'hub')),   // RUN10 P4: return to whoever sent us here (e.g. the Gallery)
    el('h2', { text: 'My Collection' }),
    el('span', { class: 'coll-count', text: `${foundCount} of ${TOTAL_ITEMS} found` }),
    shinyTotal > 0 ? el('span', { class: 'coll-shiny-count', text: `✨ ${shinyTotal} shin${shinyTotal === 1 ? 'y' : 'ies'}` }) : null
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

  const SEASON = { summer: { icon: '☀️', hint: 'arrives in summer…' }, spooky: { icon: '🎃', hint: 'arrives at Halloween…' }, winter: { icon: '❄️', hint: 'arrives in winter…' } };
  const grid = el('div', { class: 'coll-grid' });
  for (const item of COLLECTIBLES) {
    const count = owned[item.id] || 0;
    const has = count > 0;
    const equip = has && item.kind === 'boo' ? equippedArt(item.id) : null;
    const seas = !has && item.season ? SEASON[item.season] : null;
    const shinyCopies = (s.shinies && s.shinies[item.id]) || 0;   // per-copy shinies (RUN4 C8)
    const collArt = el('div', { class: 'coll-art' + (has ? '' : ' mystery'), html: renderItem(item, { size: 84, equipArt: equip }) });
    const tile = el('button', {
      class: 'coll-tile' + (has ? ' owned' : ' locked') + ' rar-' + item.rarity + (has && shinyCopies > 0 ? ' has-shiny' : ''),
      onclick: () => { sfx.tap(); if (has) showItem(item, count); }
    }, [
      collArt,
      el('div', { class: 'coll-name', text: has ? getDisplayName(item.id) + (item.kind === 'boo' ? heartBadge(item.id) : '') : (seas ? seas.hint : '???') }),
      count > 1 ? el('div', { class: 'coll-badge', text: 'x' + count }) : null,
      has && shinyCopies > 0 ? el('div', { class: 'shiny-badge', text: shinyCopies > 1 ? `✨x${shinyCopies}` : '✨' }) : null,
      seas ? el('div', { class: 'coll-season', text: seas.icon }) : null
    ]);
    grid.appendChild(tile);
    // shared rarity VFX (C2): calm versions in the grid
    if (has) applyRarityFx(collArt, item, { context: 'calm', shiny: shinyCopies > 0 });
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

  // ---- My Boos: custom Boos she built and won (RUN3 C6) ----
  const customs = ownedCustomItems();
  let customsSection = null;
  if (customs.length) {
    const cgrid = el('div', { class: 'coll-grid customs-grid' });
    for (const item of customs) {
      cgrid.appendChild(el('button', { class: 'coll-tile owned rar-custom', onclick: () => { sfx.tap(); showItem(item, 1); } }, [
        el('div', { class: 'coll-art', html: renderItem(item, { size: 84, cls: 'art-idle' }) }),
        el('div', { class: 'coll-name', text: item.name })
      ]));
    }
    customsSection = el('section', { class: 'my-boos' }, [
      el('div', { class: 'wardrobe-head' }, [el('h3', { text: '🧩 Boos you built' }), el('span', { class: 'coll-count small', text: `${customs.length}` })]),
      cgrid
    ]);
  }

  const birthdayOwned = BIRTHDAY_BOOS.filter(item => owned[item.id] > 0);
  let birthdaySection = null;
  if (birthdayOwned.length) {
    const bgrid = el('div', { class:'coll-grid birthday-boos-grid' });
    birthdayOwned.forEach(item => {
      const art = el('div', { class:'coll-art birthday-coll-art', html:renderItem(item,{size:94,equipArt:equippedArt(item.id)}) });
      applyRarityFx(art, item, {context:'calm'});
      bgrid.appendChild(el('button', { class:'coll-tile owned rar-birthday', onclick:() => { sfx.tap(); showItem(item,1); } }, [
        art, el('div',{class:'coll-name',text:getDisplayName(item.id)}), el('div',{class:'birthday-11-badge',text:'11'})
      ]));
    });
    birthdaySection = el('section', {class:'birthday-boos-section'}, [
      el('div',{class:'wardrobe-head'},[el('h3',{text:'🎉 Birthday Boos'}),el('span',{class:'coll-count small',text:`${birthdayOwned.length} of 2`})]),
      bgrid
    ]);
  }

  const scroll = el('div', { class: 'coll-scroll' }, [myCharCard, grid, ...(birthdaySection ? [birthdaySection] : []), ...(customsSection ? [customsSection] : []), wardrobe]);

  // ---- Journal tab (RUN3 C4): a scrapbook of dated stamp stickers on flippable pages ----
  const journalView = el('div', { class: 'coll-scroll journal-view', style: { display: 'none' } });
  const PER_PAGE = 6;
  let jpage = 0;
  function renderJournal() {
    journalView.innerHTML = '';
    const entries = journalEntries();
    if (!entries.length) {
      journalView.appendChild(el('div', { class: 'journal-empty' }, [
        el('div', { class: 'je-big', text: '📖' }),
        el('p', { text: 'Your Boo Journal is ready! Win rare Boos, 3-star games and unlock places to fill it with stickers.' })
      ]));
      return;
    }
    const pages = Math.ceil(entries.length / PER_PAGE);
    jpage = Math.max(0, Math.min(jpage, pages - 1));
    const slice = entries.slice(jpage * PER_PAGE, jpage * PER_PAGE + PER_PAGE);
    const page = el('div', { class: 'journal-page' }, slice.map(e => el('div', { class: 'journal-stamp' }, [
      el('div', { class: 'js-icon', text: e.icon }),
      el('div', { class: 'js-label', text: e.label }),
      el('div', { class: 'js-date', text: e.date })
    ])));
    const nav = el('div', { class: 'journal-nav' }, [
      el('button', { class: 'btn soft', text: '‹', disabled: jpage === 0 ? '' : undefined, onclick: () => { if (jpage > 0) { jpage--; sfx.tap(); renderJournal(); } } }),
      el('span', { class: 'journal-page-no', text: `Page ${jpage + 1} of ${pages} · ${entries.length} sticker${entries.length === 1 ? '' : 's'}` }),
      el('button', { class: 'btn soft', text: '›', disabled: jpage >= pages - 1 ? '' : undefined, onclick: () => { if (jpage < pages - 1) { jpage++; sfx.tap(); renderJournal(); } } })
    ]);
    journalView.append(page, nav);
  }
  renderJournal();

  // ---- Trophies tab (RUN4 C4): the warm wooden cabinet ----
  const trophyView = el('div', { class: 'coll-scroll trophy-view', style: { display: 'none' } });
  let trophyMounted = false;

  // Toddler mode (RUN5 C7): the Trophies tab is hidden — the shared universe stays,
  // but the ledgered challenge furniture waits until she's older.
  const toddler = contentTier() === 'toddler';
  const tabs = el('div', { class: 'coll-tabs' }, [
    el('button', { class: 'coll-tab sel', text: '🧸 Boos', onclick: (e) => switchTab('coll', e.currentTarget) }),
    toddler ? null : el('button', { class: 'coll-tab', text: '🏆 Trophies', onclick: (e) => switchTab('trophies', e.currentTarget) }),
    el('button', { class: 'coll-tab', text: '📖 Journal', onclick: (e) => switchTab('journal', e.currentTarget) })
  ]);
  function switchTab(which, btn) {
    sfx.tap();
    tabs.querySelectorAll('.coll-tab').forEach(t => t.classList.remove('sel'));
    btn.classList.add('sel');
    scroll.style.display = which === 'coll' ? '' : 'none';
    journalView.style.display = which === 'journal' ? '' : 'none';
    trophyView.style.display = which === 'trophies' ? '' : 'none';
    if (which === 'journal') renderJournal();
    if (which === 'trophies' && !trophyMounted) { trophyMounted = true; renderTrophyRoom(trophyView); }
  }

  root.append(header, tabs, scroll, trophyView, journalView);
  container.appendChild(root);

  function showItem(item, count) {
    const isBoo = item.kind === 'boo';
    const nick = getDisplayName(item.id);
    const showsNick = isBoo && nick !== officialName(item.id);
    const detailArt = el('div', { class: 'item-detail-art' + (isBoo && isBestFriend(item.id) ? ' care-bff' : ''), html: renderItem(item, { size: 150, equipArt: isBoo ? equippedArt(item.id) : null, cls: item.fx ? '' : 'art-idle' }) });
    const careBox = isBoo ? el('div', { class: 'collection-care-box' }) : null;
    if (careBox) {
      const refreshCare = () => renderCareSummary(careBox, item, action => openCare(item, { startAction: action, onDone: refreshCare }));
      refreshCare();
    }
    const body = el('div', { class: 'item-detail' }, [
      detailArt,
      showsNick ? el('div', { class: 'item-detail-official', text: officialName(item.id) }) : null,
      el('div', { class: 'item-detail-rarity', text: (RARITY[item.rarity] || { label: 'Your very own Boo!' }).label + (count > 1 ? ` · you have ${count}` : '') }),
      el('p', { class: 'item-detail-blurb', text: item.blurb }),
      careBox
    ]);
    // shared rarity VFX (C2): the FULL effect on the focused card
    applyRarityFx(detailArt, item, { context: 'full', shiny: ((s.shinies && s.shinies[item.id]) || 0) > 0 });
    const buttons = isBoo
      ? [
          { label: '👒 Dress up', value: 'dress' },
          ...(micEnabled() ? [{ label: '🎤 Give a voice', value: 'voice', kind: 'soft' }] : []),
          { label: '✏️ Nickname', value: 'rename', kind: 'soft' },
          { label: 'Close', value: 'close', kind: 'soft' }
        ]
      : [{ label: 'Close', value: 'close', kind: 'soft' }];
    dialog({ title: nick + (isBoo ? heartBadge(item.id) : ''), body, buttons, dismissable: true }).then(v => {
      if (v === 'dress') openDressUp(item, { onDone: () => ctx.go('collection') });
      else if (v === 'rename') openRename(item.id, { onDone: () => ctx.go('collection') });
      else if (v === 'voice') openVoiceRecorder(item.id, nick);
    });
  }

  // Arriving from a specific figure (RUN10 P4: the Gallery) opens straight to its card.
  if (params && params.openItem) {
    const wanted = params.openItem;
    const item = wanted.startsWith('custom:') ? ownedCustomItems().find(c => c.id === wanted) : COLLECTIBLES.find(it => it.id === wanted);
    if (item && (owned[wanted] || 0) > 0) setTimeout(() => showItem(item, owned[wanted] || 1), 50);
  }

  return { unmount() {} };
}
