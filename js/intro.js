// js/intro.js — first-play guided intros (RUN5 C1 for Boo Blocks; C5 generalises this
// to every game). One shared pattern: the first time a player ever opens a game, the
// guide walks a few short steps (a speech bubble, sometimes a tiny scripted demo), a
// soft "Skip" is always present, and a "?" button in the game shell replays it. Seen-
// flags live per game in the save (seen.introSeen[game]).

import { el, clear } from './ui.js';
import { getState, mutate } from './state.js';
import { renderGuide } from './art.js';
import { sfx } from './sfx.js';
import { speakMaybe } from './guide.js';

export function introSeen(game) {
  const s = getState();
  return !!(s && s.seen && s.seen.introSeen && s.seen.introSeen[game]);
}
export function markIntroSeen(game) {
  mutate(st => { st.seen = st.seen || {}; st.seen.introSeen = st.seen.introSeen || {}; st.seen.introSeen[game] = true; });
}

// steps: [{ text, demo?: (demoArea) => cleanupFn }]. onDone runs after finish or Skip.
// speak: read each step aloud when voice is available.
export function runIntro(game, { steps = [], onDone = null, speak = true } = {}) {
  if (!steps.length) { markIntroSeen(game); if (onDone) onDone(); return { close() {} }; }
  const s = getState();
  const guide = (s && s.guide) || { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none' };

  const bubble = el('div', { class: 'intro-bubble' });
  const guideHead = el('div', { class: 'intro-guide', html: renderGuide(guide, { view: 'head', size: 92 }) });
  const demoArea = el('div', { class: 'intro-demo' });
  const dots = el('div', { class: 'intro-dots' });
  const nextBtn = el('button', { class: 'btn intro-next' });
  const skipBtn = el('button', { class: 'btn soft intro-skip', text: 'Skip', onclick: () => finish() });
  const panel = el('div', { class: 'card intro-panel' }, [
    el('div', { class: 'intro-head' }, [guideHead, bubble]),
    demoArea, dots,
    el('div', { class: 'intro-btns' }, [skipBtn, nextBtn])
  ]);
  const overlay = el('div', { class: 'intro-overlay', role: 'dialog', 'aria-label': 'How to play' }, [panel]);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  let idx = 0, demoCleanup = null, closed = false;
  function render() {
    clear(dots);
    steps.forEach((_, i) => dots.appendChild(el('span', { class: 'idot' + (i === idx ? ' on' : (i < idx ? ' done' : '')) })));
    const step = steps[idx];
    bubble.textContent = step.text;
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    if (speak) speakMaybe(step.text);
    clear(demoArea);
    if (demoCleanup) { try { demoCleanup(); } catch {} demoCleanup = null; }
    demoArea.style.display = step.demo ? '' : 'none';
    if (step.demo) demoCleanup = step.demo(demoArea);
    nextBtn.textContent = idx < steps.length - 1 ? 'Next' : "Let's go!";
  }
  nextBtn.onclick = () => { sfx.tap(); if (idx < steps.length - 1) { idx++; render(); } else finish(); };
  render();

  function finish() {
    if (closed) return; closed = true;
    if (demoCleanup) { try { demoCleanup(); } catch {} }
    markIntroSeen(game);
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 220);
    if (onDone) onDone();
  }
  // test hook
  if (typeof window !== 'undefined') window.__intro = { game, step: () => idx, total: steps.length, next: () => nextBtn.click(), close: finish };
  return { close: finish };
}
