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

// ---- the scripts (RUN5 C5): three short steps per game, guide's voice, every
// step under 12 words. Boo Blocks' script (with its demo line) lives in blocks.js.
export const INTRO_SCRIPTS = {
  bubblepop: [
    { text: 'Pop the bubble with the right answer!' },
    { text: 'Wrong pops just wobble — try again, no worries!' },
    { text: 'Ten answers finishes the round. Stars fill your meter!' }
  ],
  feedboos: [
    { text: 'These Boos are HUNGRY!' },
    { text: 'Drag each food to the Boo whose sign matches.' },
    { text: 'Wrong Boo? It bounces back — just try again!' }
  ],
  spellboo: [
    { text: "I'll show you a word — you build it!" },
    { text: 'Tap letter tiles to fill the slots in order.' },
    { text: 'Need a look? Peek is always free!' }
  ],
  dash: [
    { text: 'Run up the path with me!' },
    { text: "Answer each gate's question to swing it open!" },
    { text: 'Three right in a row makes you ZOOM!' }
  ],
  bounce: [
    { text: 'Bounce the ball into the right brick!' },
    { text: 'Drag to aim, let go to bounce!' },
    { text: 'The right brick bursts — wrong ones just wobble!' }
  ],
  beat: [
    { text: 'Tap the lane with the right answer!' },
    { text: 'Tap just as the note reaches the line!' },
    { text: 'Steady mode waits for you — no rush ever!' }
  ],
  boopop: [
    { text: 'Swap gems so two matching friends touch — POP!' },
    { text: 'The big chip up top says who pops!' },
    { text: 'Stuck? A helpful glow appears all on its own!' }
  ],
  clockshop: [
    { text: 'The Boos want to know the time!' },
    { text: 'Drag the clock hands to match each order!' },
    { text: 'Little hand hours, big hand minutes!' }
  ],
  soundsorter: [
    { text: "I'll say a sound — like shhh!" },
    { text: 'Tap EVERY picture with that sound hiding in it.' },
    { text: 'The letter card means you can play in silence!' }
  ],
  blendit: [
    { text: 'These sounds are shy — they sit apart!' },
    { text: 'Pull them together, or tap Blend.' },
    { text: 'Then tap the picture the word makes!' }
  ],
  teachme: [
    { text: "Pick a lesson and I'll teach you, step by step!" }
  ],
  golden: [
    { text: 'A golden challenge, straight from home!' },
    { text: 'Answer them all for DOUBLE stars, once a day!' }
  ],
  // Toddler mode (C7): a single spoken step per game
  tcount:  [{ text: 'Pop the bubble with this many dots!' }],
  tcolour: [{ text: 'Feed each Boo its matching colour!' }],
  tshape:  [{ text: 'Match each shape to its hole!' }],
  tletter: [{ text: 'Tap the letter that matches mine!' }],
  tanimal: [{ text: 'Tap the animal that makes the sound!' }],
  tpairs:  [{ text: 'Turn two cards to find matching animals!' }],
  tbigsmall: [{ text: 'Big things to the big paw, small to the small!' }],
  // RUN13 T2: the first time a child ever opens Boo Care, for any Boo.
  care: [
    { text: 'Pick something lovely to do together!' },
    { text: 'Hold the tool and move it — that is the whole trick.' },
    { text: 'The ring fills as you go. Nothing here can go wrong.' }
  ]
};

// Show a game's intro on its first-ever open (no-op once seen).
export function maybeIntro(game, steps) {
  if (introSeen(game)) return false;
  runIntro(game, { steps: steps || INTRO_SCRIPTS[game] || [] });
  return true;
}
// The "?" button: replay any time.
export function replayIntro(game, steps) {
  runIntro(game, { steps: steps || INTRO_SCRIPTS[game] || [] });
}

export function introSeen(game) {
  const s = getState();
  return !!(s && s.seen && s.seen.introSeen && s.seen.introSeen[game]);
}
export function markIntroSeen(game) {
  mutate(st => { st.seen = st.seen || {}; st.seen.introSeen = st.seen.introSeen || {}; st.seen.introSeen[game] = true; });
}

