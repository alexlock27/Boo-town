// js/accessories.js — accessories + nicknames (spec RUN2 C2, part D).
// Every Boo has one accessory slot; the player's own character wears accessories via
// the creator. Nicknames rename owned Boos (official name kept in small print).

import { el } from './ui.js';
import { getState, mutate } from './state.js';
import { renderItem, renderGuide } from './art.js';
import { BY_ID, ACCESSORIES } from '../data/catalogue.js';
import { guideLine, speakMaybe } from './guide.js';
import { sfx } from './sfx.js';
import { noteQuest } from './quests.js';
import { resolveCustomItem } from './customs.js';

// Display name: nickname if set, else the catalogue name.
function baseName(id) {
  if (BY_ID[id]) return BY_ID[id].name;
  if (id && id.startsWith && id.startsWith('custom:')) { const it = resolveCustomItem(id); if (it) return it.name; }
  return id;
}
export function getDisplayName(id) {
  const s = getState();
  const nick = s && s.nicknames && s.nicknames[id];
  return nick || baseName(id);
}
export function officialName(id) { return baseName(id); }

// The art key of the accessory equipped on a Boo (or null).
export function equippedArt(booId) {
  const s = getState();
  const accId = s && s.equips && s.equips[booId];
  return accId && BY_ID[accId] ? BY_ID[accId].art : null;
}
export function equippedId(booId) {
  const s = getState();
  return (s && s.equips && s.equips[booId]) || null;
}

// Render an owned Boo with whatever it currently wears (convenience).
export function renderOwnedBoo(item, opts = {}) {
  return renderItem(item, { ...opts, equipArt: equippedArt(item.id) });
}

function ownedBooIds() {
  const s = getState();
  return Object.keys(s.inventory).filter(id => s.inventory[id] > 0 && BY_ID[id] && BY_ID[id].kind === 'boo');
}

// DJ Boo won't wear a second pair of headphones (part D).
function refuses(booId, accId) {
  return booId === 'boo_dj' && accId === 'acc_djheadphones';
}

export function equip(booId, accId) {
  mutate(s => { s.equips[booId] = accId; });
  noteQuest('dressUp');   // daily quest: dress up a Boo (RUN3 C4)
}
export function unequip(booId) {
  mutate(s => { delete s.equips[booId]; });
}

// ---- generic chooser overlay --------------------------------------------
function overlay({ title, subtitle }) {
  const ov = el('div', { class: 'overlay acc-overlay' });
  const card = el('div', { class: 'card acc-chooser' });
  if (title) card.appendChild(el('h2', { text: title }));
  if (subtitle) card.appendChild(el('p', { class: 'acc-sub', text: subtitle }));
  const grid = el('div', { class: 'acc-grid' });
  const note = el('p', { class: 'acc-note' });
  card.append(grid, note);
  const close = el('button', { class: 'btn soft', text: 'Done' });
  card.appendChild(close);
  ov.appendChild(card);
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  function dismiss() { ov.classList.remove('show'); setTimeout(() => ov.remove(), 180); }
  close.addEventListener('click', () => { sfx.tap(); dismiss(); });
  ov.addEventListener('click', e => { if (e.target === ov) dismiss(); });
  return { ov, card, grid, note, dismiss };
}

// "Wear it": pick who wears this accessory — the player's character or any owned Boo.
export function openEquipPicker(accItem, { onDone } = {}) {
  const s = getState();
  const { grid, note, dismiss } = overlay({ title: 'Who wears it?', subtitle: accItem.name });

  // the player's own character
  const meTile = el('button', { class: 'acc-target', onclick: () => {
    sfx.tap();
    mutate(st => { st.guide.acc = accItem.id; });
    afterEquip(accItem, 'you'); dismiss(); onDone && onDone();
  } }, [
    el('div', { class: 'acc-target-art', html: renderGuide({ ...s.guide, acc: accItem.id }, { view: 'full', size: 78 }) }),
    el('div', { class: 'acc-target-name', text: 'Me!' })
  ]);
  grid.appendChild(meTile);

  for (const id of ownedBooIds()) {
    const boo = BY_ID[id];
    const tile = el('button', { class: 'acc-target', onclick: () => {
      if (refuses(id, accItem.id)) { note.textContent = guideLine('djRefuse'); speakMaybe(note.textContent); sfx.oops && sfx.oops(); return; }
      sfx.tap();
      equip(id, accItem.id);
      afterEquip(accItem, getDisplayName(id)); dismiss(); onDone && onDone();
    } }, [
      el('div', { class: 'acc-target-art', html: renderItem(boo, { size: 78, equipArt: accItem.art }) }),
      el('div', { class: 'acc-target-name', text: getDisplayName(id) })
    ]);
    grid.appendChild(tile);
  }
}

