// js/games/soundsorter.js — RUN16 W1: Sound Sorter (phonics).
//
// Feel goal: hearing a sound and finding it in a word should feel like SPOTTING something.
// So the six cards drift, a find pops and sparkles under her finger, and the round never
// hurries her — there is no timer anywhere in this file.
//
// Mechanic (RUN16 W1, exactly): a target phoneme is spoken and shown on a grapheme card;
// six picture cards drift gently; she taps every picture whose word CONTAINS that sound.
// Position varies by level — 1 initial, 2 final, 3 medial, 4 mixed with near-miss
// distractors. Rounds of 8 targets. Wrong taps wobble and the guide names what she tapped
// ("that's chip — ch, not sh!"), the Odd Boo Out explanation standard.
//
// G14 (works for a non-reader): the grapheme card carries the target with sound off, the
// pictures carry the words with sound off, and with sound on the guide names all six cards
// aloud on the first target and any time she taps the free "Say them again" button. No card
// ever prints its word — a printed word would turn a phonics round into a spelling hunt.

import { el, clear, starsRow, wobble, sparkleAt, backControl, REDUCED } from '../ui.js';
import { getState, recordResult } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import * as tts from '../tts.js';
import { buildPicker, recordBest, MIX_KEY } from '../picker.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { buildSmartMix } from '../smartmix.js';
import { createTrickyCollector, choiceMiss, pileBoost } from '../trickypile.js';
import { filterLevels } from '../content.js';
import { renderWordArt } from '../wordart.js';
import {
  PHONEMES, PHONEME_BY_KEY, SOUND_POOL, LEVEL_POSITION, LEVEL_NAME, SOUND_LEVELS,
  authoredAt, isLegalDistractor, soundsIn, positionsOf, targetsForLevel
} from '../../data/phonemes.js';

// The three picker cards. Twelve phonemes as twelve cards would break the eight-primary-
// buttons rule at phone width, so they group into three fours the way they are taught.
export const SOUND_GROUPS = [
  { key: 'pairs', name: 'Sound Pairs', sub: 'sh · ch · th · ng', sounds: ['sh', 'ch', 'th', 'ng'] },
  { key: 'teams', name: 'Vowel Teams', sub: 'ai · ee · oa · oo', sounds: ['ai', 'ee', 'oa', 'oo'] },
  { key: 'more',  name: 'More Sounds', sub: 'ar · or · igh · ow', sounds: ['ar', 'or', 'igh', 'ow'] }
];
const GROUP_BY_KEY = Object.fromEntries(SOUND_GROUPS.map(g => [g.key, g]));

const ROUND_TARGETS = 8;
const CARDS = 6;
const MAX_HINTS = 2;
const rand = (n) => (Math.random() * n) | 0;
const starsFor = (wrong, hints) => (hints === 0 && wrong <= 1) ? 3 : (wrong <= 4 ? 2 : 1);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Which levels a group can actually play: a level is offered only when the group holds a
// sound whose AUTHORED six give at least two words in that level's position. Nothing is
// ever offered that could not be built honestly from the authored lists.
export function levelsForGroup(groupKey) {
  const g = GROUP_BY_KEY[groupKey];
  if (!g) return SOUND_LEVELS.slice();
  return SOUND_LEVELS.filter(l => targetsForLevel(l).some(s => g.sounds.includes(s)));
}

