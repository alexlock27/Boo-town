// js/speller.js — the shared tile speller (used by Spell Boo and the Golden Round).
// Renders letter slots + a shuffled tray (word letters + 3 decoys) into mountEl.
// Calls onCorrect once spelled and onWrongCheck on each failed auto-check.
// hintNextLetter() reveals the next slot; isLocked() reports mid-animation lock.

import { el, wobble, sparkleAt } from './ui.js';
import { sfx } from './sfx.js';
import { decoysFor } from '../data/spelling.js';

const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function makeSpeller(mountEl, word, { onCorrect, onWrongCheck } = {}) {
  const slotsWrap = el('div', { class: 'slots-wrap' });
  const trayWrap = el('div', { class: 'tray-wrap' });
  mountEl.append(slotsWrap, trayWrap);
  let locked = false, finished = false;
  const slots = [], tiles = [];
  slotsWrap.dataset.word = word;
  for (let i = 0; i < word.length; i++) {
    const sl = el('div', { class: 'slot', dataset: { i: String(i) }, onclick: () => returnTile(i) });
    slots.push(sl); slotsWrap.appendChild(sl);
  }
  const letters = word.split('').concat(decoysFor(word)); shuffle(letters);
  letters.forEach((letter, i) => {
    const node = el('button', { class: 'tile', text: letter });
    const t = { letter, id: 'T' + i, slot: null, locked: false, node };
    node.onclick = () => placeTile(t);
    trayWrap.appendChild(node); tiles.push(t);
  });
  const firstEmpty = () => slots.findIndex(s => !s.dataset.tile);
  function placeTile(t) {
    if (locked || finished || t.slot !== null) return;
    const i = firstEmpty(); if (i < 0) return;
    t.slot = i; slots[i].dataset.tile = t.id; slots[i].textContent = t.letter; slots[i].classList.add('filled');
    t.node.style.visibility = 'hidden'; sfx.tap();
    if (firstEmpty() < 0) setTimeout(check, 150);
  }
  function returnTile(i) {
    if (locked || finished) return;
    const id = slots[i].dataset.tile; if (!id) return;
    const t = tiles.find(x => x.id === id); if (!t || t.locked) return;
    t.slot = null; delete slots[i].dataset.tile; slots[i].textContent = ''; slots[i].classList.remove('filled');
    t.node.style.visibility = 'visible'; sfx.tap();
  }
  function check() {
    const attempt = slots.map(s => s.textContent).join('');
    if (attempt === word) return done();
    onWrongCheck && onWrongCheck(); sfx.oops(); locked = true;
    slots.forEach((sl, i) => {
      if (sl.textContent !== word[i]) {
        const id = sl.dataset.tile; const t = tiles.find(x => x.id === id);
        wobble(sl);
        setTimeout(() => { if (t && !t.locked) { t.slot = null; delete sl.dataset.tile; sl.textContent = ''; sl.classList.remove('filled'); t.node.style.visibility = 'visible'; } }, 400);
      }
    });
    setTimeout(() => { locked = false; }, 450);
  }
  function done() {
    finished = true; locked = true; sfx.correct();
    const r = slotsWrap.getBoundingClientRect();
    sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
    slotsWrap.classList.add('spelled');
    onCorrect && onCorrect();
  }
  function hintNextLetter() {
    if (locked || finished) return false;
    const i = firstEmpty(); if (i < 0) return false;
    const need = word[i];
    const t = tiles.find(x => x.slot === null && x.letter === need && !x.locked);
    if (t) { t.slot = i; t.node.style.visibility = 'hidden'; }
    slots[i].dataset.tile = t ? t.id : 'hint'; slots[i].textContent = need; slots[i].classList.add('filled', 'hinted');
    if (t) t.locked = true;
    if (firstEmpty() < 0) setTimeout(check, 200);
    return true;
  }
  return { slotsWrap, trayWrap, hintNextLetter, isLocked: () => locked || finished };
}

// Headless helper for tests: fill a speller's slots to spell `w`.
export function typeInto(area, w) {
  const tray = [...area.querySelectorAll('.tile')];
  for (const ch of w.split('')) { const t = tray.find(n => n.textContent === ch && n.style.visibility !== 'hidden'); if (t) t.click(); }
}