// "Dress up" (from a Boo's card / a placed Boo): pick an owned accessory, or take off.
export function openDressUp(booItem, { onDone } = {}) {
  const s = getState();
  const owned = ACCESSORIES.filter(a => s.inventory[a.id] > 0);
  const { grid, note, dismiss } = overlay({ title: `Dress up ${getDisplayName(booItem.id)}`, subtitle: owned.length ? 'Pick something to wear' : 'Win accessories from boxes to dress up your Boos!' });

  const current = equippedId(booItem.id);
  // take-off option
  const off = el('button', { class: 'acc-target' + (current ? '' : ' sel'), onclick: () => {
    sfx.tap(); unequip(booItem.id); dismiss(); onDone && onDone();
  } }, [
    el('div', { class: 'acc-target-art', html: renderItem(booItem, { size: 78 }) }),
    el('div', { class: 'acc-target-name', text: 'No accessory' })
  ]);
  grid.appendChild(off);

  for (const acc of owned) {
    const sel = current === acc.id;
    const tile = el('button', { class: 'acc-target' + (sel ? ' sel' : ''), onclick: () => {
      if (refuses(booItem.id, acc.id)) { note.textContent = guideLine('djRefuse'); speakMaybe(note.textContent); return; }
      sfx.tap(); equip(booItem.id, acc.id); afterEquip(acc, getDisplayName(booItem.id)); dismiss(); onDone && onDone();
    } }, [
      el('div', { class: 'acc-target-art', html: renderItem(booItem, { size: 78, equipArt: acc.art }) }),
      el('div', { class: 'acc-target-name', text: acc.name })
    ]);
    grid.appendChild(tile);
  }
}

function afterEquip(accItem, who) {
  const t = guideLine('dressUp');
  speakMaybe(t);
}

// Rename an owned Boo (nickname). Official name stays in small print elsewhere.
export function openRename(booId, { onDone } = {}) {
  const ov = el('div', { class: 'overlay acc-overlay' });
  const card = el('div', { class: 'card acc-chooser rename-card' });
  const s = getState();
  card.appendChild(el('h2', { text: 'Give a nickname' }));
  card.appendChild(el('p', { class: 'acc-sub', text: officialName(booId) }));
  const input = el('input', { class: 'text-input small', type: 'text', maxlength: '14', autocomplete: 'off',
    autocapitalize: 'words', value: getDisplayName(booId), 'aria-label': 'Nickname' });
  const row = el('div', { class: 'creator-btns' }, [
    el('button', { class: 'btn soft', text: 'Reset', onclick: () => {
      sfx.tap(); mutate(st => { delete st.nicknames[booId]; }); dismiss(); onDone && onDone();
    } }),
    el('button', { class: 'btn', text: 'Save', onclick: save })
  ]);
  card.append(input, row);
  ov.appendChild(card);
  document.body.appendChild(ov);
  requestAnimationFrame(() => { ov.classList.add('show'); input.focus(); });
  ov.addEventListener('click', e => { if (e.target === ov) dismiss(); });
  function save() {
    sfx.tap();
    const nn = input.value.trim();
    mutate(st => { if (nn && nn !== officialName(booId)) st.nicknames[booId] = nn; else delete st.nicknames[booId]; });
    dismiss(); onDone && onDone();
  }
  function dismiss() { ov.classList.remove('show'); setTimeout(() => ov.remove(), 180); }
}
