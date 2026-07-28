// js/welcometour.js — "How Boo Town works" (RUN18B Y16).
//
// Three cards, once, in the hub's OWN flow. Not a modal, not a layer: the hub is the only
// thing that builds it, so it can never arrive over a game or over her results — the same
// structural guarantee What's New has (RUN17 X4), for the same reason.
//
// It is skippable at every step, and both "seen" and "skipped" are committed IMMEDIATELY
// rather than on the save's usual two-second debounce: a child who taps Skip and then closes
// the tab must not be shown the tour again tomorrow as if she had never answered.
//
// Existing saves see it once too — the flag simply is not there yet, which is the whole
// mechanism. Nothing else about an old save is touched.

import { el, clear } from './ui.js';
import { getState, mutate, commit } from './state.js';
import { sfx } from './sfx.js';
import { renderGuide } from './art.js';
import { speakMaybe } from './guide.js';

export const TOUR_FLAG = 'welcomeTour';

// Copy is LAW (RUN18B Y16) — verbatim, in this order.
export const TOUR_STEPS = [
  { text: 'Welcome to Boo Town! Play games, earn stars, and build a town full of Boos.', button: 'Next' },
  { text: 'Stars come in five colours — Maths, Word, Puzzle, Creative and Lesson. Each shop shelf likes its own colour best!', button: 'Next' },
  { text: 'Stars fill your meter. A full meter earns a mystery box — and boxes bring new Boos home!', button: 'Show me the games!' }
];

export function tourSeen(state = getState()) { return !!(state && state.seen && state.seen[TOUR_FLAG]); }
export function markTourSeen() { mutate(st => { st.seen = st.seen || {}; st.seen[TOUR_FLAG] = true; }); commit(); }
// The grown-ups' replay. Clearing the flag is all it takes: the hub builds the tour whenever
// the flag is absent, so the next hub she sees carries it.
export function replayTour() { mutate(st => { st.seen = st.seen || {}; delete st.seen[TOUR_FLAG]; }); commit(); }

// Returns the card, or null when she has already been told.
// `onFinish` is called by the last step's button — the hub uses it to take her to the games.
export function createWelcomeTour(ctx, { onFinish } = {}) {
  if (tourSeen()) return null;
  let step = 0;
  const guide = (getState() || {}).guide;
  const card = el('section', { class: 'card tour-card', role: 'group', 'aria-label': 'How Boo Town works' });
  render();
  return card;

  function render() {
    clear(card);
    const s = TOUR_STEPS[step];
    const dots = el('div', { class: 'tour-dots', 'aria-hidden': 'true' });
    TOUR_STEPS.forEach((_, i) => dots.appendChild(el('span', { class: 'tour-dot' + (i === step ? ' on' : '') })));
    card.append(
      el('div', { class: 'tour-head' }, [
        el('div', { class: 'tour-guide', html: renderGuide(guide, { view: 'head', size: 64 }) }),
        el('div', { class: 'tour-title', text: 'How Boo Town works' })
      ]),
      el('p', { class: 'tour-text', text: s.text }),
      dots,
      el('div', { class: 'tour-btns' }, [
        el('button', { class: 'btn tour-next', text: s.button, onclick: next }),
        // One way out, on every step, in the quiet style the age card uses.
        el('button', { class: 'tour-skip', text: 'skip', 'aria-label': 'Skip the welcome tour', onclick: skip })
      ])
    );
    speakMaybe(s.text);
  }
  function next() {
    sfx.tap();
    if (step < TOUR_STEPS.length - 1) { step++; render(); return; }
    finish();
    onFinish && onFinish();
  }
  function skip() { sfx.tap(); finish(); }
  function finish() {
    markTourSeen();
    card.remove();
    if (typeof window !== 'undefined' && window.__tour) window.__tour.gone = true;
  }
}
