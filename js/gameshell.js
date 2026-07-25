// js/gameshell.js — the frame shared by all three games (spec §5.3).
// Top bar: back (with confirm), round progress dots, hearts (informational,
// round never ends early), hint button with the guide's face. Guide peeks from
// a corner and slides in a bubble for hints and reactions.

import { el, clear, heartsRow, dialog, backControl } from './ui.js';
import { getState, beginRoundTally } from './state.js';
import { renderGuide } from './art.js';
import { speakMaybe } from './guide.js';
import { sfx } from './sfx.js';
import { createRoundTimers } from './intro.js';

export function createGameShell({ title, rounds = 10, accent = 'var(--pop)', maxHearts = 3, onBack, onHint, hintEnabled = true, onHelp = null, hideHearts = false, hideProgress = false, bank = null, maxStars = 3 }) {
  beginRoundTally();   // RUN4 C3: collect this round's ledger items for the cosy check
  const s = getState();
  const guide = (s && s.guide) || { body: 'sunshine', patch: 'cocoa', acc: 'none' };
  let hearts = maxHearts;
  let progress = 0;

  // ---- banking on exit (RUN12 S11) -----------------------------------------------------
  // Leaving mid-round used to forfeit everything: "Your stars won't be saved." A child who
  // got seven right and then had to stop for tea lost all seven. A round now banks stars in
  // proportion to what she actually got RIGHT, rounded down, never more than the round could
  // have paid — and the dialog says so before she decides.
  //
  // `bank` is supplied by the game as () => ({ correct, of }). Without it the shell falls
  // back to the progress dots, which every question-round game advances on a correct answer.
  function bankedStars() {
    const b = (typeof bank === 'function' ? bank() : null) || { correct: progress, of: rounds };
    const of = Math.max(1, b.of || rounds);
    const correct = Math.max(0, Math.min(of, b.correct || 0));
    return { correct, of, stars: Math.max(0, Math.min(maxStars, Math.floor(maxStars * correct / of))) };
  }
  const backBtn = backControl(async () => {
    const b = bankedStars();
    const leave = await dialog({
      title: 'Leave this round?',
      body: "You'll keep the stars you've earned so far.",
      buttons: [
        { label: 'Keep playing', value: false, kind: 'secondary' },
        { label: 'Leave', value: true, kind: 'soft' }
      ]
    });
    if (leave) onBack && onBack(b);
  }, { label: 'Leave round' });

  const dots = el('div', { class: 'progress-dots' });
  const progressLabel = el('span', { class: 'progress-label' });
  const progressWrap = el('div', { class: 'progress-wrap' }, [dots, progressLabel]);
  if (hideProgress) progressWrap.style.display = 'none';   // score-chase games show a score, not dots

  const heartsWrap = el('div', { class: 'hearts-wrap', html: heartsRow(hearts, { max: maxHearts }) });
  if (hideHearts) heartsWrap.style.display = 'none';   // Toddler mode (RUN5 C7): no hearts anywhere

  const hintBtn = el('button', {
    class: 'hint-btn', 'aria-label': 'Ask the guide for a hint',
    html: `<div class="hint-face">${renderGuide(guide, { view: 'head', size: 54 })}</div>`
  });
  hintBtn.addEventListener('click', () => { if (!hintBtn.disabled) onHint && onHint(); });
  if (!hintEnabled) hintBtn.disabled = true;

  // "?" replay-the-intro button (RUN5 C1/C5): only when the screen supplies onHelp.
  const helpBtn = onHelp ? el('button', { class: 'help-btn', 'aria-label': 'How to play', text: '?', onclick: () => onHelp() }) : null;

  const topbar = el('header', { class: 'game-topbar', style: { '--accent': accent } }, [
    backBtn, progressWrap, heartsWrap, ...(helpBtn ? [helpBtn] : []), hintBtn
  ]);

  const area = el('div', { class: 'game-area' });

  // corner guide peek + bubble
  const peekArt = el('div', { class: 'peek-art', html: renderGuide(guide, { view: 'head', size: 96 }) });
  const peekBubble = el('div', { class: 'peek-bubble' });
  const peek = el('div', { class: 'guide-peek' }, [peekBubble, peekArt]);

  const root = el('div', { class: 'game-shell' }, [topbar, area, peek]);

  renderDots();

  function renderDots() {
    clear(dots);
    for (let i = 0; i < rounds; i++) {
      dots.appendChild(el('span', { class: 'pdot' + (i < progress ? ' done' : '') + (i === progress ? ' current' : '') }));
    }
    progressLabel.textContent = `${Math.min(progress + 1, rounds)} of ${rounds}`;
  }

  let peekTimer = null;
  function react(text, { voice = true, hold = 3200 } = {}) {
    if (!text) return;
    peekBubble.textContent = text;
    peek.classList.add('show');
    peekBubble.classList.remove('pop'); void peekBubble.offsetWidth; peekBubble.classList.add('pop');
    speakMaybe(text, voice);
    if (peekTimer) clearTimeout(peekTimer);
    peekTimer = setTimeout(() => peek.classList.remove('show'), hold);
  }

  // ---- round suspension (RUN12 S6) ---------------------------------------------------
  // A game that takes its clock and its timers from here is automatically frozen whenever
  // an intro or a "?" replay is on screen, and resumes exactly where it was — not where it
  // would have drifted to.
  const clock = createRoundTimers();

  return {
    root, area,
    react,
    // the paused-aware round clock and timers
    now: clock.now, after: clock.after, cancel: clock.cancel,
    // setTimeout's own signature, so converting a game is a one-word change per call site
    timeout: clock.timeout,
    paused: clock.paused,
    banked: () => bankedStars(),   // QA + the games' own leave routing
    pausedMs: clock.pausedMs,   // for games on an external clock (Boo Beat rides the audio clock)
    // a rAF loop that simply does not call back while the round is suspended
    loop(fn) {
      let raf = null, stopped = false;
      const tick = () => {
        if (stopped) return;
        raf = requestAnimationFrame(tick);
        if (!clock.paused() && !document.hidden) fn(clock.now());
      };
      raf = requestAnimationFrame(tick);
      return { stop() { stopped = true; if (raf) cancelAnimationFrame(raf); raf = null; } };
    },
    setProgress(n) { progress = n; renderDots(); },
    advance() { progress = Math.min(progress + 1, rounds); renderDots(); },
    dimHeart() {
      if (hearts > 0) hearts--;
      heartsWrap.innerHTML = heartsRow(hearts, { max: maxHearts });
      return hearts;
    },
    heartsLeft() { return hearts; },
    enableHint(on) { hintBtn.disabled = !on; },
    cleanup() {
      if (peekTimer) clearTimeout(peekTimer);
      clock.dispose();
    }
  };
}
