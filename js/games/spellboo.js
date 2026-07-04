// js/games/spellboo.js — Game 3: Spell Boo (Year 3/4 spelling, spec §8 + RUN3 C1).
//
// RUN3 C1 changes:
//  - Auto-look replaces free Peek. Every normal word shows clearly for 2s at the start
//    (the "look" in look-cover-spell), then hides and she spells from memory. Free + uniform.
//  - The audio replay button stays free and unlimited.
//  - Pressing Peek AFTER auto-look now counts as a hint (max 2/round, shared budget with the
//    next-letter hint); any hint caps the round at 2 stars, like every other game.
//  - Words carrying a clue sentence (homophones) never auto-show; the clue shows instead.
//  - Sound Twins: a new picker mode (sentence + twin buttons -> spell the winner from tiles).
//  - Tricky Sounds (th) bank added to the word sets (in spellingBanks.js).

import { el, clear, starsRow, wobble, sparkleAt } from '../ui.js';
import { getState, mutate } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import * as tts from '../tts.js';
import { WORDS, decoysFor } from '../../data/spelling.js';
import { BANKS } from '../../data/spellingBanks.js';
import { TWIN_SETS, TWIN_EXPLAIN, TWIN_LEVELS, twinItemsForLevel } from '../../data/soundTwins.js';
import { buildPicker, recordBest } from '../picker.js';

// Word sets: the Big List (statutory) + each themed bank (EXPANSION_1 §3.1 + Tricky Sounds).
const SETS = [{ key: 'big', name: 'The Big List', words: WORDS }, ...BANKS.map(b => ({ key: b.id, name: b.name, words: b.words }))];
const SET_BY_KEY = Object.fromEntries(SETS.map(s => [s.key, s]));
const TWINS_KEY = 'twins';
function tiersInSet(key) { const s = SET_BY_KEY[key]; return [...new Set(s.words.map(w => w.t))].sort(); }

