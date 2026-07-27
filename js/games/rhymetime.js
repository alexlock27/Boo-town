// js/games/rhymetime.js — RUN16 W3: Rhyme Time (rhyme and word families).
//
// Feel goal: rhymes are a game children already play; this one should feel like a joke
// landing. So a solved set does not just tick — the three rhyming words are said back in
// rhythm while their cards bounce in time, which is exactly what a child does when she
// notices a rhyme herself.
//
// Mechanic (RUN16 W3, exactly): a word is shown and spoken; four picture-word cards; tap
// the two that rhyme with it. Level 2 adds a near-miss that shares a letter pattern but
// not the sound. Level 3 asks her to complete a two-line rhyming couplet by choosing the
// last word.
//
// G14: every card is a picture with the word beneath it, every word is spoken, and the
// couplet is read aloud — a child who cannot read the couplet can still hear the rhyme and
// choose from three pictures.

import { el, clear, starsRow, sparkleAt, backControl, REDUCED } from '../ui.js';
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
  RHYME_FAMILIES, FAMILY_BY_KEY, COUPLETS, RHYME_LEVELS, RHYME_LEVEL_NAME,
  rhymersOf, rhymeKeyOf, rhymesTogether, artKeyFor, spellingOddOf
} from '../../data/rhymes.js';

const ROUND_TARGETS = 8;
const CARDS = 4;
const CORRECT_PER_TARGET = 2;
const MAX_HINTS = 2;
const rand = (n) => (Math.random() * n) | 0;
const starsFor = (wrong, hints) => (hints === 0 && wrong <= 1) ? 3 : (wrong <= 3 ? 2 : 1);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// A family can host a target only if it has the target plus two more rhymers to find.
const HOSTABLE = RHYME_FAMILIES.filter(f => rhymersOf(f).length >= CORRECT_PER_TARGET + 1);

// ---- round building (pure, so the rules can be checked without a browser round) --------
export function buildRhymeTarget(familyKey, level) {
  const fam = FAMILY_BY_KEY[familyKey];
  if (!fam) return null;
  const members = shuffle(rhymersOf(fam));
  if (members.length < CORRECT_PER_TARGET + 1) return null;
  const target = members[0];
  const correct = members.slice(1, 1 + CORRECT_PER_TARGET);
  const decoys = [];
  // level 2 always shows the family's near-miss: a word that looks like it belongs and
  // does not rhyme. Level 1 uses plain non-rhyming words from other families.
  if (level === 2) decoys.push(fam.nearMiss);
  const otherPool = shuffle(HOSTABLE.filter(f => f.key !== fam.key).flatMap(f => rhymersOf(f)));
  for (const w of otherPool) {
    if (decoys.length >= CARDS - CORRECT_PER_TARGET) break;
    if (decoys.includes(w) || w === target || correct.includes(w)) continue;
    if (rhymesTogether(w, target)) continue;   // belt and braces: never a second right answer
    decoys.push(w);
  }
  return { kind: 'rhyme', family: fam.key, target, correct, nearMiss: level === 2 ? fam.nearMiss : null, cards: shuffle([...correct, ...decoys]) };
}

export function buildCoupletTarget(i) {
  const c = COUPLETS[i % COUPLETS.length];
  return { kind: 'couplet', index: i % COUPLETS.length, lines: c.lines, answer: c.answer, cards: shuffle([c.answer, ...c.decoys]) };
}

export function buildRhymeRound(level, n = ROUND_TARGETS) {
  if (level === 3) return shuffle(COUPLETS.map((_, i) => i)).slice(0, Math.min(n, COUPLETS.length)).map(buildCoupletTarget);
  const out = [];
  const keys = shuffle(HOSTABLE.map(f => f.key));
  let guard = 0;
  while (out.length < n && guard++ < n * 40) {
    const key = keys[out.length % keys.length];
    const t = buildRhymeTarget(key, level);
    if (t) out.push(t);
  }
  return out;
}