// ---- round suspension (RUN12 S6) ------------------------------------------------------
// The intro teaches; it must never run the game behind its own back. Flash Boos was
// revealing and hiding its scene while the child was still reading step one, and Boo Beat
// dropped two hearts before she had finished the instructions.
//
// Anything with a round to freeze registers here. js/gameshell.js does it for every game,
// so a game only has to take its timers and its clock from the shell to be covered.
const suspendables = new Set();
let suspendDepth = 0;
export function registerSuspendable(api) {
  suspendables.add(api);
  // A game shell can be built AFTER the overlay is already up (several games call
  // maybeIntro() at mount and only reach play() from a start card). Catch it up.
  if (suspendDepth > 0) { try { api.suspend(); } catch (e) { console.warn(e); } }
  return () => suspendables.delete(api);
}
export function roundSuspended() { return suspendDepth > 0; }
// RUN14 U-0: the suspension pair is exported for ONE additional caller — main.js's QA
// hook, so a reachability walk can hold the app's organic timers still the way an intro
// overlay does (BLOCKED.md's r4p12-reach recommendation). Product code other than the
// intro overlay must not call these directly.
export { suspendRound as qaSuspendRound, resumeRound as qaResumeRound };
function suspendRound() {
  if (++suspendDepth !== 1) return;                    // nested intros suspend once
  for (const s of suspendables) { try { s.suspend(); } catch (e) { console.warn(e); } }
}
function resumeRound() {
  if (suspendDepth === 0 || --suspendDepth !== 0) return;
  for (const s of suspendables) { try { s.resume(); } catch (e) { console.warn(e); } }
}

// A paused-aware clock + timer set. `now()` simply does not advance while an intro is up,
// and a pending timer banks its remaining time across the pause instead of burning through
// it. Used by js/gameshell.js for every shelled game and directly by Echo Boos, which
// predates the shell. One implementation, so the two cannot drift.
export function createRoundTimers() {
  let paused = false, pausedAt = 0, lostMs = 0;
  const pending = new Set();
  const now = () => (paused ? pausedAt : performance.now()) - lostMs;
  function after(ms, fn) {
    const t = { fn, dueAt: now() + ms, id: null };
    pending.add(t);
    if (!paused) t.id = setTimeout(() => { pending.delete(t); fn(); }, ms);
    return t;
  }
  function cancel(t) { if (!t) return; if (t.id) clearTimeout(t.id); pending.delete(t); }
  function clearAll() { for (const t of pending) if (t.id) clearTimeout(t.id); pending.clear(); }
  const unregister = registerSuspendable({
    suspend() {
      if (paused) return;
      paused = true; pausedAt = performance.now();
      for (const t of pending) { if (t.id) { clearTimeout(t.id); t.id = null; } }
    },
    resume() {
      if (!paused) return;
      lostMs += performance.now() - pausedAt;
      paused = false;
      for (const t of pending) {
        const left = Math.max(0, t.dueAt - now());
        t.id = setTimeout(() => { pending.delete(t); t.fn(); }, left);
      }
    }
  });
  return {
    now, after, cancel, clearAll,
    timeout: (fn, ms) => after(ms, fn),          // setTimeout's own signature
    paused: () => paused,
    pausedMs: () => lostMs,
    dispose() { clearAll(); unregister(); }
  };
}

// steps: [{ text, demo?: (demoArea) => cleanupFn }]. onDone runs after finish or Skip.
// speak: read each step aloud when voice is available.
export function runIntro(game, { steps = [], onDone = null, speak = true } = {}) {
  if (!steps.length) { markIntroSeen(game); if (onDone) onDone(); return { close() {} }; }   // nothing shown, nothing suspended
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
  suspendRound();       // the round behind this overlay stops dead until it closes

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
    resumeRound();      // and picks up exactly where it was, not where it would have been
    markIntroSeen(game);
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 220);
    if (onDone) onDone();
  }
  // test hook
  if (typeof window !== 'undefined') window.__intro = { game, step: () => idx, total: steps.length, next: () => nextBtn.click(), close: finish };
  return { close: finish };
}
