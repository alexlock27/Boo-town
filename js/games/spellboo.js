// js/games/spellboo.js — Game 3: Spell Boo (Year 3/4 spelling, spec §8).

import { el, clear, starsRow, wobble, sparkleAt } from '../ui.js';
import { getState, mutate } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import * as tts from '../tts.js';
import { WORDS, decoysFor } from '../../data/spelling.js';
import { BANKS } from '../../data/spellingBanks.js';
import { buildPicker, recordBest } from '../picker.js';

// Word sets: the Big List (statutory) + each themed bank (EXPANSION_1 §3.1).
const SETS = [{ key: 'big', name: 'The Big List', words: WORDS }, ...BANKS.map(b => ({ key: b.id, name: b.name, words: b.words }))];
const SET_BY_KEY = Object.fromEntries(SETS.map(s => [s.key, s]));
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
    const picker = buildPicker({
      game: 'spellboo',
      choices: SETS.map(s => ({ key: s.key, name: s.name })),
      levelsFor: (key) => tiersInSet(key),
      levelName: (l) => 'Level ' + l,
      onStart: (setKey, tier) => play(setKey, tier)
    });
    card.appendChild(picker.node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: at most one wrong check, no hints. (Peek is always free!)' })
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

  function play(setKey, tier) {
    clear(root);
    const words = pickWords(setKey, tier);
    let wi = 0, wrongChecks = 0, hintsUsed = 0, locked = false;

    shell = createGameShell({
      title: 'Spell Boo', rounds: words.length, accent: 'var(--star)',
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: doHint
    });
    root.appendChild(shell.root);

    const guide = getState().guide;

    // header: guide + prompt + speaker + peek
    const promptCard = el('div', { class: 'spell-prompt' });
    const slotsWrap = el('div', { class: 'slots-wrap' });
    const clueEl = el('div', { class: 'spell-clue', style: { display: 'none' } });
    const peekWord = el('div', { class: 'peek-word', style: { visibility: 'hidden' } });
    const trayWrap = el('div', { class: 'tray-wrap' });
    shell.area.append(promptCard, peekWord, slotsWrap, clueEl, trayWrap);

    let tiles = [];      // { letter, id, slot, locked, node }
    let slots = [];      // slot elements; slots[i].dataset holds tileId or empty
    let word = '';
    let clue = null;

    showWord();

    function showWord() {
      if (wi >= words.length) return finish();
      word = words[wi].w;
      clue = words[wi].clue || null;
      locked = false;
      clear(promptCard); clear(slotsWrap); clear(trayWrap);
      peekWord.style.visibility = 'hidden';
      // clue sentence (homophones etc.) — shown under the slots with the word as a blank
      if (clue) { clueEl.textContent = clue; clueEl.style.display = ''; } else { clueEl.style.display = 'none'; }

      // prompt row
      const speaker = el('button', { class: 'icon-btn speak-btn', 'aria-label': 'Say the word again', html: speakerIcon(), onclick: () => sayWord() });
      const peek = el('button', { class: 'btn soft peek-btn', text: '👀 Peek', onclick: () => doPeek() });
      promptCard.append(
        el('div', { class: 'spell-guide', html: renderGuide(guide, { view: 'head', size: 72 }) }),
        el('div', { class: 'spell-say' }, [ el('span', { text: 'Can you spell it?' }), speaker ]),
        peek
      );

      // slots
      slots = [];
      slotsWrap.dataset.word = word; // enables testing / accessibility
      for (let i = 0; i < word.length; i++) {
        const sl = el('div', { class: 'slot', dataset: { i: String(i) }, onclick: () => returnTile(i) });
        slots.push(sl); slotsWrap.appendChild(sl);
      }

      // tiles: word letters + 3 decoys, shuffled
      const letters = word.split('').concat(decoysFor(word));
      shuffle(letters);
      tiles = letters.map((letter, i) => {
        const node = el('button', { class: 'tile', text: letter, onclick: () => placeTile(t) });
        const t = { letter, id: 'T' + i, slot: null, locked: false, node };
        node._t = t;
        return t;
      });
      // fix closure: rebuild click handlers with correct tile refs
      tiles.forEach(t => { t.node.onclick = () => placeTile(t); trayWrap.appendChild(t.node); });

      sayWord();
    }

    function sayWord() {
      // Homophones sound alike, so for clued words read the clue sentence, not the word.
      if (clue) speakMaybe(clue.replace(/_+/g, 'blank'));
      else speakMaybe(`Can you spell... ${word}?`);
    }

    function doPeek() {
      // Peek is free (not a hint). Show the word clearly for 2s.
      peekWord.textContent = word;
      peekWord.style.visibility = 'visible';
      peekWord.classList.remove('pop'); void peekWord.offsetWidth; peekWord.classList.add('pop');
      sfx.tap();
      clearTimeout(doPeek._t);
      doPeek._t = setTimeout(() => { peekWord.style.visibility = 'hidden'; }, 2000);
    }

    function firstEmptySlot() { return slots.findIndex(s => !s.dataset.tile); }

    function placeTile(t) {
      if (locked || t.slot !== null) return;
      const i = firstEmptySlot();
      if (i < 0) return;
      t.slot = i;
      slots[i].dataset.tile = t.id;
      slots[i].textContent = t.letter;
      slots[i].classList.add('filled');
      t.node.style.visibility = 'hidden';
      sfx.tap();
      if (firstEmptySlot() < 0) setTimeout(check, 150);
    }

    function returnTile(i) {
      if (locked) return;
      const id = slots[i].dataset.tile;
      if (!id) return;
      const t = tiles.find(x => x.id === id);
      if (!t || t.locked) return;
      t.slot = null;
      delete slots[i].dataset.tile;
      slots[i].textContent = '';
      slots[i].classList.remove('filled');
      t.node.style.visibility = 'visible';
      sfx.tap();
    }

    function check() {
      const attempt = slots.map(s => s.textContent).join('');
      if (attempt === word) return onCorrect();
      // wrong: shake incorrect tiles and hop them back; keep correct-placed ones
      wrongChecks++;
      sfx.oops();
      locked = true;
      slots.forEach((sl, i) => {
        if (sl.textContent !== word[i]) {
          const id = sl.dataset.tile;
          const t = tiles.find(x => x.id === id);
          wobble(sl);
          setTimeout(() => {
            if (t && !t.locked) { t.slot = null; delete sl.dataset.tile; sl.textContent = ''; sl.classList.remove('filled'); t.node.style.visibility = 'visible'; }
          }, 400);
        }
      });
      shell.dimHeart();
      setTimeout(() => { locked = false; }, 450);
    }

    function doHint() {
      if (hintsUsed >= MAX_HINTS || locked) return;
      const i = firstEmptySlot();
      if (i < 0) return;
      hintsUsed++;
      const need = word[i];
      // consume a matching, unplaced tile if present
      const t = tiles.find(x => x.slot === null && x.letter === need && !x.locked);
      if (t) { t.slot = i; t.node.style.visibility = 'hidden'; }
      slots[i].dataset.tile = t ? t.id : 'hint';
      slots[i].textContent = need;
      slots[i].classList.add('filled', 'hinted');
      if (t) t.locked = true;
      shell.react(guideLine('hintSpell'));
      if (hintsUsed >= MAX_HINTS) shell.enableHint(false);
      if (firstEmptySlot() < 0) setTimeout(check, 200);
    }

    function onCorrect() {
      locked = true;
      sfx.correct();
      const r = slotsWrap.getBoundingClientRect();
      sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
      slotsWrap.classList.add('spelled');
      mutate(s => { s.spellingMastery[word] = (s.spellingMastery[word] || 0) + 1; });
      shell.react('Spelled it! 🌟', { voice: false, hold: 1600 });
      speakMaybe(`${word}. Brilliant!`);
      setTimeout(() => { slotsWrap.classList.remove('spelled'); wi++; shell.advance(); showWord(); }, 1400);
    }

    function finish() {
      tts.cancel();
      shell.cleanup();
      const stars = starsFor(wrongChecks, hintsUsed);
      recordBest('spellboo', setKey, stars);
      ctx.go('results', { game: 'spellboo', gameName: 'Spell Boo', stars, level: tier, replay: () => ctx.go('spellboo') });
    }
  }

  return { unmount() { if (shell) shell.cleanup(); tts.cancel(); } };
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function speakerIcon() {
  return `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="var(--ink)"/><path d="M16 8c1.5 1.5 1.5 6.5 0 8" stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
}