// The guide's line for a wrong tap: say both words so the ear can hear they do not match.
export function rhymeMissLine(word, target, isNearMiss) {
  if (isNearMiss) return `Careful — ${word} LOOKS like ${target}, but listen: ${target}... ${word}. No rhyme!`;
  return `Listen: ${target}... ${word}. They don't rhyme!`;
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen rhymetime' });
  container.appendChild(root);
  let shell = null;

  const rz = params && params.resume;
  if (rz && rz.mix) playMix();
  else if (rz && rz.level) play(rz.level);
  else startCard();
  maybeIntro('rhymetime');

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 96 }) }),
      el('h2', { text: 'Rhyme Time' }),
      el('p', { class: 'sc-intro', text: 'Cat, hat, mat! Find the words that sound the same at the end.' })
    ]);
    card.appendChild(buildPicker({
      game: 'rhymetime',
      choices: [{ key: 'rhyme', name: 'Rhyme Time', sub: 'cat · hat · mat' }],
      levelsFor: () => filterLevels(RHYME_LEVELS),
      levelName: (l) => RHYME_LEVEL_NAME[l] || ('Level ' + l),
      onStart: (key, level) => (key === MIX_KEY ? playMix() : play(level))
    }).node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: at most one wrong tap, and no hints. Nothing is timed.' })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
  }

  function play(level) { startRound(buildRhymeRound(level), { badgeKey: 'L' + level, level, title: 'Rhyme Time' }); }
  // Smart Mix: every family plus the couplets, weighted by the mistake ledger.
  function playMix() {
    const pool = [
      ...HOSTABLE.map(f => ({ id: 'rhymetime:' + f.key, family: f.key, boost: pileBoost('rhymetime:' + f.key) })),
      ...COUPLETS.map((c, i) => ({ id: 'rhymetime:cp:' + c.answer, couplet: i, boost: pileBoost('rhymetime:cp:' + c.answer) }))
    ];
    const items = buildSmartMix(pool, ROUND_TARGETS)
      .map(it => (it.couplet != null ? buildCoupletTarget(it.couplet) : buildRhymeTarget(it.family, 1 + rand(2))))
      .filter(Boolean);
    startRound(items, { badgeKey: MIX_KEY, level: null, title: 'Smart Mix', mix: true });
  }

  function startRound(targets, { badgeKey, level, title, mix = false }) {
    clear(root);
    if (!targets.length) return startCard();
    let idx = 0, wrong = 0, hintsUsed = 0, solved = 0;
    let found = new Set(), cardNodes = [];
    // Incremented every time a target's cards are actually on screen. `solved` ticks the
    // moment she finishes a set, but the NEXT set only appears after the celebration —
    // so anything waiting for "ready to play" must watch this, not the score.
    let renders = 0;

    shell = createGameShell({
      title, rounds: targets.length, accent: 'var(--star)',
      onHelp: () => replayIntro('rhymetime'),
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: () => useHint(),
      bank: () => ({ correct: solved, of: targets.length })
    });
    root.appendChild(shell.root);
    const guide = getState().guide;
    const stage = el('div', { class: 'rt-stage' });
    shell.area.appendChild(stage);
    const collector = createTrickyCollector(shell.area);

    renderTarget();
    function cur() { return targets[idx]; }

    function pictureCard(word, onTap) {
      const key = artKeyFor(word);
      const b = el('button', {
        class: 'pic-card rt-card', 'aria-label': word, dataset: { word },
        onclick: () => onTap(word, b)
      }, [
        el('span', { html: renderWordArt(key, { size: 88, label: word }) }),
        el('span', { class: 'rt-cardword', text: word })
      ]);
      return b;
    }

    function renderTarget() {
      found = new Set();
      renders++;
      clear(stage);
      shell.setProgress(idx);
      const t = cur();
      if (t.kind === 'couplet') return renderCouplet(t);
      // ---- levels 1 and 2: tap the two that rhyme ----
      const head = el('div', { class: 'rt-target' }, [
        el('div', { class: 'ss-guide', html: renderGuide(guide, { view: 'head', size: 60 }) }),
        el('span', { html: renderWordArt(t.target, { size: 72, label: t.target }) }),
        el('div', { class: 'rt-word', text: t.target }),
        el('button', { class: 'btn soft ss-say', text: '🔊 Say it again', 'aria-label': 'Hear the word again — always free', onclick: () => { sfx.tap(); speakMaybe(t.target); } })
      ]);
      const count = el('div', { class: 'rt-count', text: `Find ${CORRECT_PER_TARGET} that rhyme with ${t.target}` });
      const cards = el('div', { class: 'rt-cards' });
      cardNodes = t.cards.map(w => { const n = pictureCard(w, tapCard); cards.appendChild(n); return n; });
      stage.append(head, count, cards);
      shell.react(`Which two rhyme with ${t.target}?`, { voice: false, hold: 2400 });
      speakMaybe(`${t.target}. Which two rhyme with ${t.target}?`);
    }

    function tapCard(word, node) {
      const t = cur();
      if (found.has(word) || node.disabled) return;
      if (t.correct.includes(word)) {
        found.add(word);
        node.classList.add('picked');
        node.disabled = true;
        sfx.correct();
        recordResult('rhymetime:' + t.family, true);
        const r = node.getBoundingClientRect();
        if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
        // the authored kite card: it rhymes, and the guide explains why it looks odd
        const odd = spellingOddOf(FAMILY_BY_KEY[t.family]);
        if (word === odd) {
          const line = FAMILY_BY_KEY[t.family].spellingOddLine;
          shell.react(line, { voice: false, hold: 3000 });
          speakMaybe(line);
        }
        if (found.size >= t.correct.length) shell.timeout(landTheJoke, 400);
      } else {
        wrong++;
        shell.dimHeart();
        sfx.oops();
        node.classList.remove('miss'); void node.offsetWidth; node.classList.add('miss');
        recordResult('rhymetime:' + t.family, false);
        collector.addAttempted(rhymeMiss(t));
        const line = rhymeMissLine(word, t.target, word === t.nearMiss);
        shell.react(line, { voice: false, hold: 3000 });
        speakMaybe(line);
      }
    }

    // The punchline: the three rhyming words said back in rhythm, cards bouncing in time.
    function landTheJoke() {
      const t = cur();
      const words = [t.target, ...t.correct];
      speakMaybe(words.join('... ') + '!');
      sfx.star();
      if (!REDUCED) {
        [...cardNodes.filter(n => found.has(n.dataset.word))].forEach((n, i) => shell.timeout(() => {
          n.classList.remove('bounce'); void n.offsetWidth; n.classList.add('bounce');
        }, 380 + i * 380));
      }
      shell.react(`${words.join(', ')} — they all rhyme! 🌟`, { voice: false, hold: 2000 });
      solved++;
      shell.advance();
      idx++;
      shell.timeout(() => (idx >= targets.length ? finish() : renderTarget()), REDUCED ? 700 : 1700);
    }

    // ---- level 3: finish the couplet ----
    function renderCouplet(t) {
      const spoken = t.lines.join(' ').replace(/_+/, 'mmm');
      const verse = el('div', { class: 'rt-couplet' });
      verse.append(
        el('div', { text: t.lines[0] }),
        el('div', {}, [
          el('span', { text: t.lines[1].replace(/_+/, '') }),
          el('span', { class: 'rt-gap', text: '?' })
        ])
      );
      const say = el('button', {
        class: 'btn soft ss-say', text: '🔊 Read it again', 'aria-label': 'Hear the rhyme again — always free',
        onclick: () => { sfx.tap(); speakMaybe(spoken); }
      });
      const cards = el('div', { class: 'rt-cards three' });
      cardNodes = t.cards.map(w => { const n = pictureCard(w, tapCouplet); cards.appendChild(n); return n; });
      stage.append(el('div', { class: 'rt-target' }, [el('div', { class: 'ss-guide', html: renderGuide(guide, { view: 'head', size: 60 }) }), say]), verse, cards);
      shell.react('Which word finishes the rhyme?', { voice: false, hold: 2400 });
      speakMaybe(spoken);

      function tapCouplet(word, node) {
        if (node.disabled) return;
        if (word === t.answer) {
          node.classList.add('picked');
          cardNodes.forEach(n => { n.disabled = true; });
          const gapEl = verse.querySelector('.rt-gap');
          gapEl.textContent = word;
          gapEl.classList.add('filled');
          sfx.star();
          recordResult('rhymetime:cp:' + t.answer, true);
          const r = node.getBoundingClientRect();
          if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
          speakMaybe(t.lines.join(' ').replace(/_+/, word));
          shell.react('That\'s the one! 🌟', { voice: false, hold: 1600 });
          solved++;
          shell.advance();
          idx++;
          shell.timeout(() => (idx >= targets.length ? finish() : renderTarget()), REDUCED ? 800 : 2200);
        } else {
          wrong++;
          shell.dimHeart();
          sfx.oops();
          node.classList.remove('miss'); void node.offsetWidth; node.classList.add('miss');
          recordResult('rhymetime:cp:' + t.answer, false);
          collector.addAttempted(coupletMiss(t));
          const last = lastWordOf(t.lines[0]);
          const line = `Listen to the end of line one: ${last}. Does ${word} sound like ${last}?`;
          shell.react(line, { voice: false, hold: 3200 });
          speakMaybe(line);
        }
      }
    }

    function useHint() {
      if (hintsUsed >= MAX_HINTS) return;
      const t = cur();
      const want = t.kind === 'couplet' ? t.answer : (t.correct || []).find(w => !found.has(w));
      if (!want) return;
      hintsUsed++;
      if (hintsUsed >= MAX_HINTS) shell.enableHint(false);
      const node = cardNodes.find(n => n.dataset.word === want);
      if (node) { node.classList.remove('nudge'); void node.offsetWidth; node.classList.add('nudge'); }
      shell.react('Listen to this one again...', { voice: false, hold: 1600 });
    }

    function finish() {
      tts.cancel();
      shell.cleanup();
      const stars = starsFor(wrong, hintsUsed);
      recordBest('rhymetime', badgeKey, stars);
      ctx.go('results', {
        game: 'rhymetime', gameName: mix ? 'Smart Mix' : 'Rhyme Time', stars, level,
        cat: mix ? null : badgeKey, mix, tricky: collector.items(),
        replay: () => ctx.go('rhymetime')
      });
    }

    if (typeof window !== 'undefined') window.__rhyme = {
      state: () => ({ idx, wrong, hintsUsed, solved, renders, total: targets.length }),
      target: () => ({ ...cur(), found: [...found] }),
      cards: () => cur().cards.slice(),
      tap: (w) => { const n = cardNodes.find(x => x.dataset.word === w); if (n) n.click(); },
      tapCorrect: () => { const t = cur(); const w = t.kind === 'couplet' ? t.answer : t.correct.find(x => !found.has(x)); if (w) window.__rhyme.tap(w); },
      tapWrong: () => { const t = cur(); const ok = t.kind === 'couplet' ? [t.answer] : t.correct; const w = t.cards.find(x => !ok.includes(x)); if (w) window.__rhyme.tap(w); },
      tapNearMiss: () => { const t = cur(); if (t.nearMiss) window.__rhyme.tap(t.nearMiss); },
      solveTarget: () => { const t = cur(); if (t.kind === 'couplet') window.__rhyme.tap(t.answer); else t.correct.forEach(w => { if (!found.has(w)) window.__rhyme.tap(w); }); },
      gapText: () => { const g = stage.querySelector('.rt-gap'); return g && g.textContent; },
      hint: () => useHint(),
      collected: () => collector.items().length
    };
  }

  return { unmount() { if (shell) shell.cleanup(); tts.cancel(); } };
}

