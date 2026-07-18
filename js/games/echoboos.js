// js/games/echoboos.js — Echo Boos (RUN9 C5): musical memory.
// Four colour Boos on podiums (indigo, bubblegum, teal, gold), each singing a fixed note
// from the band's synth voice when tapped, with a squash + glow. The game sings a growing
// sequence, lighting each Boo as it sounds; she repeats it by tapping. A correct echo
// extends the sequence by one with a rising flourish; a slip replays the same sequence once
// more slowly (one mercy per round); a second slip ends the round warmly at her best length.
// Pace starts slow and quickens gently with length (capped). Fully playable with sound off —
// the light pattern carries it. Toddler tier gets it too, capped at gentler lengths.

import { el, clear, backControl, REDUCED, confetti } from '../ui.js';
import { getState, mutate } from '../state.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music, band } from '../sfx.js';
import { runIntro, introSeen } from '../intro.js';
import { contentTier } from '../content.js';

// The four Boos: colour + a fixed note (semitones on the band's C-major voice).
const BOOS = [
  { key: 'indigo', colour: '#5A4B9E', semi: 0 },   // C
  { key: 'bubblegum', colour: '#FF7AC6', semi: 4 },   // E
  { key: 'teal', colour: '#35D0BA', semi: 7 },   // G
  { key: 'gold', colour: '#FFC93C', semi: 12 }   // C'
];

// RUN10 P11 pace: standard is brisk, Lightning is a separate score chase, and the
// Toddler constants/formula remain byte-for-byte equivalent to the earlier game.
export const BASE_GAP = 440, MIN_GAP = 250, GAP_STEP = 32;
export const LIGHTNING_BASE_GAP = 330, LIGHTNING_MIN_GAP = 200;
const LIT_MS = 400;
const TOD_BASE_GAP = 820, TOD_MIN_GAP = 560, TOD_GAP_STEP = 26, TOD_CAP = 6;
export function echoGap(len, { lightning = false, toddler = false } = {}) {
  if (toddler) return Math.max(TOD_MIN_GAP, TOD_BASE_GAP - len * TOD_GAP_STEP);
  const base = lightning ? LIGHTNING_BASE_GAP : BASE_GAP;
  const floor = lightning ? LIGHTNING_MIN_GAP : MIN_GAP;
  const stepped = (base - len * GAP_STEP) * Math.pow(0.94, Math.floor(Math.max(0, len - 1) / 3));
  return Math.max(floor, Math.round(stepped));
}
const rand = (n) => (Math.random() * n) | 0;

const ECHO_INTRO = [
  { text: 'Listen! The Boos sing a little tune, lighting up in order.' },
  { text: 'Now your turn — tap them back in the SAME order!' },
  { text: 'Every round adds one more. How long a tune can you echo?' }
];

