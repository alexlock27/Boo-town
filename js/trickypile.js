// js/trickypile.js — the Tricky Pile (RUN3 C2).
// During any round a small Puzzled Boo appears at the side and collects up to 3 missed
// items. On the results screen a Rescue step offers them back one at a time, untimed,
// hints free, not affecting the round's stars; each rescue sparkles and adds +1 meter.
// Unrescued items persist (save.trickyPile) and seed the next Smart Mix round.

import { el, sparkleAt } from './ui.js';
import { getState, mutate } from './state.js';
import { sfx } from './sfx.js';
import { addMeterPoints } from './rewards.js';

export const PUZZLED_CAP = 3;
const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Build a re-askable recognition item from a word miss (correct spelling vs 2 misspellings).
export function wordMiss(word, game = 'spellboo') {
  return { id: 'w:' + word, game, prompt: 'Which one is spelled correctly?', options: shuffle([word, ...misspellings(word)]), answer: word };
}
// Choice-type miss (maths facts, arcade, twins): options already exist.
export function choiceMiss({ id, game, prompt, options, answer }) {
  return { id, game, prompt, options: options.slice(0, 3), answer };
}

function misspellings(word) {
  const out = new Set();
  const w = word.split('');
  // swap two adjacent letters
  for (let i = 0; i < w.length - 1 && out.size < 3; i++) {
    if (w[i] !== w[i + 1]) { const c = w.slice(); [c[i], c[i + 1]] = [c[i + 1], c[i]]; const s = c.join(''); if (s !== word) out.add(s); }
  }
  // double a random letter
  const j = 1 + rand(Math.max(1, word.length - 1));
  out.add(word.slice(0, j) + word[j - 1] + word.slice(j));
  return shuffle([...out]).slice(0, 2);
}

// A round-scoped collector: a Puzzled Boo holding up to PUZZLED_CAP missed items.
export function createTrickyCollector(area) {
  const items = [];
  const boo = el('div', { class: 'puzzled-boo', style: { display: 'none' }, 'aria-hidden': 'true' }, [
    el('div', { class: 'pb-face', html: puzzledFace() }),
    el('div', { class: 'pb-count', text: '0' })
  ]);
  if (area) area.appendChild(boo);
  return {
    node: boo,
    add(item) {
      if (!item || !item.id || items.length >= PUZZLED_CAP) return;
      if (items.some(x => x.id === item.id)) return;   // one per identity per round
      items.push(item);
      boo.style.display = '';
      boo.querySelector('.pb-count').textContent = String(items.length);
      boo.classList.remove('pop'); void boo.offsetWidth; boo.classList.add('pop');
    },
    items: () => items.slice()
  };
}

// Persist unrescued item ids so the next Smart Mix round can prioritise them.
export function persistUnrescued(ids) {
  if (!ids || !ids.length) return;
  mutate(s => {
    s.trickyPile = s.trickyPile || [];
    for (const id of ids) if (!s.trickyPile.includes(id)) s.trickyPile.push(id);
    if (s.trickyPile.length > 24) s.trickyPile = s.trickyPile.slice(-24);
  });
}
export function clearPersisted(ids) {
  mutate(s => { s.trickyPile = (s.trickyPile || []).filter(id => !ids.includes(id)); });
}
export function persistedPile() { const s = getState(); return (s && s.trickyPile) || []; }

// The Rescue step, rendered into `container`. Offers items one at a time.
// onGift() is called if a rescue's +1 meter banks a box. Calls onDone() when finished.
export function mountRescue(container, items, { onGift, onDone, onRescue } = {}) {
  const pending = items.slice();
  const rescued = [];
  const panel = el('div', { class: 'rescue-panel' });
  container.appendChild(panel);
  render();

  function render() {
    panel.innerHTML = '';
    if (!pending.length) {
      // all done; persist any that were skipped (none here) and leave
      const unrescuedIds = items.map(i => i.id).filter(id => !rescued.includes(id));
      persistUnrescued(unrescuedIds);
      clearPersisted(rescued);
      panel.appendChild(el('div', { class: 'rescue-done', text: rescued.length ? `Rescued ${rescued.length}! +${rescued.length} ⭐` : '' }));
      onDone && onDone(rescued.length);
      return;
    }
    const item = pending[0];
    panel.append(
      el('div', { class: 'rescue-head' }, [
        el('div', { class: 'pb-face small', html: puzzledFace() }),
        el('div', { class: 'rescue-title', text: 'Rescue the Tricky Pile!' }),
        el('div', { class: 'rescue-count', text: `${rescued.length + pending.length - 1} more` })
      ]),
      el('div', { class: 'rescue-prompt', text: item.prompt })
    );
    const opts = el('div', { class: 'rescue-options' });
    shuffle(item.options.slice()).forEach(o => {
      opts.appendChild(el('button', { class: 'btn rescue-opt', text: o, onclick: () => answer(o, item) }));
    });
    panel.appendChild(opts);
    // a free hint: dim one wrong option
    panel.appendChild(el('button', { class: 'btn soft rescue-skip', text: 'Skip', onclick: () => { pending.shift(); render(); } }));
  }

  function answer(choice, item) {
    if (choice === item.answer) {
      sfx.correct();
      rescued.push(item.id);
      const r = panel.getBoundingClientRect();
      sparkleAt(r.left + r.width / 2, r.top + 40);
      const banked = addMeterPoints(1);
      onRescue && onRescue();
      if (banked.boxesEarned > 0 && onGift) onGift();
      pending.shift();
      render();
    } else {
      sfx.oops();
      const btn = [...panel.querySelectorAll('.rescue-opt')].find(b => b.textContent === choice);
      if (btn) { btn.classList.add('wrong'); setTimeout(() => btn.classList.remove('wrong'), 400); }
    }
  }

  // test hook
  if (typeof window !== 'undefined') window.__rescue = {
    remaining: () => pending.length,
    answerCorrect: () => { const it = pending[0]; if (it) answer(it.answer, it); },
    skip: () => { if (pending.length) { pending.shift(); render(); } },
    rescuedCount: () => rescued.length
  };
}

function puzzledFace() {
  return `<svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
    <ellipse cx="32" cy="36" rx="22" ry="20" fill="#C6A9F0" stroke="#2A1B4E" stroke-width="3"/>
    <ellipse cx="15" cy="20" rx="7" ry="10" fill="#C6A9F0" stroke="#2A1B4E" stroke-width="3"/>
    <ellipse cx="49" cy="20" rx="7" ry="10" fill="#C6A9F0" stroke="#2A1B4E" stroke-width="3"/>
    <circle cx="25" cy="34" r="4.5" fill="#2A1B4E"/><circle cx="40" cy="34" r="4.5" fill="#2A1B4E"/>
    <circle cx="26.5" cy="32.5" r="1.4" fill="#fff"/><circle cx="41.5" cy="32.5" r="1.4" fill="#fff"/>
    <path d="M27 46 q5 -4 10 0" fill="none" stroke="#2A1B4E" stroke-width="3" stroke-linecap="round"/>
    <text x="49" y="16" font-size="16" fill="#FFC93C" font-family="Fredoka, sans-serif" font-weight="700">?</text>
  </svg>`;
}
