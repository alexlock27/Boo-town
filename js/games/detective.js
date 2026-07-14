// js/games/detective.js — Word Detective (RUN9 C3): a kind Lingo.
// Modes: 4-letter and 5-letter. Five guesses on a tile grid; letters flip with classic
// feedback — green (right spot), orange (in the word elsewhere), grey (not in the word) —
// and a chunky on-screen keyboard mirrors the colours. ANY letter combination may be
// guessed: real non-target words play; obvious keyboard mash earns a giggle ("Funny word!")
// but still plays — never a "not a word" wall. After the 3rd unsuccessful guess the guide
// offers a hint (reveal the first letter), capping the round at 2 stars. A round always ends
// warmly: solved → a bounce-spell; unsolved → a friendly reveal.

import { el, clear, backControl, REDUCED, confetti } from '../ui.js';
import { haptic } from '../haptics.js';
import { getState, mutate, recordResult } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { runIntro, introSeen } from '../intro.js';
import { LISTS } from '../../data/detective.js';

const GUESSES = 5;
const KEYROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

const DET_INTRO = [
  { text: "I'm thinking of a word. Guess it in five tries!" },
  { text: 'Green = right spot. Orange = right letter, wrong spot. Grey = not in it.' },
  { text: 'Any letters are fine — silly guesses give clues too. Go on, detective!' }
];

// classic Wordle scoring with correct duplicate handling (two passes).
export function scoreGuess(guess, target) {
  const n = guess.length;
  const res = Array(n).fill('grey');
  const counts = {};
  for (const ch of target) counts[ch] = (counts[ch] || 0) + 1;
  for (let i = 0; i < n; i++) if (guess[i] === target[i]) { res[i] = 'green'; counts[guess[i]]--; }
  for (let i = 0; i < n; i++) if (res[i] !== 'green' && counts[guess[i]] > 0) { res[i] = 'orange'; counts[guess[i]]--; }
  return res;
}
// "obvious keyboard mash": no vowels at all, or the same letter 3+ times.
export function looksLikeMash(word) {
  if (![...word].some(c => VOWELS.has(c))) return true;
  const counts = {};
  for (const c of word) { counts[c] = (counts[c] || 0) + 1; if (counts[c] >= 3) return true; }
  return false;
}

// Pick the next target for a mode without repeating until the whole list cycles.
function nextTarget(mode) {
  const list = LISTS[mode];
  const s = getState();
  s.seen.detSeen = s.seen.detSeen || {};
  let used = s.seen.detSeen[mode] || [];
  if (used.length >= list.length) used = [];   // whole list cycled → reshuffle pool
  const pool = list.map((_, i) => i).filter(i => !used.includes(i));
  const idx = pool[(Math.random() * pool.length) | 0];
  mutate(st => { st.seen.detSeen = st.seen.detSeen || {}; const u = (st.seen.detSeen[mode] || []); if (u.length >= list.length) u.length = 0; u.push(idx); st.seen.detSeen[mode] = u; });
  return list[idx];
}

