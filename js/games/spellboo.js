// js/games/spellboo.js — Game 3: Spell Boo (Year 3/4 spelling, spec §8 + RUN3 C1/C2).
//
// C1: auto-look (free 2s look) replaces free Peek; Peek is now a hint (2-hint budget,
//     caps stars at 2); clue/homophone words never auto-show; Sound Twins mode; Tricky Sounds.
// C2: every answer feeds the mistake ledger; Smart Mix is the first picker card and draws
//     a weak-weighted mix of words + twin sets from ALL installed content; missed items go
//     to the Tricky Pile (Puzzled Boo) and are offered back on the results screen.

import { el, clear, starsRow, wobble, sparkleAt } from '../ui.js';
import { getState, mutate, recordResult } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import * as tts from '../tts.js';
import { WORDS, decoysFor } from '../../data/spelling.js';
import { BANKS } from '../../data/spellingBanks.js';
import { TWIN_SETS, TWIN_EXPLAIN, TWIN_LEVELS, twinItemsForLevel } from '../../data/soundTwins.js';
import { buildPicker, recordBest, MIX_KEY } from '../picker.js';
import { buildSmartMix } from '../smartmix.js';
import { createTrickyCollector, wordMiss } from '../trickypile.js';
import { makeSpeller, typeInto } from '../speller.js';

