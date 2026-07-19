// js/accessories.js — accessories + nicknames (spec RUN2 C2, part D).
// Every Boo has independent hat / face / feet slots. Costume sets are one collectible
// but equip their authored pieces atomically.

import { el, clear, confetti, REDUCED } from './ui.js';
import { getState, mutate } from './state.js';
import { renderItem, renderGuide } from './art.js';
import { applyRarityFx } from './rarityfx.js';
import { BY_ID, ACCESSORIES } from '../data/catalogue.js';
import { guideLine, speakMaybe } from './guide.js';
import { sfx } from './sfx.js';
import { noteQuest } from './quests.js';
import { noteRequest } from './requests.js';
import { resolveCustomItem } from './customs.js';
import { createDrawer } from './drawer.js';

export const EQUIP_SLOTS = ['hat', 'face', 'feet'];
const slotOf = item => (item && item.slot) || 'hat';
const normaliseWorn = worn => {
  if (!worn) return {};
  if (typeof worn === 'string') return { [worn === 'acc_shades' || worn === 'acc_heartglasses' ? 'face' : 'hat']: worn };
  return { ...worn };
};
const artForId = id => {
  if (!id) return null;
  if (BY_ID[id]) return BY_ID[id].art;
  if (id.startsWith('set:')) return id.split(':').at(-1);
  return id;
};
const ART_LABELS = {
  policecap: 'Police cap', policebadge: 'Police badge',
  builderhelmet: 'Builder helmet', builderhammer: 'Held hammer',
  cheftoque: 'Chef toque', chefspoon: 'Held spoon',
  pithhat: 'Explorer hat', maptan: 'Map & trail tan'
};

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

