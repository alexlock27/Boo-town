// js/choreographer.js — the Dance Choreographer (RUN3 C8). Tap a placed Dance Stage,
// choose Choreograph, drag up to 8 moves into a sequence strip, preview, and save. Boos on
// that stage then perform the routine on loop. Each stage keeps its own routine.

import { el } from './ui.js';
import { getState, mutate } from './state.js';
import { sfx } from './sfx.js';
import { renderBoo } from './art.js';
import { stampJournal } from './quests.js';

export const MOVES = [
  { id: 'bounce', name: 'Bounce', emoji: '⬆️' },
  { id: 'spin', name: 'Spin', emoji: '🌀' },
  { id: 'wiggle', name: 'Wiggle', emoji: '〰️' },
  { id: 'jump', name: 'Jump', emoji: '🦘' },
  { id: 'clap', name: 'Clap', emoji: '👏' },
  { id: 'slide', name: 'Slide', emoji: '↔️' },
  { id: 'starpose', name: 'Star pose', emoji: '⭐' },
  { id: 'freeze', name: 'Freeze', emoji: '🧊' }
];
export const MOVE_IDS = MOVES.map(m => m.id);
export const MAX_MOVES = 8;
export const STEP_MS = 700;

export function stageKeyOf(place) { return `${place.zone}:${place.x}`; }
export function routineFor(place) { const s = getState(); return (s.routines && s.routines[stageKeyOf(place)]) || null; }

// Apply one move to a Boo's svg for a beat (removes old move-* classes, adds the new one).
export function applyMove(svg, moveId) {
  if (!svg) return;
  MOVE_IDS.forEach(m => svg.classList.remove('move-' + m));
  svg.classList.remove('art-dance');
  // reflow so the animation restarts each beat
  void svg.offsetWidth;
  svg.classList.add('move-' + moveId);
}

// The choreographer overlay for a stage. onDone() fires after a save.
export function openChoreographer(place, { onDone } = {}) {
  const key = stageKeyOf(place);
  const s = getState();
  let seq = ((s.routines && s.routines[key]) || []).slice();

  const ov = el('div', { class: 'overlay choreo-overlay', onclick: (e) => { if (e.target === ov) close(); } });

  const preview = el('div', { class: 'choreo-preview', html: renderBoo({ species: 'sunny', colors: { body: 'gold' }, name: 'Dancer' }, { size: 120 }) });
  const strip = el('div', { class: 'choreo-strip' });
  const palette = el('div', { class: 'choreo-palette' });
  const msg = el('div', { class: 'choreo-msg' });

  MOVES.forEach(m => palette.appendChild(el('button', { class: 'choreo-move', onclick: () => addMove(m.id) }, [el('span', { class: 'cm-emoji', text: m.emoji }), el('span', { class: 'cm-name', text: m.name })])));

  function renderStrip() {
    strip.innerHTML = '';
    if (!seq.length) { strip.appendChild(el('span', { class: 'choreo-hint', text: 'Tap moves below to build a dance (up to 8). Tap one here to remove it.' })); return; }
    seq.forEach((mid, i) => { const m = MOVES.find(x => x.id === mid); strip.appendChild(el('button', { class: 'choreo-slot', onclick: () => { seq.splice(i, 1); renderStrip(); } }, [el('span', { text: m.emoji }), el('span', { class: 'cs-num', text: String(i + 1) })])); });
  }
  function addMove(mid) { if (seq.length >= MAX_MOVES) { msg.textContent = 'That\'s 8 moves — the most!'; return; } msg.textContent = ''; seq.push(mid); sfx.tap(); renderStrip(); }
  renderStrip();

  // preview loop
  let idx = 0, timer = null;
  const svg = () => preview.querySelector('svg');
  function tick() { if (seq.length) { applyMove(svg(), seq[idx % seq.length]); idx++; } timer = setTimeout(tick, STEP_MS); }
  tick();

  function save() {
    mutate(st => { st.routines = st.routines || {}; if (seq.length) st.routines[key] = seq.slice(); else delete st.routines[key]; });
    if (seq.length) stampJournal('firstRoutine');
    sfx.star(); msg.textContent = seq.length ? 'Routine saved! Your Boos will dance it. 💃' : 'Routine cleared.';
    onDone && onDone();
  }
  function close() { if (timer) clearTimeout(timer); ov.remove(); }

  ov.appendChild(el('div', { class: 'card choreo-card' }, [
    el('h3', { text: '💃 Choreograph a dance' }),
    preview,
    el('p', { class: 'choreo-label', text: 'Your routine:' }), strip,
    el('p', { class: 'choreo-label', text: 'Moves:' }), palette,
    msg,
    el('div', { class: 'choreo-actions' }, [
      el('button', { class: 'btn', text: '💾 Save routine', onclick: save }),
      el('button', { class: 'btn soft', text: 'Done', onclick: close })
    ])
  ]));
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  // test hook
  if (typeof window !== 'undefined') window.__choreo = { add: (mid) => addMove(mid), seq: () => seq.slice(), save, close };
  return { close };
}