// ---- round building (pure, so the 200-round assertion can call it directly) ------------
// Returns { sound, position, correct[], cards[] } or null when the level cannot be built.
export function buildTarget(sound, level) {
  const p = PHONEME_BY_KEY[sound];
  if (!p) return null;
  const positions = level === 4 ? ['initial', 'final', 'medial'] : [LEVEL_POSITION[level]];
  // level 4 picks whichever position this sound actually has words for
  const usable = positions.filter(pos => authoredAt(sound, pos).length >= 2);
  if (!usable.length) return null;
  const position = usable[rand(usable.length)];
  const pool = shuffle(authoredAt(sound, position));
  const wantCorrect = Math.min(pool.length, 2 + rand(2));   // 2 or 3
  const correct = pool.slice(0, wantCorrect);

  // Distractors: never share the target SOUND (in any position), never accent-fragile.
  // Level 4 fills from the authored near-miss list first — the confusable sounds — then
  // tops up from the rest of the pool if the near-miss list runs short.
  const legal = (w) => isLegalDistractor(w, sound) && !correct.includes(w);
  const picked = [];
  if (level === 4) for (const w of shuffle(p.nearMiss.slice())) { if (picked.length >= CARDS - correct.length) break; if (legal(w) && !picked.includes(w)) picked.push(w); }
  for (const w of shuffle(SOUND_POOL.slice())) {
    if (picked.length >= CARDS - correct.length) break;
    if (legal(w) && !picked.includes(w)) picked.push(w);
  }
  const cards = shuffle([...correct, ...picked]);

  // THE CONTAINMENT INVARIANT (RUN18A H1). A round finishes when she has found every word
  // in `correct`, so a "correct" word that was never dealt onto the board is an unwinnable
  // board: the counter can never move and she taps forever. The invariant is enforced HERE,
  // at generation, rather than by softening the finish threshold — a correct word missing
  // from the board is a generation bug, and lowering the threshold would hide it while
  // still marking a card she was never shown. If the filter empties `correct`, the target
  // is unbuildable and callers regenerate; an unwinnable board is never returned.
  const onBoard = correct.filter(w => cards.includes(w));
  if (!onBoard.length) return null;
  return { sound, position, correct: onBoard, cards };
}

export function buildRound(sounds, level, n = ROUND_TARGETS) {
  const eligible = sounds.filter(s => targetsForLevel(level).includes(s));
  if (!eligible.length) return [];
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < n * 40) {
    const s = eligible[rand(eligible.length)];
    // don't ask the same sound twice in a row when there is a choice
    if (eligible.length > 1 && out.length && out[out.length - 1].sound === s) continue;
    const t = buildTarget(s, level);
    if (t) out.push(t);
  }
  return out;
}