// Art keys by slot. renderBoo also accepts the old string form for compatibility.
export function equippedArt(booId) {
  const s = getState();
  const worn = normaliseWorn(s && s.equips && s.equips[booId]);
  const art = {};
  for (const slot of EQUIP_SLOTS) if (worn[slot]) art[slot] = artForId(worn[slot]);
  return Object.keys(art).length ? art : null;
}
export function equippedIds(booId) {
  const s = getState();
  return normaliseWorn(s && s.equips && s.equips[booId]);
}
export function equippedId(booId, slot = null) {
  const worn = equippedIds(booId);
  if (slot) return worn[slot] || null;
  return worn.hat || worn.face || worn.feet || null;
}
export function locomotionFor(booId) {
  const feet = BY_ID[equippedIds(booId).feet];
  return feet && feet.locomotion || null;
}
export function costumeFor(booId) {
  const values = Object.values(equippedIds(booId));
  for (const id of values) {
    const match = typeof id === 'string' && id.match(/^set:(acc_set_[^:]+):/);
    if (match) return BY_ID[match[1]] || null;
  }
  return null;
}
export function costumeIdleDelay(random = Math.random) {
  return 20000 + Math.max(0, Math.min(1, random())) * 20000;
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
function previewArt(booId, item) {
  const out = { ...(equippedArt(booId) || {}) };
  if (item.slot === 'set') {
    for (const [slot, art] of Object.entries(item.pieces || {})) out[slot] = art;
  } else out[slotOf(item)] = item.art;
  return out;
}
function putOn(booItem, accItem, onDone) {
  if (accItem.slot !== 'set') {
    equip(booItem.id, accItem.id);
    onDone && onDone();
    return;
  }
  const seen = !!(getState().seen && getState().seen.costumeCeremonies && getState().seen.costumeCeremonies[accItem.id]);
  equipSet(booItem.id, accItem.id);
  if (seen || REDUCED) { onDone && onDone(); return; }
  const transform = el('div', { class: 'costume-transform', role: 'status' }, [
    el('div', { class: 'costume-spark-ring' }),
    el('div', { class: 'costume-transform-art', html: renderItem(booItem, { size: 190, equipArt: equippedArt(booItem.id) }) }),
    el('strong', { text: accItem.name + '!' })
  ]);
  document.body.appendChild(transform);
  sfx.fanfare();
  if (!REDUCED) confetti({ count: 42, power: .75 });
  setTimeout(() => { transform.remove(); onDone && onDone(); }, 600);
}

export function equip(booId, accId) {
  const item = BY_ID[accId];
  if (!item) return false;
  if (slotOf(item) === 'set') return equipSet(booId, accId);
  mutate(s => {
    const worn = normaliseWorn(s.equips[booId]);
    worn[slotOf(item)] = accId;
    s.equips[booId] = worn;
  });
  noteQuest('dressUp');   // daily quest: dress up a Boo (RUN3 C4)
  noteRequest('dressUp'); // occasional request (RUN3 C8)
  return true;
}
export function equipSet(booId, setId) {
  const set = BY_ID[setId];
  if (!set || set.slot !== 'set' || !set.pieces) return false;
  mutate(s => {
    const worn = normaliseWorn(s.equips[booId]);
    for (const [slot, art] of Object.entries(set.pieces)) worn[slot] = `set:${setId}:${art}`;
    s.equips[booId] = worn;
    s.seen = s.seen || {};
    s.seen.costumeCeremonies = s.seen.costumeCeremonies || {};
    s.seen.costumeCeremonies[setId] = true;
  });
  noteQuest('dressUp');
  noteRequest('dressUp');
  return true;
}
export function unequip(booId, slot = null) {
  mutate(s => {
    if (!slot) { delete s.equips[booId]; return; }
    const worn = normaliseWorn(s.equips[booId]);
    delete worn[slot];
    if (Object.keys(worn).length) s.equips[booId] = worn;
    else delete s.equips[booId];
  });
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
  if (accItem.slot !== 'set') {
    const meTile = el('button', { class: 'acc-target', onclick: () => {
      sfx.tap();
      mutate(st => { st.guide.acc = accItem.id; });
      afterEquip(accItem, 'you'); dismiss(); onDone && onDone();
    } }, [
      el('div', { class: 'acc-target-art', html: renderGuide({ ...s.guide, acc: accItem.id }, { view: 'full', size: 78 }) }),
      el('div', { class: 'acc-target-name', text: 'Me!' })
    ]);
    grid.appendChild(meTile);
  }

  for (const id of ownedBooIds()) {
    const boo = BY_ID[id];
    const tile = el('button', { class: 'acc-target', onclick: () => {
      if (refuses(id, accItem.id)) { note.textContent = guideLine('djRefuse'); speakMaybe(note.textContent); sfx.oops && sfx.oops(); return; }
      sfx.tap();
      putOn(boo, accItem, () => { afterEquip(accItem, getDisplayName(id)); dismiss(); onDone && onDone(); });
    } }, [
      el('div', { class: 'acc-target-art', html: renderItem(boo, { size: 78, equipArt: previewArt(id, accItem) }) }),
      el('div', { class: 'acc-target-name', text: getDisplayName(id) })
    ]);
    grid.appendChild(tile);
  }
}

// "Dress up" (from a Boo's card / a placed Boo): pick an owned accessory, or take off.
export function openDressUp(booItem, { onDone } = {}) {
  const s = getState();
  const owned = ACCESSORIES.filter(a => s.inventory[a.id] > 0);
  const shiny = ((s.shinies && s.shinies[booItem.id]) || 0) > 0;
  const ov = el('div', { class: 'overlay acc-overlay' });
  const card = el('div', { class: 'card acc-chooser acc-dress-card' });
  const title = el('h2', { text: `Dress up ${getDisplayName(booItem.id)}` });
  const preview = el('div', { class: 'acc-fit-preview' });
  const chips = el('div', { class: 'acc-fit-chips' });
  const note = el('p', { class: 'acc-note', text: owned.length ? 'Mix a hat, face and feet.' : 'Win accessories from boxes to dress up your Boos!' });
  const close = el('button', { class: 'btn soft acc-dress-done', text: 'Done' });
  const nodes = Object.fromEntries(['hat', 'face', 'feet', 'set'].map(slot => [slot, el('div', { class: 'acc-drawer-grid', dataset: { slot } })]));
  const drawer = createDrawer({
    tabs: [
      { id: 'hat', label: 'Hats', node: nodes.hat },
      { id: 'face', label: 'Face', node: nodes.face },
      { id: 'feet', label: 'Feet', node: nodes.feet },
      { id: 'set', label: 'Sets', node: nodes.set }
    ],
    ariaLabel: `${getDisplayName(booItem.id)} wardrobe`
  });
  drawer.setCurrent('<span class="bd-cur-ic">🎀</span><span class="bd-cur-label">Open the wardrobe</span>');
  card.append(title, preview, chips, note, drawer.root, close);
  ov.appendChild(card);
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  function dismiss() {
    ov.classList.remove('show');
    setTimeout(() => ov.remove(), 180);
    onDone && onDone();
  }
  close.onclick = () => { sfx.tap(); dismiss(); };
  ov.addEventListener('click', e => { if (e.target === ov) dismiss(); });

  function refresh() {
    preview.innerHTML = renderItem(booItem, { size: 180, equipArt: equippedArt(booItem.id) });
    applyRarityFx(preview, booItem, { context: 'calm', shiny });
    clear(chips);
    const worn = equippedIds(booItem.id);
    for (const slot of EQUIP_SLOTS) {
      const id = worn[slot];
      const artKey = artForId(id);
      const label = id ? (BY_ID[id] ? BY_ID[id].name : (ART_LABELS[artKey] || artKey.replace(/([a-z])([A-Z])/g, '$1 $2'))) : `No ${slot}`;
      chips.appendChild(el('button', {
        class: `acc-fit-chip${id ? ' on' : ''}`,
        disabled: !id,
        text: `${slot === 'hat' ? '🎩' : slot === 'face' ? '✨' : '🛼'} ${label}${id ? ' ×' : ''}`,
        onclick: () => { sfx.tap(); unequip(booItem.id, slot); refresh(); }
      }));
    }
    for (const slot of ['hat', 'face', 'feet', 'set']) {
      clear(nodes[slot]);
      const here = owned.filter(item => slotOf(item) === slot);
      if (!here.length) nodes[slot].appendChild(el('p', { class: 'acc-empty-tab', text: `No ${slot === 'set' ? 'costume sets' : slot + ' items'} yet.` }));
      for (const acc of here) {
        const selected = acc.slot === 'set'
          ? Object.values(worn).some(id => typeof id === 'string' && id.startsWith(`set:${acc.id}:`))
          : worn[slot] === acc.id;
        const tile = el('button', {
          class: `acc-drawer-item${selected ? ' sel' : ''}`,
          onclick: () => {
            if (refuses(booItem.id, acc.id)) { note.textContent = guideLine('djRefuse'); speakMaybe(note.textContent); return; }
            sfx.tap();
            putOn(booItem, acc, () => { afterEquip(acc, getDisplayName(booItem.id)); refresh(); });
          }
        }, [
          el('div', { class: 'acc-drawer-art', html: renderItem(booItem, { size: 74, equipArt: previewArt(booItem.id, acc) }) }),
          el('span', { text: acc.name })
        ]);
        nodes[slot].appendChild(tile);
      }
    }
  }
  refresh();
  if (typeof window !== 'undefined') window.__dressup = {
    worn: () => equippedIds(booItem.id),
    equip: id => { const item = BY_ID[id]; if (item) putOn(booItem, item, refresh); },
    unequip: slot => { unequip(booItem.id, slot); refresh(); },
    tab: id => drawer.showTab(id),
    open: () => drawer.open(),
    close: dismiss
  };
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