const SETS = [{ key: 'big', name: 'The Big List', words: WORDS }, ...BANKS.map(b => ({ key: b.id, name: b.name, words: b.words }))];
const SET_BY_KEY = Object.fromEntries(SETS.map(s => [s.key, s]));
const TWINS_KEY = 'twins';
const TH_WORDS = new Set((BANKS.find(b => b.id === 'trickyTh') || { words: [] }).words.map(w => w.w));
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
    const choices = [...SETS.map(s => ({ key: s.key, name: s.name })), { key: TWINS_KEY, name: '🔤 Sound Twins' }];
    const picker = buildPicker({
      game: 'spellboo',
      choices,
      levelsFor: (key) => (key === TWINS_KEY ? TWIN_LEVELS : tiersInSet(key)),
      levelName: (l) => 'Level ' + l,
      onStart: (key, level) => (key === MIX_KEY ? playMix() : key === TWINS_KEY ? playTwins(level) : play(key, level))
    });
    card.appendChild(picker.node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: at most one wrong check, no hints. (The word shows first — that peek is free!)' })
    ]));
    root.appendChild(card);
  }

  function pickWords(setKey, tier) {
    const s = getState();
    const pool = (SET_BY_KEY[setKey] || SET_BY_KEY.big).words.filter(w => w.t === tier);
    const weighted = [];
    for (const wo of pool) { const weight = (s.spellingMastery[wo.w] || 0) >= MASTERED_AT ? 1 : 3; for (let i = 0; i < weight; i++) weighted.push(wo); }
    const chosen = []; let guard = 0;
    while (chosen.length < Math.min(ROUND_WORDS, pool.length) && guard++ < 500) {
      const wo = weighted[rand(weighted.length)];
      if (!chosen.some(x => x.w === wo.w)) chosen.push(wo);
    }
    return chosen;
  }

  // ---- Smart Mix pool: every word + every twin set from ALL installed content ----
  // (never tier-filtered — light UI, full brain). Twins and th words boost 2 while weak.
  function buildMixItems() {
    const pool = [];
    for (const set of SETS) for (const wo of set.words) {
      if (pool.some(p => p.kind === 'word' && p.word === wo.w)) continue; // dedupe shared words
      pool.push({ id: wo.w, kind: 'word', word: wo.w, clue: wo.clue || null, boost: TH_WORDS.has(wo.w) ? 2 : 1 });
    }
    for (const set of TWIN_SETS) pool.push({ id: 'twin:' + set.id, kind: 'twin', setId: set.id, boost: 2 });
    const picked = buildSmartMix(pool, ROUND_WORDS);
    // expand a twin pool item into a concrete sentence item
    return picked.map(p => p.kind === 'twin' ? twinItemFromSet(p.setId) : p);
  }
  function twinItemFromSet(setId) {
    const set = TWIN_SETS.find(s => s.id === setId);
    const it = set.items[rand(set.items.length)];
    return { id: 'twin:' + setId, kind: 'twin', setId, options: set.options, sentence: it.s, answer: it.a };
  }

  // ---- one round engine (shared by normal, twins and mix) ---------------------
  function startRound(items, { choice, badgeKey }) {
    clear(root);
    let idx = 0, wrong = 0, hintsUsed = 0;
    let curHint = null;                 // the current item's hint handler
    shell = createGameShell({
      title: choice === TWINS_KEY ? 'Sound Twins' : choice === MIX_KEY ? 'Smart Mix' : 'Spell Boo',
      rounds: items.length, accent: 'var(--star)',
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: () => { if (curHint) curHint(); }
    });
    root.appendChild(shell.root);
    const guide = getState().guide;
    const stage = el('div', { class: 'spell-stage' });
    shell.area.appendChild(stage);
    const collector = createTrickyCollector(shell.area);
    let curItemHooks = null;            // hooks for whichever item is active (tests)

    // shared hint budget across the round
    function canHint() { return hintsUsed < MAX_HINTS; }
    function spendHint() { hintsUsed++; if (hintsUsed >= MAX_HINTS) shell.enableHint(false); }

    runNext();

    function runNext() {
      if (idx >= items.length) return finish();
      clear(stage); curHint = null;
      const item = items[idx];
      if (item.kind === 'twin') runTwinItem(item); else runWordItem(item);
    }
    function itemDone() { idx++; shell.advance(); setTimeout(runNext, 200); }

    function onMiss(id, missItem) { wrong++; shell.dimHeart(); recordResult(id, false); if (missItem) collector.add(missItem); }
    function onHitLedger(id) { recordResult(id, true); }

    // --- a normal / mix word item ---
    function runWordItem(item) {
      const word = item.word, clue = item.clue || null;
      const promptCard = el('div', { class: 'spell-prompt' });
      const clueEl = el('div', { class: 'spell-clue', style: { display: clue ? '' : 'none' } });
      if (clue) clueEl.textContent = clue;
      const peekWord = el('div', { class: 'peek-word', style: { visibility: 'hidden' } });
      const area = el('div', { class: 'spell-area' });
      const speaker = el('button', { class: 'icon-btn speak-btn', 'aria-label': 'Say the word again', html: speakerIcon(), onclick: () => say() });
      const peekBtn = el('button', { class: 'btn soft peek-btn', text: '👀 Peek (hint)', onclick: () => peekHint() });
      if (!canHint()) peekBtn.disabled = true;
      promptCard.append(
        el('div', { class: 'spell-guide', html: renderGuide(guide, { view: 'head', size: 72 }) }),
        el('div', { class: 'spell-say' }, [el('span', { text: 'Can you spell it?' }), speaker]),
        peekBtn
      );
      stage.append(promptCard, peekWord, clueEl, area);

      const speller = makeSpeller(area, word, {
        onCorrect: () => { onHitLedger(word); mutate(s => { s.spellingMastery[word] = (s.spellingMastery[word] || 0) + 1; }); shell.react('Spelled it! 🌟', { voice: false, hold: 1500 }); speakMaybe(`${word}. Brilliant!`); setTimeout(itemDone, 1300); },
        onWrongCheck: () => onMiss(word, wordMiss(word))
      });

      curHint = () => { if (canHint() && speller.hintNextLetter()) { spendHint(); shell.react(guideLine('hintSpell')); if (!canHint()) peekBtn.disabled = true; } };
      function peekHint() { if (!canHint() || speller.isLocked()) return; spendHint(); sfx.tap(); reveal(); shell.react('A peek! That counts as a hint.', { voice: false, hold: 1400 }); if (!canHint()) peekBtn.disabled = true; }
      function reveal() { peekWord.textContent = word; peekWord.style.visibility = 'visible'; peekWord.classList.remove('pop'); void peekWord.offsetWidth; peekWord.classList.add('pop'); clearTimeout(reveal._t); reveal._t = setTimeout(() => { peekWord.style.visibility = 'hidden'; }, 2000); }
      function say() { if (clue) speakMaybe(clue.replace(/_+/g, 'blank')); else speakMaybe(`Can you spell... ${word}?`); }
      if (!clue) reveal();            // auto-look (free) for normal words
      say();
      curItemHooks = { kind: 'word', word: () => word, peekVisible: () => peekWord.style.visibility === 'visible', typeCorrect: () => typeInto(area, word), typeWrong: () => typeInto(area, word.split('').reverse().join('')), peekHint };
    }

    // --- a Sound Twins item ---
    function runTwinItem(item) {
      let phase = 'pick';
      const head = el('div', { class: 'twin-head' }, [el('div', { class: 'spell-guide', html: renderGuide(guide, { view: 'head', size: 64 }) })]);
      const sentenceCard = el('div', { class: 'twin-sentence' });
      head.appendChild(sentenceCard);
      const btnRow = el('div', { class: 'twin-options' });
      const explainEl = el('div', { class: 'twin-explain', style: { display: 'none' } });
      const area = el('div', { class: 'spell-area', style: { display: 'none' } });
      stage.append(head, btnRow, explainEl, area);
      const parts = item.sentence.split(/_+/);
      sentenceCard.append(el('span', { text: parts[0] }), el('span', { class: 'twin-blank', text: '?' }), el('span', { text: parts[1] || '' }));
      speakMaybe(item.sentence.replace(/_+/g, 'blank'));
      shuffle(item.options.slice()).forEach(opt => btnRow.appendChild(el('button', { class: 'btn twin-opt', text: opt, onclick: () => pick(opt) })));

      function pick(opt) {
        if (phase !== 'pick') return;
        if (opt === item.answer) { sfx.correct(); recordResult('twin:' + item.setId, true); toSpell(false); return; }
        // wrong pick: onMiss counts one wrong, dims a heart, records the twin ledger miss and collects it
        sfx.oops();
        onMiss('twin:' + item.setId, twinMissItem(item));
        explainEl.textContent = TWIN_EXPLAIN[item.answer] || ''; explainEl.style.display = '';
        speakMaybe(TWIN_EXPLAIN[item.answer] || '');
        [...btnRow.querySelectorAll('.twin-opt')].forEach(b => { b.disabled = true; b.classList.toggle('right', b.textContent === item.answer); });
        setTimeout(() => toSpell(true), 1500);
      }
      function toSpell(afterWrong) {
        phase = 'spell'; btnRow.style.display = 'none'; area.style.display = '';
        shell.react(afterWrong ? 'Now spell it!' : 'Right! Now spell it from memory.', { voice: false, hold: 1400 });
        const speller = makeSpeller(area, item.answer, {
          onCorrect: () => { mutate(s => { s.spellingMastery[item.answer] = (s.spellingMastery[item.answer] || 0) + 1; }); shell.react('Sound Twin sorted! 🌟', { voice: false, hold: 1400 }); setTimeout(itemDone, 1200); },
          onWrongCheck: () => { wrong++; shell.dimHeart(); }
        });
        curHint = () => { if (canHint() && speller.hintNextLetter()) { spendHint(); shell.react(guideLine('hintSpell')); } };
      }
      curItemHooks = { kind: 'twin', item: () => item, phase: () => phase, options: () => item.options.slice(), pick, typeCorrect: () => typeInto(area, item.answer) };
    }

    function finish() {
      tts.cancel(); shell.cleanup();
      const stars = starsFor(wrong, hintsUsed);
      recordBest('spellboo', badgeKey, stars);
      const gameName = choice === TWINS_KEY ? 'Sound Twins' : choice === MIX_KEY ? 'Smart Mix' : 'Spell Boo';
      ctx.go('results', { game: 'spellboo', gameName, stars, tricky: collector.items(), replay: () => ctx.go('spellboo') });
    }

    // expose current-item hooks for tests
    if (typeof window !== 'undefined') window.__spell = {
      mode: () => choice === MIX_KEY ? 'mix' : choice === TWINS_KEY ? 'twins' : 'normal',
      state: () => ({ idx, wrong, hintsUsed }),
      // proxies to whichever item is active
      item: () => curItemHooks && curItemHooks.item && curItemHooks.item(),
      phase: () => curItemHooks && curItemHooks.phase ? curItemHooks.phase() : 'spell',
      options: () => curItemHooks && curItemHooks.options ? curItemHooks.options() : [],
      pick: (o) => curItemHooks && curItemHooks.pick && curItemHooks.pick(o),
      word: () => curItemHooks && curItemHooks.word && curItemHooks.word(),
      peekVisible: () => curItemHooks && curItemHooks.peekVisible ? curItemHooks.peekVisible() : false,
      peekHint: () => curItemHooks && curItemHooks.peekHint && curItemHooks.peekHint(),
      useLetterHint: () => { if (curHint) curHint(); },
      curKind: () => curItemHooks && curItemHooks.kind,
      typeCorrect: () => curItemHooks && curItemHooks.typeCorrect && curItemHooks.typeCorrect(),
      typeWrong: () => curItemHooks && curItemHooks.typeWrong && curItemHooks.typeWrong(),
      collected: () => collector.items().length
    };
  }

  function play(setKey, tier) { startRound(pickWords(setKey, tier).map(w => ({ kind: 'word', word: w.w, clue: w.clue || null })), { choice: setKey, badgeKey: setKey }); }
  function playTwins(level) { startRound(pickTwins(level), { choice: TWINS_KEY, badgeKey: TWINS_KEY }); }
  function playMix() { startRound(buildMixItems(), { choice: MIX_KEY, badgeKey: MIX_KEY }); }

  function pickTwins(level) {
    const s = getState();
    const pool = twinItemsForLevel(level).map(it => ({ ...it, kind: 'twin' }));
    const weighted = [];
    for (const it of pool) { const weight = (s.spellingMastery[it.answer] || 0) >= MASTERED_AT ? 1 : 3; for (let i = 0; i < weight; i++) weighted.push(it); }
    const chosen = []; let guard = 0;
    while (chosen.length < Math.min(ROUND_WORDS, pool.length) && guard++ < 500) {
      const it = weighted[rand(weighted.length)];
      if (!chosen.some(x => x.sentence === it.sentence)) chosen.push(it);
    }
    return chosen;
  }

  return { unmount() { if (shell) shell.cleanup(); tts.cancel(); } };
}

function twinMissItem(item) {
  // re-askable recognition: the same sentence + twin options.
  return { id: 'twin:' + item.setId, game: 'spellboo', prompt: item.sentence.replace(/_+/g, '____'), options: item.options.slice(0, 3), answer: item.answer };
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function speakerIcon() { return `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="var(--ink)"/><path d="M16 8c1.5 1.5 1.5 6.5 0 8" stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`; }