export function starsFor(bestLen) { return bestLen >= 8 ? 3 : bestLen >= 5 ? 2 : 1; }

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen echoboos' });
  container.appendChild(root);
  const toddler = contentTier() === 'toddler';
  let lightning = !toddler && !!(params && params.lightning);
  let timers = [];
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const after = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

  if (params && params.resume) play();
  else startCard();
  if (!introSeen('echoboos')) runIntro('echoboos', { steps: ECHO_INTRO });

  function echoBest(fast = lightning) {
    const seen = getState().seen || {};
    return (fast ? seen.echoBestLightning : seen.echoBest) || 0;
  }

  function startCard() {
    clearTimers(); clear(root);
    music.play('game');
    const s = getState();
    const standardBest = echoBest(false);
    const lightningBest = echoBest(true);
    const modeRow = toddler ? null : el('div', { class: 'echo-mode-row' }, [
      el('button', {
        class: `echo-mode${lightning ? '' : ' sel'}`,
        text: '🎵 Standard',
        onclick: () => { lightning = false; startCard(); }
      }),
      el('button', {
        class: `echo-mode lightning${lightning ? ' sel' : ''}`,
        text: '⚡ Lightning',
        onclick: () => { lightning = true; startCard(); }
      })
    ]);
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 104 }) }),
      el('h2', { text: '🎵 Echo Boos' }),
      el('p', { class: 'sc-intro', text: 'Listen to the tune, then echo it back!' }),
      modeRow,
      el('div', { class: 'echo-bests' }, [
        el('span', { class: 'echo-best', text: standardBest > 0 ? `🎵 Best ${standardBest}` : '🎵 Standard —' }),
        ...(toddler ? [] : [el('span', { class: 'echo-best lightning', text: lightningBest > 0 ? `⚡ Best ${lightningBest}` : '⚡ Lightning —' })])
      ]),
      el('button', { class: 'btn big', text: '▶ Play', onclick: () => { sfx.tap(); play(); } })
    ]);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: '⭐⭐⭐' }),
      el('p', { text: 'Three stars: echo a tune of 8 notes!' })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go(toddler ? 'hub' : 'hub'), { floating: true }));
  }

  function play() {
    clearTimers(); clear(root);
    music.play('game');
    let sequence = [rand(4)];
    let pos = 0, bestLen = 0, mercyUsed = false, inputPhase = false, ended = false, awaiting = false;

    const board = el('div', { class: 'echo-board' });
    const podiums = BOOS.map((b, i) => {
      const boo = el('button', { class: 'echo-boo', dataset: { i: String(i) }, style: { '--boo': b.colour }, 'aria-label': b.key,
        onclick: () => onTap(i) }, [
        el('span', { class: 'echo-face', html: `<svg viewBox="0 0 80 80" width="100%" height="100%"><circle cx="40" cy="40" r="34" fill="${b.colour}" stroke="#2A1B4E" stroke-width="4"/><circle cx="30" cy="36" r="4.5" fill="#2A1B4E"/><circle cx="50" cy="36" r="4.5" fill="#2A1B4E"/><path d="M30 50 q10 9 20 0" fill="none" stroke="#2A1B4E" stroke-width="3.5" stroke-linecap="round"/></svg>` })
      ]);
      const podium = el('div', { class: 'echo-podium' }, [boo, el('div', { class: 'echo-base' })]);
      return { boo, podium };
    });
    podiums.forEach(p => board.appendChild(p.podium));

    const status = el('div', { class: 'echo-status', text: 'Listen…' });
    const lenChip = el('div', { class: 'echo-len', text: 'Tune: 1' });
    root.append(el('div', { class: 'echo-top' }, [lenChip, status]), board);
    root.appendChild(backControl(() => { clearTimers(); ctx.go('hub'); }, { floating: true }));

    startPlayback();

    if (typeof window !== 'undefined') window.__echo = {
      sequence: () => sequence.slice(), tap: onTap, play: () => startPlayback(),
      state: () => ({ len: sequence.length, pos, bestLen, mercyUsed, inputPhase, ended, awaiting, toddler, lightning }),
      notes: () => BOOS.map(b => b.semi), cap: () => (toddler ? TOD_CAP : Infinity),
      // drive a full correct echo of the current sequence (QA)
      echoAll: () => { if (!inputPhase) return false; const seq = sequence.slice(); seq.forEach(i => onTap(i)); return true; },
      isLit: (i) => podiums[i].boo.classList.contains('lit'),
      anyLit: () => podiums.some(p => p.boo.classList.contains('lit')),
      gap: (len) => gapFor(len), minGap: () => (toddler ? TOD_MIN_GAP : (lightning ? LIGHTNING_MIN_GAP : MIN_GAP)),
      stars: () => starsFor(bestLen),
      setBestForTest: value => { bestLen = Math.max(0, Number(value) || 0); },
      finishForTest: () => finish('Lovely echoing! 🎵')
    };

    function gapFor(len) {
      return echoGap(len, { lightning, toddler });
    }
    function light(i, dur) {
      const boo = podiums[i].boo;
      boo.classList.add('lit'); band.key(BOOS[i].semi);   // note obeys the sound mute; the glow always shows
      after(dur, () => boo.classList.remove('lit'));
    }
    function startPlayback(slow) {
      inputPhase = false; awaiting = false; pos = 0;
      status.textContent = 'Listen…'; lenChip.textContent = 'Tune: ' + sequence.length;
      const gap = gapFor(sequence.length) * (slow ? 1.5 : 1);
      let t = 500;
      sequence.forEach((i, k) => { after(t, () => light(i, Math.min(LIT_MS, gap * 0.6))); t += gap; });
      after(t + 200, () => { inputPhase = true; awaiting = true; status.textContent = 'Your turn! 🎤'; });
    }
    function onTap(i) {
      if (!inputPhase || ended) return;
      const boo = podiums[i].boo;
      boo.classList.add('lit'); band.key(BOOS[i].semi);
      after(220, () => boo.classList.remove('lit'));
      if (i === sequence[pos]) {
        pos++;
        if (pos === sequence.length) {
          // full echo! record best length, then extend with a rising flourish
          inputPhase = false; awaiting = false;
          bestLen = Math.max(bestLen, sequence.length);
          status.textContent = 'Yes! 🌟';
          sfx.star();
          const capped = toddler && sequence.length >= TOD_CAP;
          if (capped) { after(700, () => finish('What a long tune! 🎶')); return; }
          after(720, () => { sequence.push(rand(4)); risingFlourish(); startPlayback(); });
        }
      } else {
        // a slip
        sfx.oops();
        if (!mercyUsed) {
          mercyUsed = true; inputPhase = false; awaiting = false;
          status.textContent = 'Oops! Listen once more…';
          after(900, () => startPlayback(true));   // replay the SAME sequence, slower (one mercy)
        } else {
          finish('Lovely echoing! 🎵');
        }
      }
    }
    function risingFlourish() {
      if (REDUCED) return;
      [0, 1, 2, 3].forEach((i, k) => after(k * 90, () => { podiums[i].boo.classList.add('flourish'); after(300, () => podiums[i].boo.classList.remove('flourish')); }));
    }
    function finish(msg) {
      if (ended) return; ended = true; inputPhase = false; clearTimers();
      status.textContent = msg;
      const stars = starsFor(bestLen);
      if (bestLen > echoBest()) mutate(s => {
        s.seen = s.seen || {};
        if (lightning) s.seen.echoBestLightning = bestLen;
        else s.seen.echoBest = bestLen;
      });
      if (!REDUCED && bestLen >= 5) confetti({ count: 50, power: 1 });
      after(1600, () => ctx.go('results', { game: 'echoboos', gameName: lightning ? 'Echo Boos: Lightning' : 'Echo Boos', stars, level: null, cat: null, mix: false, replay: () => ctx.go('echoboos', { resume: true, lightning }) }));
    }
  }

  return { unmount() { clearTimers(); } };
}