function lastWordOf(line) { return (String(line).trim().replace(/[^A-Za-z' ]/g, '').split(/\s+/).pop() || '').toLowerCase(); }

// A missed rhyme goes to the Tricky Pile as pictures: which of these rhymes with the word?
export function rhymeMiss(t) {
  const decoys = t.cards.filter(w => !t.correct.includes(w)).slice(0, 2);
  const options = [t.correct[0], ...decoys];
  return {
    ...choiceMiss({ id: 'rhymetime:' + t.family, game: 'rhymetime', prompt: `Which word rhymes with ${t.target}?`, options, answer: t.correct[0] }),
    pics: picsFor(options),
    say: `Which word rhymes with ${t.target}?`
  };
}
export function coupletMiss(t) {
  const options = t.cards.slice(0, 3);
  return {
    ...choiceMiss({ id: 'rhymetime:cp:' + t.answer, game: 'rhymetime', prompt: t.lines[1].replace(/_+/, '____'), options, answer: t.answer }),
    pics: picsFor(options),
    say: t.lines.join(' ').replace(/_+/, 'mmm')
  };
}
const picsFor = (options) => Object.fromEntries(options.map(w => [w, renderWordArt(artKeyFor(w), { size: 74, label: w })]));
export { RHYME_FAMILIES, COUPLETS };