// The guide's line when a wrong card is tapped: name the word, and name the sound it
// really has. "that's chip — ch, not sh!" — the Odd Boo Out explanation standard.
export function missLine(word, target) {
  const others = soundsIn(word).filter(s => s !== target);
  if (!others.length) return `That's ${word} — no ${target} in that one!`;
  return `That's ${word} — ${others[0]}, not ${target}!`;
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen soundsorter' });
  container.appendChild(root);
  let shell = null;

  const rz = params && params.resume;
  if (rz && rz.mix) playMix();
  else if (rz && rz.cat && GROUP_BY_KEY[rz.cat]) play(rz.cat, rz.level);
  else startCard();
  maybeIntro('soundsorter');

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 96 }) }),
      el('h2', { text: 'Sound Sorter' }),
      el('p', { class: 'sc-intro', text: 'I say a sound — you find it hiding in the pictures!' })
    ]);
    card.appendChild(buildPicker({
      game: 'soundsorter',
      choices: SOUND_GROUPS.map(g => ({ key: g.key, name: g.name, sub: g.sub })),
      levelsFor: (key) => filterLevels(levelsForGroup(key)),
      levelName: (l) => LEVEL_NAME[l] || ('Level ' + l),
      onStart: (key, level) => (key === MIX_KEY ? playMix() : play(key, level))
    }).node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: at most one wrong tap, and no hints. Take all the time you like.' })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
  }

  function play(groupKey, level) {
    const g = GROUP_BY_KEY[groupKey];
    startRound(buildRound(g.sounds, level), { choice: groupKey, badgeKey: groupKey, level, title: 'Sound Sorter' });
  }
  // Smart Mix: every taught sound, weighted by the mistake ledger, at the levels each
  // sound can actually be asked at. Never tier-filtered — light UI, full brain.
  function playMix() {
    const pool = [];
    for (const p of PHONEMES) for (const l of SOUND_LEVELS) {
      if (!targetsForLevel(l).includes(p.key)) continue;
      pool.push({ id: 'soundsorter:' + p.key, sound: p.key, level: l, boost: pileBoost('soundsorter:' + p.key) });
    }
    const picked = buildSmartMix(pool, ROUND_TARGETS);
    const targets = picked.map(it => buildTarget(it.sound, it.level)).filter(Boolean);
    startRound(targets, { choice: MIX_KEY, badgeKey: MIX_KEY, level: null, title: 'Smart Mix' });
  }

  function startRound(targets, { choice, badgeKey, level, title }) {
    clear(root);
    if (!targets.length) return startCard();
    let idx = 0, wrong = 0, hintsUsed = 0, solved = 0;
    let found = new Set(), cardNodes = [], spoken = false;
    // The board on screen RIGHT NOW, and whether it is still taking taps. `idx` moves the
    // moment a target is finished, but the cards she is looking at stay up for the 900ms
    // celebration — so everything that reads the board reads `shown`, never `cur()`, and
    // nothing scores once `boardLive` is false. Without this, a tap during the celebration
    // was judged against the NEXT target: it cost a heart and the guide named a sound that
    // was not even on screen ("That's snail — ai, not th!" while the ch board was still up).
    let shown = null, boardLive = false;
    // See the note in rhymetime.js: `solved` ticks when she finishes a target, but the next
    // set of cards only appears after the celebration. This counts what is on screen.
    let renders = 0;

    shell = createGameShell({
      title, rounds: targets.length, accent: 'var(--pop)',
      onHelp: () => replayIntro('soundsorter'),
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: () => useHint(),
      bank: () => ({ correct: solved, of: targets.length })
    });
    root.appendChild(shell.root);
    const guide = getState().guide;

    const graphemeCard = el('div', { class: 'ss-grapheme', 'aria-live': 'polite' });
    const sayBtn = el('button', {
      class: 'btn soft ss-say', 'aria-label': 'Say the pictures again — always free',
      text: '🔊 Say them again', onclick: () => sayCards()
    });
    const prompt = el('div', { class: 'ss-prompt' }, [
      el('div', { class: 'ss-guide', html: renderGuide(guide, { view: 'head', size: 64 }) }),
      graphemeCard, sayBtn
    ]);
    const field = el('div', { class: 'ss-field' });
    shell.area.append(prompt, field);
    const collector = createTrickyCollector(shell.area);

    renderTarget();

    function cur() { return targets[idx]; }

    function renderTarget() {
      const t = cur();
      shown = t;
      boardLive = true;
      found = new Set();
      renders++;
      clear(graphemeCard); clear(field);
      graphemeCard.append(
        el('div', { class: 'ss-card-letters', text: PHONEME_BY_KEY[t.sound].card }),
        el('div', { class: 'ss-card-tip', text: whereLabel(t.position) })
      );
      cardNodes = t.cards.map((w, i) => {
        const btn = el('button', {
          class: 'ss-card', 'aria-label': w, dataset: { word: w },
          style: REDUCED ? {} : { '--dly': (i * 0.37).toFixed(2) + 's', '--dur': (5.2 + (i % 3) * 0.9).toFixed(2) + 's' },
          onclick: () => tapCard(t, w, btn)
        }, [el('span', { class: 'ss-pic', html: renderWordArt(w, { size: 92, label: w }) })]);
        field.appendChild(btn);
        return btn;
      });
      shell.setProgress(idx);
      const p = PHONEME_BY_KEY[t.sound];
      shell.react(`Find the ${p.card} sound — ${p.say}!`, { voice: false, hold: 2400 });
      speakMaybe(`Find the words with ${p.say}. ${p.say}.`);
      // the first target names every picture aloud, so a child who cannot read still knows
      // what she is looking at; after that the free button repeats it on demand.
      if (!spoken) { spoken = true; shell.timeout(() => sayCards(), 2200); }
    }

    function whereLabel(pos) {
      return pos === 'initial' ? 'at the start' : pos === 'final' ? 'at the end' : 'in the middle';
    }

    // Free, unlimited, never disabled: it repeats only what she was already shown.
    function sayCards() {
      sfx.tap();
      const words = shown.cards;
      speakMaybe(words.join('. ') + '.');
      if (REDUCED) return;
      words.forEach((w, i) => shell.timeout(() => {
        const n = cardNodes[i];
        if (!n) return;
        n.classList.remove('named'); void n.offsetWidth; n.classList.add('named');
      }, i * 620));
    }

    // `t` is the target this card was DEALT for, handed in at render time — never cur().
    function tapCard(t, word, node) {
      if (!boardLive || t !== shown) return;
      if (found.has(word) || node.disabled) return;
      const isRight = t.correct.includes(word);
      if (isRight) {
        found.add(word);
        node.classList.add('found');
        node.disabled = true;
        sfx.correct();
        recordResult('soundsorter:' + t.sound, true);
        const r = node.getBoundingClientRect();
        if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
        if (found.size >= t.correct.length) finishTarget();
        else shell.react(`Yes — ${word}!`, { voice: false, hold: 1200 });
      } else {
        wrong++;
        shell.dimHeart();
        sfx.oops();
        wobble(node);
        recordResult('soundsorter:' + t.sound, false);
        collector.addAttempted(phonemeMiss(t));
        const line = missLine(word, t.sound);
        shell.react(line, { voice: false, hold: 2600 });
        speakMaybe(line);
      }
    }

    function finishTarget() {
      // The board is closed the instant it is won: every tile goes quiet, including the
      // ones she never tapped. She has finished this one — there is nothing left here to
      // be wrong about, and the celebration is not a place to lose a heart.
      boardLive = false;
      cardNodes.forEach(n => { n.disabled = true; });
      solved++;
      shell.react('All of them! 🌟', { voice: false, hold: 1200 });
      sfx.star();
      shell.advance();
      idx++;
      if (idx >= targets.length) shell.timeout(finish, 900);
      else shell.timeout(renderTarget, 900);
    }

    function useHint() {
      if (hintsUsed >= MAX_HINTS || !boardLive) return;
      const t = shown;
      const next = t.correct.find(w => !found.has(w));
      if (!next) return;
      hintsUsed++;
      if (hintsUsed >= MAX_HINTS) shell.enableHint(false);
      const node = cardNodes[t.cards.indexOf(next)];
      if (node) { node.classList.remove('nudge'); void node.offsetWidth; node.classList.add('nudge'); }
      shell.react('This one is hiding it!', { voice: false, hold: 1600 });
    }

    function finish() {
      tts.cancel();
      shell.cleanup();
      const stars = starsFor(wrong, hintsUsed);
      recordBest('soundsorter', badgeKey, stars);
      ctx.go('results', {
        game: 'soundsorter', gameName: choice === MIX_KEY ? 'Smart Mix' : 'Sound Sorter',
        stars, level, cat: choice === MIX_KEY ? null : choice, mix: choice === MIX_KEY,
        tricky: collector.items(), replay: () => ctx.go('soundsorter')
      });
    }

    // QA hooks read the board she is looking at (`shown`), not the sequence cursor, so a
    // suite driving the game sees exactly what a child's finger would reach.
    if (typeof window !== 'undefined') window.__sounds = {
      state: () => ({ idx, wrong, hintsUsed, solved, renders, total: targets.length, live: boardLive }),
      target: () => ({ ...shown, found: [...found] }),
      cards: () => shown.cards.slice(),
      tap: (w) => { const i = shown.cards.indexOf(w); if (i >= 0) cardNodes[i].click(); },
      tapCorrect: () => { const w = shown.correct.find(x => !found.has(x)); if (w) window.__sounds.tap(w); },
      tapWrong: () => { const t = shown; const w = t.cards.find(x => !t.correct.includes(x)); if (w) window.__sounds.tap(w); },
      solveTarget: () => { const t = shown; t.correct.forEach(w => { if (!found.has(w)) window.__sounds.tap(w); }); },
      hint: () => useHint(),
      sayCards: () => sayCards(),
      tapAny: (w) => { const i = shown.cards.indexOf(w); if (i >= 0) cardNodes[i].dispatchEvent(new MouseEvent('click', { bubbles: true })); },
      grapheme: () => graphemeCard.querySelector('.ss-card-letters').textContent,
      collected: () => collector.items().length
    };
  }

  return { unmount() { if (shell) shell.cleanup(); tts.cancel(); } };
}

// A missed phoneme goes to the Tricky Pile as a re-askable recognition item: three words,
// one of which really does hold the sound. Pictures come from the same library, so the
// rescue works for a non-reader too (js/trickypile.js renders art when `art` is set).
export function phonemeMiss(target) {
  const p = PHONEME_BY_KEY[target.sound];
  const answer = target.correct[0];
  const decoys = target.cards.filter(w => !target.correct.includes(w)).slice(0, 2);
  const options = [answer, ...decoys];
  return {
    ...choiceMiss({ id: 'soundsorter:' + target.sound, game: 'soundsorter', prompt: `Which word has the ${p.card} sound?`, options, answer }),
    pics: Object.fromEntries(options.map(w => [w, renderWordArt(w, { size: 74, label: w })])),
    say: `Which word has the ${p.say} sound?`
  };
}
export { positionsOf };