export function starsFor(solved, guessesUsed, hinted) {
  if (!solved) return 1;
  if (guessesUsed <= 3 && !hinted) return 3;
  return 2;
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen detective' });
  container.appendChild(root);
  let shell = null;
  const rz = params && params.resume;
  if (rz) play(rz.mode || 4);
  else startCard();
  if (!introSeen('detective')) runIntro('detective', { steps: DET_INTRO });

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 104 }) }),
      el('h2', { text: '🔎 Word Detective' }),
      el('p', { class: 'sc-intro', text: "Crack the secret word in five guesses!" }),
      el('p', { class: 'sc-q', text: 'Which puzzle?' })
    ]);
    // 4-letter presented first (C3)
    const modes = el('div', { class: 'det-modes' }, [
      el('button', { class: 'btn big', text: '4-letter words', onclick: () => { sfx.tap(); play(4); } }),
      el('button', { class: 'btn big soft', text: '5-letter words', onclick: () => { sfx.tap(); play(5); } })
    ]);
    card.append(modes, el('div', { class: 'star-rule' }, [
      el('div', { html: '⭐⭐⭐' }),
      el('p', { text: 'Three stars: solve it in three guesses with no peek!' })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
  }

  function play(mode) {
    clear(root);
    music.play('game');
    const target = nextTarget(mode).toLowerCase();
    const rows = [];              // each: array of {ch, state}
    let cur = '';                 // the current typing row
    let guessesUsed = 0, solved = false, hinted = false, ended = false, locked = false, hintOffered = false;
    const keyState = {};          // letter -> best colour seen

    shell = createGameShell({
      title: 'Word Detective', accent: 'var(--zing)', hideHearts: true, hideProgress: true,
      onBack: () => ctx.go('hub'), onHint: doHint, hintEnabled: false,
      onHelp: () => runIntro('detective', { steps: DET_INTRO })
    });
    root.appendChild(shell.root);

    const grid = el('div', { class: 'det-grid', style: { '--cols': String(mode) } });
    const tileEls = [];
    for (let r = 0; r < GUESSES; r++) {
      const rowEls = [];
      const rowEl = el('div', { class: 'det-row' });
      for (let c = 0; c < mode; c++) { const t = el('div', { class: 'det-tile', dataset: { r: String(r), c: String(c) } }); rowEl.appendChild(t); rowEls.push(t); }
      grid.appendChild(rowEl); tileEls.push(rowEls);
    }
    const kb = el('div', { class: 'det-kb' });
    const keyEls = {};
    KEYROWS.forEach((krow, ri) => {
      const rowEl = el('div', { class: 'det-kb-row' });
      if (ri === 2) rowEl.appendChild(el('button', { class: 'det-key wide', text: '⏎', 'aria-label': 'Enter', onclick: () => submit() }));
      for (const ch of krow) { const k = el('button', { class: 'det-key', text: ch.toUpperCase(), dataset: { key: ch }, onclick: () => typeCh(ch) }); rowEl.appendChild(k); keyEls[ch] = k; }
      if (ri === 2) rowEl.appendChild(el('button', { class: 'det-key wide', text: '⌫', 'aria-label': 'Backspace', onclick: () => backspace() }));
      kb.appendChild(rowEl);
    });
    shell.area.appendChild(el('div', { class: 'det-wrap' }, [grid, kb]));

    renderCurrent();

    if (typeof window !== 'undefined') window.__detective = {
      mode: () => mode, target: () => target,
      type: typeCh, backspace, enter: submit,
      guess: (w) => { for (const ch of w.toLowerCase()) if (cur.length < mode) typeCh(ch); submit(); },
      rows: () => rows.map(r => r.map(t => ({ ch: t.ch, state: t.state }))),
      keyState: () => ({ ...keyState }),
      state: () => ({ guessesUsed, solved, hinted, ended, cur }),
      hint: doHint, hintOffered: () => hintOffered && !hinted,
      stars: () => starsFor(solved, guessesUsed, hinted)
    };

    function typeCh(ch) {
      if (locked || ended) return;
      if (cur.length >= mode) return;
      cur += ch; sfx.tap(); renderCurrent();
    }
    function backspace() { if (locked || ended) return; cur = cur.slice(0, -1); renderCurrent(); }
    function renderCurrent() {
      const r = rows.length;
      if (r >= GUESSES) return;
      for (let c = 0; c < mode; c++) {
        const t = tileEls[r][c];
        t.textContent = (cur[c] || '').toUpperCase();
        t.classList.toggle('filled', !!cur[c]);
      }
    }

    function submit() {
      if (locked || ended) return;
      if (cur.length < mode) { shell.react('Fill all the boxes first!', { voice: false, hold: 1400 }); return; }
      const guess = cur;
      const score = scoreGuess(guess, target);
      const r = rows.length;
      const rowData = [...guess].map((ch, i) => ({ ch, state: score[i] }));
      rows.push(rowData);
      guessesUsed++;
      const mash = looksLikeMash(guess);
      locked = true;
      // flip reveal, tile by tile
      const STEP = REDUCED ? 0 : 260;
      score.forEach((st, i) => {
        const t = tileEls[r][i];
        const paint = () => { t.textContent = guess[i].toUpperCase(); t.className = `det-tile ${st}` + (REDUCED ? '' : ' flip'); upgradeKey(guess[i], st); if (st === 'green') { try { haptic('pulse'); } catch {} } };   // a light pulse on a green (RUN9 C7)
        if (REDUCED) paint(); else setTimeout(paint, i * STEP);
      });
      const revealMs = REDUCED ? 30 : score.length * STEP + 260;
      setTimeout(() => {
        locked = false; cur = '';
        if (guess === target) return win(r);
        if (mash) shell.react('Funny word! 😄 But it still gives clues!', { voice: false, hold: 1800 });
        // record the attempt to the ledger loosely (a word-guess is not a Smart-Mix item,
        // but log the round's engagement so the meter economy sees activity)
        if (rows.length >= GUESSES) return lose();
        // offer the hint after the 3rd unsuccessful guess (C3)
        if (guessesUsed === 3 && !hinted) {
          hintOffered = true; shell.enableHint(true);
          shell.react('Stuck? Tap me to peek at the first letter!', { voice: false, hold: 2600 });
        }
      }, revealMs);
    }
    function upgradeKey(ch, st) {
      const rank = { grey: 0, orange: 1, green: 2 };
      if (!keyState[ch] || rank[st] > rank[keyState[ch]]) {
        keyState[ch] = st;
        if (keyEls[ch]) keyEls[ch].className = 'det-key ' + st;
      }
    }
    function doHint() {
      if (hinted || solved || ended || !hintOffered) return;
      hinted = true; shell.enableHint(false);
      const first = target[0].toUpperCase();
      shell.react(`It starts with “${first}”. That's a peek, so up to 2 stars now!`, { voice: true, hold: 3000 });
      const chip = el('div', { class: 'det-hint-chip', text: `Starts with ${first}` });
      shell.area.querySelector('.det-wrap').prepend(chip);
    }

    function win(r) {
      solved = true; ended = true;
      sfx.star();
      recordResult('detective_solved', true);
      // bounce-spell the solved row letter by letter
      if (!REDUCED) tileEls[r].forEach((t, i) => setTimeout(() => { t.classList.add('bounce'); setTimeout(() => t.classList.remove('bounce'), 500); }, i * 120));
      if (!REDUCED) confetti({ count: 60, power: 1.05 });
      shell.react(guessesUsed <= 3 && !hinted ? 'Brilliant detective work! 🌟' : 'You got it! 🎉', { voice: true, hold: 2400 });
      finish();
    }
    function lose() {
      ended = true;
      recordResult('detective_solved', false);
      shell.react(`It was ${target.toUpperCase()}! So sneaky. 🕵️`, { voice: true, hold: 3000 });
      // reveal the answer in a friendly card
      const reveal = el('div', { class: 'det-reveal' }, [
        el('span', { text: 'The word was' }),
        el('strong', { text: target.toUpperCase() })
      ]);
      shell.area.querySelector('.det-wrap').prepend(reveal);
      finish();
    }
    function finish() {
      const stars = starsFor(solved, guessesUsed, hinted);
      setTimeout(() => {
        shell.cleanup();
        ctx.go('results', { game: 'detective', gameName: 'Word Detective', stars, level: null, cat: null, mix: false, replay: () => ctx.go('detective') });
      }, solved ? 2200 : 2600);
    }
  }

  return { unmount() { if (shell) shell.cleanup(); } };
}