const ROUND_WORDS = 8;
const MAX_HINTS = 2;
const MASTERED_AT = 3;
const rand = (n) => (Math.random() * n) | 0;
const starsFor = (wrong, hints) => (hints === 0 && wrong <= 1) ? 3 : (wrong <= 3 ? 2 : 1);

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen spellboo' });
  container.appendChild(root);
  let shell = null;

  startCard();

  function startCard() {
    clear(root);
    music.play('game');
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(getState().guide, { view: 'head', size: 96 }) }),
      el('h2', { text: 'Spell Boo' }),
      el('p', { class: 'sc-intro', text: guideLine('gameIntroSpell') })
    ]);
    // Sound Twins is an extra mode alongside the word sets.
    const choices = [...SETS.map(s => ({ key: s.key, name: s.name })), { key: TWINS_KEY, name: '🔤 Sound Twins' }];
    const picker = buildPicker({
      game: 'spellboo',
      choices,
      levelsFor: (key) => (key === TWINS_KEY ? TWIN_LEVELS : tiersInSet(key)),
      levelName: (l) => 'Level ' + l,
      onStart: (key, level) => (key === TWINS_KEY ? playTwins(level) : play(key, level))
    });
    card.appendChild(picker.node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: at most one wrong check, no hints. (The word shows first — that peek is free!)' })
    ]));
    root.appendChild(card);
  }

  // Pick ROUND_WORDS unique word objects {w, t, clue?} from a set at a tier, weighting non-mastered.
  function pickWords(setKey, tier) {
    const s = getState();
    const pool = (SET_BY_KEY[setKey] || SET_BY_KEY.big).words.filter(w => w.t === tier);
    const weighted = [];
    for (const wo of pool) {
      const weight = (s.spellingMastery[wo.w] || 0) >= MASTERED_AT ? 1 : 3;
      for (let i = 0; i < weight; i++) weighted.push(wo);
    }
    const chosen = [];
    let guard = 0;
    while (chosen.length < Math.min(ROUND_WORDS, pool.length) && guard++ < 500) {
      const wo = weighted[rand(weighted.length)];
      if (!chosen.some(x => x.w === wo.w)) chosen.push(wo);
    }
    return chosen;
  }

  // ---- a reusable tile speller ------------------------------------------------
  // Renders slots + a shuffled tile tray for `word` into mountEl; calls onCorrect once
  // spelled and onWrongCheck on each failed auto-check. hintNextLetter() reveals a slot.
  function makeSpeller(mountEl, word, { onCorrect, onWrongCheck }) {
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
    const letters = word.split('').concat(decoysFor(word));
    shuffle(letters);
    letters.forEach((letter, i) => {
      const node = el('button', { class: 'tile', text: letter });
      const t = { letter, id: 'T' + i, slot: null, locked: false, node };
      node.onclick = () => placeTile(t);
      trayWrap.appendChild(node);
      tiles.push(t);
    });

    const firstEmpty = () => slots.findIndex(s => !s.dataset.tile);
    function placeTile(t) {
      if (locked || finished || t.slot !== null) return;
      const i = firstEmpty();
      if (i < 0) return;
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
      onWrongCheck && onWrongCheck();
      sfx.oops(); locked = true;
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
    return { slotsWrap, hintNextLetter, isLocked: () => locked || finished };
  }

  // ---- normal word rounds -----------------------------------------------------
  function play(setKey, tier) {
    clear(root);
    const words = pickWords(setKey, tier);
    let wi = 0, wrongChecks = 0, hintsUsed = 0;
    let speller = null, word = '', clue = null;

    shell = createGameShell({
      title: 'Spell Boo', rounds: words.length, accent: 'var(--star)',
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: useLetterHint
    });
    root.appendChild(shell.root);
    const guide = getState().guide;

    const promptCard = el('div', { class: 'spell-prompt' });
    const clueEl = el('div', { class: 'spell-clue', style: { display: 'none' } });
    const peekWord = el('div', { class: 'peek-word', style: { visibility: 'hidden' } });
    const spellArea = el('div', { class: 'spell-area' });
    shell.area.append(promptCard, peekWord, clueEl, spellArea);

    let peekBtn = null;
    showWord();

    function showWord() {
      if (wi >= words.length) return finish();
      const wo = words[wi];
      word = wo.w; clue = wo.clue || null;
      clear(promptCard); clear(spellArea);
      peekWord.style.visibility = 'hidden';
      if (clue) { clueEl.textContent = clue; clueEl.style.display = ''; } else { clueEl.style.display = 'none'; }

      const speaker = el('button', { class: 'icon-btn speak-btn', 'aria-label': 'Say the word again', html: speakerIcon(), onclick: () => sayWord() });
      // Peek is now a HINT (after the free auto-look). Caps stars, shared budget.
      peekBtn = el('button', { class: 'btn soft peek-btn', text: '👀 Peek (hint)', onclick: () => peekHint() });
      if (hintsUsed >= MAX_HINTS) peekBtn.disabled = true;
      promptCard.append(
        el('div', { class: 'spell-guide', html: renderGuide(guide, { view: 'head', size: 72 }) }),
        el('div', { class: 'spell-say' }, [el('span', { text: 'Can you spell it?' }), speaker]),
        peekBtn
      );

      speller = makeSpeller(spellArea, word, {
        onCorrect: onWordSpelled,
        onWrongCheck: () => { wrongChecks++; shell.dimHeart(); }
      });

      // Auto-look: normal words flash for 2s (free). Clued words never auto-show.
      if (!clue) autoLook();
      sayWord();
    }

    function autoLook() { revealWord(2000); }
    function revealWord(ms) {
      peekWord.textContent = word;
      peekWord.style.visibility = 'visible';
      peekWord.classList.remove('pop'); void peekWord.offsetWidth; peekWord.classList.add('pop');
      clearTimeout(revealWord._t);
      revealWord._t = setTimeout(() => { peekWord.style.visibility = 'hidden'; }, ms);
    }
    function peekHint() {
      if (hintsUsed >= MAX_HINTS || (speller && speller.isLocked())) return;
      hintsUsed++; sfx.tap(); revealWord(2000);
      shell.react('A peek! That counts as a hint.', { voice: false, hold: 1400 });
      afterHint();
    }
    function useLetterHint() {
      if (hintsUsed >= MAX_HINTS || !speller) return;
      if (speller.hintNextLetter()) { hintsUsed++; shell.react(guideLine('hintSpell')); afterHint(); }
    }
    function afterHint() {
      if (hintsUsed >= MAX_HINTS) { shell.enableHint(false); if (peekBtn) peekBtn.disabled = true; }
    }

    function sayWord() {
      if (clue) speakMaybe(clue.replace(/_+/g, 'blank'));
      else speakMaybe(`Can you spell... ${word}?`);
    }
    function onWordSpelled() {
      mutate(s => { s.spellingMastery[word] = (s.spellingMastery[word] || 0) + 1; });
      shell.react('Spelled it! 🌟', { voice: false, hold: 1600 });
      speakMaybe(`${word}. Brilliant!`);
      setTimeout(() => { wi++; shell.advance(); showWord(); }, 1400);
    }
    function finish() {
      tts.cancel(); shell.cleanup();
      const stars = starsFor(wrongChecks, hintsUsed);
      recordBest('spellboo', setKey, stars);
      ctx.go('results', { game: 'spellboo', gameName: 'Spell Boo', stars, level: tier, replay: () => ctx.go('spellboo') });
    }

    // test hook (invisible)
    if (typeof window !== 'undefined') window.__spell = {
      mode: () => 'normal',
      word: () => word, clue: () => clue,
      peekVisible: () => peekWord.style.visibility === 'visible',
      state: () => ({ wi, wrongChecks, hintsUsed }),
      peekHint, useLetterHint,
      typeCorrect: () => typeInto(spellArea, word),
      typeWord: (w) => typeInto(spellArea, w)
    };
  }

  // ---- Sound Twins rounds -----------------------------------------------------
  function playTwins(level) {
    clear(root);
    const items = pickTwins(level);
    let ii = 0, wrong = 0, hintsUsed = 0;
    let speller = null, current = null, phase = 'pick';

    shell = createGameShell({
      title: 'Sound Twins', rounds: items.length, accent: 'var(--star)',
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: useLetterHint
    });
    root.appendChild(shell.root);
    const guide = getState().guide;

    const sentenceCard = el('div', { class: 'twin-sentence' });
    const btnRow = el('div', { class: 'twin-options' });
    const explainEl = el('div', { class: 'twin-explain', style: { display: 'none' } });
    const spellArea = el('div', { class: 'spell-area', style: { display: 'none' } });
    shell.area.append(
      el('div', { class: 'twin-head' }, [el('div', { class: 'spell-guide', html: renderGuide(guide, { view: 'head', size: 64 }) }), sentenceCard]),
      btnRow, explainEl, spellArea
    );

    showItem();

    function showItem() {
      if (ii >= items.length) return finish();
      current = items[ii]; phase = 'pick';
      clear(sentenceCard); clear(btnRow); clear(spellArea);
      explainEl.style.display = 'none'; spellArea.style.display = 'none'; btnRow.style.display = '';
      // sentence with a styled blank
      const parts = current.sentence.split(/_+/);
      sentenceCard.append(el('span', { text: parts[0] }), el('span', { class: 'twin-blank', text: '?' }), el('span', { text: parts[1] || '' }));
      speakMaybe(current.sentence.replace(/_+/g, 'blank'));
      // big twin buttons
      shuffle(current.options.slice()).forEach(opt => {
        btnRow.appendChild(el('button', { class: 'btn twin-opt', text: opt, onclick: () => pick(opt) }));
      });
    }

    function pick(opt) {
      if (phase !== 'pick') return;
      if (opt === current.answer) { sfx.correct(); toSpell(false); return; }
      // wrong pick: explain the right twin, then spell it from memory
      wrong++; sfx.oops(); shell.dimHeart();
      explainEl.textContent = TWIN_EXPLAIN[current.answer] || '';
      explainEl.style.display = '';
      speakMaybe(TWIN_EXPLAIN[current.answer] || '');
      [...btnRow.querySelectorAll('.twin-opt')].forEach(b => { b.disabled = true; b.classList.toggle('right', b.textContent === current.answer); });
      setTimeout(() => toSpell(true), 1500);
    }

    function toSpell(afterWrong) {
      phase = 'spell';
      btnRow.style.display = 'none';
      // reveal the target for a beat, then spell from memory
      spellArea.style.display = '';
      shell.react(afterWrong ? 'Now spell it!' : 'Right! Now spell it from memory.', { voice: false, hold: 1500 });
      speller = makeSpeller(spellArea, current.answer, {
        onCorrect: onSpelled,
        onWrongCheck: () => { wrong++; shell.dimHeart(); }
      });
    }
    function useLetterHint() {
      if (phase !== 'spell' || hintsUsed >= MAX_HINTS || !speller) return;
      if (speller.hintNextLetter()) { hintsUsed++; shell.react(guideLine('hintSpell')); if (hintsUsed >= MAX_HINTS) shell.enableHint(false); }
    }
    function onSpelled() {
      mutate(s => { s.spellingMastery[current.answer] = (s.spellingMastery[current.answer] || 0) + 1; });
      shell.react('Sound Twin sorted! 🌟', { voice: false, hold: 1500 });
      setTimeout(() => { ii++; shell.advance(); showItem(); }, 1300);
    }
    function finish() {
      tts.cancel(); shell.cleanup();
      const stars = starsFor(wrong, hintsUsed);
      recordBest('spellboo', TWINS_KEY, stars);
      ctx.go('results', { game: 'spellboo', gameName: 'Sound Twins', stars, replay: () => ctx.go('spellboo') });
    }

    // test hook (invisible)
    if (typeof window !== 'undefined') window.__spell = {
      mode: () => 'twins',
      item: () => current, phase: () => phase,
      options: () => current ? current.options.slice() : [],
      pick, useLetterHint,
      state: () => ({ ii, wrong, hintsUsed }),
      typeCorrect: () => typeInto(spellArea, current.answer)
    };
  }

  // Choose 8 (or fewer) unique twin items for a level, gently preferring not-yet-mastered.
  function pickTwins(level) {
    const s = getState();
    const pool = twinItemsForLevel(level);
    const weighted = [];
    for (const it of pool) {
      const weight = (s.spellingMastery[it.answer] || 0) >= MASTERED_AT ? 1 : 3;
      for (let i = 0; i < weight; i++) weighted.push(it);
    }
    const chosen = [], guard = { n: 0 };
    while (chosen.length < Math.min(ROUND_WORDS, pool.length) && guard.n++ < 500) {
      const it = weighted[rand(weighted.length)];
      if (!chosen.some(x => x.sentence === it.sentence)) chosen.push(it);
    }
    return chosen;
  }

  return { unmount() { if (shell) shell.cleanup(); tts.cancel(); } };
}

// Headless helper: fill a speller's slots to spell `w` (used by tests only).
function typeInto(spellArea, w) {
  const tray = [...spellArea.querySelectorAll('.tile')];
  for (const ch of w.split('')) {
    const t = tray.find(n => n.textContent === ch && n.style.visibility !== 'hidden');
    if (t) t.click();
  }
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function speakerIcon() {
  return `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="var(--ink)"/><path d="M16 8c1.5 1.5 1.5 6.5 0 8" stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
}
