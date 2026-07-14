// js/gameshell.js — the frame shared by all three games (spec §5.3).
// Top bar: back (with confirm), round progress dots, hearts (informational,
// round never ends early), hint button with the guide's face. Guide peeks from
// a corner and slides in a bubble for hints and reactions.

import { el, clear, heartsRow, dialog, backControl } from './ui.js';
import { getState, beginRoundTally } from './state.js';
import { renderGuide } from './art.js';
import { speakMaybe } from './guide.js';
import { sfx } from './sfx.js';

export function createGameShell({ title, rounds = 10, accent = 'var(--pop)', maxHearts = 3, onBack, onHint, hintEnabled = true, onHelp = null, hideHearts = false, hideProgress = false }) {
  beginRoundTally();   // RUN4 C3: collect this round's ledger items for the cosy check
  const s = getState();
  const guide = (s && s.guide) || { body: 'sunshine', patch: 'cocoa', acc: 'none' };
  let hearts = maxHearts;
  let progress = 0;

  // the shared back control (DASH_PATCH job 3), keeping the leave-round confirm
  const backBtn = backControl(async () => {
    const leave = await dialog({
      title: 'Leave this round?',
      body: "Your stars won't be saved.",
      buttons: [
        { label: 'Keep playing', value: false, kind: 'secondary' },
        { label: 'Leave', value: true, kind: 'soft' }
      ]
    });
    if (leave) onBack && onBack();
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

  return {
    root, area,
    react,
    setProgress(n) { progress = n; renderDots(); },
    advance() { progress = Math.min(progress + 1, rounds); renderDots(); },
    dimHeart() {
      if (hearts > 0) hearts--;
      heartsWrap.innerHTML = heartsRow(hearts, { max: maxHearts });
      return hearts;
    },
    heartsLeft() { return hearts; },
    enableHint(on) { hintBtn.disabled = !on; },
    cleanup() { if (peekTimer) clearTimeout(peekTimer); }
  };
}
