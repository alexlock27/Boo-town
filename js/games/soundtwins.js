// js/games/soundtwins.js — RUN18E L3: Twin Trouble.
//
// Fiction: the homophone twins are mischievous doubles who swap places around town. She is
// the INSPECTOR. The mechanic is judgment, not fill-the-blank: a sentence card shows ONE
// twin in place — sometimes the right one (INNOCENT), sometimes its twin has snuck in
// (GUILTY) — and she stamps a verdict before she is shown which. On a correct GUILTY call
// she then taps the culprit word and the right twin swaps in.
//
// Reuses data/soundTwins.js (TWIN_SETS/TWIN_EXPLAIN) verbatim — only sets with exactly two
// options are "twins" for this game (three-way sets like to/too/two stay in Spell Boo,
// where "swap for the pair-mate" has no single meaning).

import { el, clear, starsRow, sparkleAt, backControl, REDUCED, confetti } from '../ui.js';
import { getState, mutate, recordResult } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import * as tts from '../tts.js';
import { buildPicker, recordBest, MIX_KEY } from '../picker.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { createTrickyCollector, choiceMiss, pileBoost } from '../trickypile.js';
import { buildSmartMix } from '../smartmix.js';
import { TWIN_SETS, TWIN_EXPLAIN, twinRightLine, twinCaughtLine } from '../../data/soundTwins.js';

const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export const RANK_THRESHOLDS = [
  { at: 0, name: 'Trainee Inspector' },
  { at: 15, name: 'Detective' },
  { at: 40, name: 'Inspector' },
  { at: 80, name: 'CHIEF Inspector' }
];
export function rankFor(lifetimeCorrect) {
  let r = RANK_THRESHOLDS[0];
  for (const t of RANK_THRESHOLDS) if (lifetimeCorrect >= t.at) r = t;
  return r;
}

export const PAIR_SETS = TWIN_SETS.filter(s => s.options.length === 2);
function flatten(sets) {
  const out = [];
  for (const set of sets) for (const it of set.items) out.push({ setId: set.id, options: set.options, sentence: it.s, answer: it.a });
  return out;
}

// A case: one twin word shown IN PLACE, guilty ~50% of the time (the pack: "generated
// mechanically by swapping the answer for its pair-mate").
export function buildCase(poolItem) {
  const other = poolItem.options.find(o => o !== poolItem.answer);
  const guilty = Math.random() < 0.5;
  return { ...poolItem, guilty, displayed: guilty ? other : poolItem.answer, culprit: other };
}

// CAUGHT LIVE (Alex, 2026-07-30): both branches sampled WITH replacement, so the same
// sentence could come up twice (or more) in one round. Level 1 deliberately drills ONE
// pair, so its small pool must recycle — but now in shuffled cycles (every sentence seen
// equally, never the same one twice running). Levels 2/3 have a big pool and simply deal.
export function buildTwinTroubleRound(level) {
  if (level === 1) {
    const set = PAIR_SETS[rand(PAIR_SETS.length)];
    const items = flatten([set]);
    const n = 8;
    const out = [];
    while (out.length < n) {
      const cycle = shuffle(items.slice());
      if (out.length && cycle.length > 1 && cycle[0].sentence === out[out.length - 1].sentence) cycle.push(cycle.shift());
      for (const it of cycle) if (out.length < n) out.push(buildCase(it));
    }
    return { cases: out, toldSet: set };
  }
  const items = flatten(PAIR_SETS);
  const n = level === 3 ? 10 : 8;
  const out = shuffle(items.slice()).slice(0, n).map(buildCase);
  while (out.length < n && items.length) out.push(buildCase(items[rand(items.length)]));
  return { cases: out, toldSet: null };
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen soundtwins' });
  container.appendChild(root);
  let shell = null;

  const rz = params && params.resume;
  if (rz && rz.mix) playMix();
  else if (rz && rz.level) play(rz.level);
  else startCard();
  maybeIntro('soundtwins');

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    const rank = rankFor((s.seen && s.seen.twinTroubleCorrect) || 0);
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 96 }) }),
      el('h2', { text: 'Twin Trouble' }),
      el('p', { class: 'sc-intro', text: 'The homophone twins keep swapping places. Innocent, or guilty?' }),
      el('div', { class: 'tt-rank-badge', text: '🔍 ' + rank.name })
    ]);
    card.appendChild(buildPicker({
      game: 'soundtwins',
      choices: [{ key: 'trouble', name: 'Twin Trouble', sub: 'stamp your verdict' }],
      levelsFor: () => [1, 2, 3],
      levelName: (l) => (l === 1 ? 'One Pair' : l === 2 ? 'Mixed Pairs' : 'A Shift (10 cases)'),
      onStart: (key, level) => (key === MIX_KEY ? playMix() : play(level))
    }).node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: at most one wrong verdict, no hints.' })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
  }

  function play(level) {
    const built = buildTwinTroubleRound(level);
    startRound(built.cases, { badgeKey: 'L' + level, level, title: 'Twin Trouble', toldSet: built.toldSet });
  }
  function playMix() {
    const pool = flatten(PAIR_SETS).map((it, i) => ({ id: 'soundtwins:' + it.setId + ':' + i, item: it, boost: pileBoost('soundtwins:' + it.setId) }));
    const picked = buildSmartMix(pool, 8).map(p => buildCase(p.item));
    startRound(picked.length ? picked : buildTwinTroubleRound(2).cases, { badgeKey: MIX_KEY, level: null, title: 'Smart Mix', mix: true });
  }

  function startRound(cases, { badgeKey, level, title, mix = false, toldSet = null }) {
    clear(root);
    if (!cases.length) return startCard();
    let idx = 0, wrong = 0, hintsUsed = 0, combo = 0, bestCombo = 0, correctCount = 0;
    let phase = 'verdict';

    shell = createGameShell({
      title, rounds: cases.length, accent: 'var(--star)',
      onHelp: () => replayIntro('soundtwins'),
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: () => useHint(),
      bank: () => ({ correct: correctCount, of: cases.length })
    });
    root.appendChild(shell.root);
    const guide = getState().guide;
    const stage = el('div', { class: 'tt-stage' });
    shell.area.appendChild(stage);
    const collector = createTrickyCollector(shell.area);

    if (toldSet) shell.react(`Today's twins: ${toldSet.options.join(' and ')}!`, { voice: false, hold: 2200 });

    renderCase();
    function cur() { return cases[idx]; }

    function renderCase() {
      phase = 'verdict';
      clear(stage);
      const c = cur();
      const parts = c.sentence.split(/_+/);
      const sentenceEl = el('div', { class: 'tt-sentence' }, [
        el('span', { text: parts[0] }),
        el('button', { class: 'tt-word', text: c.displayed, disabled: true }),
        el('span', { text: parts[1] || '' })
      ]);
      const head = el('div', { class: 'tt-head' }, [
        el('div', { class: 'tt-guide', html: renderGuide(guide, { view: 'head', size: 60 }) }),
        sentenceEl
      ]);
      const verdictRow = el('div', { class: 'tt-verdicts' }, [
        el('button', { class: 'btn soft tt-innocent', text: '😇 Innocent', onclick: () => stamp(false) }),
        el('button', { class: 'btn soft tt-guilty', text: '😈 Guilty!', onclick: () => stamp(true) })
      ]);
      const explainEl = el('div', { class: 'tt-explain', style: { display: 'none' } });
      stage.append(head, verdictRow, explainEl);
      shell.setProgress(idx);
      speakMaybe(c.sentence.replace(/_+/g, c.displayed));
    }

    function stamp(guiltyCall) {
      if (phase !== 'verdict') return;
      phase = 'resolved';
      const c = cur();
      const right = guiltyCall === c.guilty;
      mutate(s => { s.seen.twinTroubleCorrect = (s.seen.twinTroubleCorrect || 0) + (right ? 1 : 0); });
      if (right) {
        correctCount++; combo++; bestCombo = Math.max(bestCombo, combo);
        recordResult('soundtwins:' + c.setId, true);
        checkRankUp();
        if (c.guilty) return fixCulprit();
        sfx.correct();
        // Alex, 2026-07-30: a RIGHT answer gets the explanation too — why this twin is
        // the one, and when its twin would be — read at her pace behind the same Next.
        const comboNote = combo >= 5 ? ' 🔍✨' : '';
        const line = twinRightLine(c.setId, c.displayed);
        [...stage.querySelectorAll('.tt-innocent,.tt-guilty')].forEach(b => b.disabled = true);
        const explainEl = stage.querySelector('.tt-explain');
        clear(explainEl);
        explainEl.style.display = '';
        explainEl.classList.add('correct');
        explainEl.append(
          el('p', { class: 'tt-explain-line', text: line + comboNote }),
          el('button', { class: 'btn big tt-next', text: 'Next ›', onclick: () => { sfx.tap(); advance(); } })
        );
        speakMaybe(line);
      } else {
        wrong++; combo = 0;
        shell.dimHeart();
        sfx.oops();
        recordResult('soundtwins:' + c.setId, false);
        collector.addAttempted(twinTroubleMiss(c));
        const line = c.guilty
          ? `Look closer — ${TWIN_EXPLAIN[c.displayed] || ''} This sentence needs "${c.answer}"!`
          : `Look again — "${c.displayed}" is exactly right here. ${TWIN_EXPLAIN[c.displayed] || ''}`;
        const explainEl = stage.querySelector('.tt-explain');
        speakMaybe(line);
        [...stage.querySelectorAll('.tt-innocent,.tt-guilty')].forEach(b => b.disabled = true);
        // Alex, 2026-07-30: a grammar explanation needs reading time, not a timer racing
        // her — she taps Next when she's ready, same idea as the culprit-fix step already
        // did for a correct Guilty call.
        clear(explainEl);
        explainEl.style.display = '';
        explainEl.append(
          el('p', { class: 'tt-explain-line', text: line }),
          el('button', { class: 'btn big tt-next', text: 'Next ›', onclick: () => { sfx.tap(); advance(); } })
        );
      }
    }

    function fixCulprit() {
      phase = 'fix';
      const c = cur();
      [...stage.querySelectorAll('.tt-innocent,.tt-guilty')].forEach(b => b.disabled = true);
      shell.react('Caught you! Tap the culprit word.', { voice: false, hold: 1600 });
      const wordBtn = stage.querySelector('.tt-word');
      wordBtn.disabled = false;
      wordBtn.classList.add('culprit-glow');
      wordBtn.onclick = () => {
        sfx.correct();
        wordBtn.classList.add('whoosh');
        wordBtn.onclick = null;
        shell.timeout(() => { wordBtn.textContent = c.answer; wordBtn.classList.remove('whoosh'); }, REDUCED ? 0 : 260);
        // Alex, 2026-07-30: the catch explains itself too — why the right twin is right
        // AND what the sneaky one means — behind a Next instead of a 1200ms timer.
        const line = twinCaughtLine(c.setId, c.answer, c.displayed);
        const explainEl = stage.querySelector('.tt-explain');
        clear(explainEl);
        explainEl.style.display = '';
        explainEl.classList.add('correct');
        explainEl.append(
          el('p', { class: 'tt-explain-line', text: line }),
          el('button', { class: 'btn big tt-next', text: 'Next ›', onclick: () => { sfx.tap(); advance(); } })
        );
        speakMaybe(line);
      };
    }

    function advance() {
      shell.advance();
      idx++;
      shell.timeout(() => (idx >= cases.length ? finish() : renderCase()), 900);
    }

    function checkRankUp() {
      const s = getState();
      const total = (s.seen && s.seen.twinTroubleCorrect) || 0;
      const rank = rankFor(total);
      const prevRank = rankFor(total - 1);
      if (rank.name !== prevRank.name && total > 0) {
        if (!REDUCED) confetti({ count: 60 });
        shell.react(`Promoted to ${rank.name}! 🔍`, { voice: false, hold: 2200 });
        speakMaybe(`Promoted to ${rank.name}!`);
      }
    }

    function useHint() {
      if (hintsUsed >= 2 || phase !== 'verdict') return;
      hintsUsed++;
      if (hintsUsed >= 2) shell.enableHint(false);
      const c = cur();
      speakMaybe(TWIN_EXPLAIN[c.displayed] || '');
      shell.react(TWIN_EXPLAIN[c.displayed] || '', { voice: false, hold: 2400 });
    }

    function finish() {
      tts.cancel();
      shell.cleanup();
      const stars = (hintsUsed === 0 && wrong === 0) ? 3 : (wrong <= (cases.length >= 10 ? 2 : 1) ? 2 : 1);
      recordBest('soundtwins', badgeKey, stars);
      ctx.go('results', {
        game: 'soundtwins', gameName: mix ? 'Smart Mix' : 'Twin Trouble', stars, level,
        cat: mix ? null : badgeKey, mix, tricky: collector.items(),
        replay: () => ctx.go('soundtwins')
      });
    }

    if (typeof window !== 'undefined') window.__twintrouble = {
      state: () => ({ idx, wrong, hintsUsed, combo, bestCombo, correctCount, total: cases.length, phase }),
      case: () => ({ ...cur() }),
      verdictInnocent: () => stamp(false),
      verdictGuilty: () => stamp(true),
      tapCulprit: () => { const b = stage.querySelector('.tt-word'); if (b && !b.disabled) b.click(); },
      tapNext: () => { const b = stage.querySelector('.tt-next'); if (b) b.click(); },
      rank: () => rankFor((getState().seen && getState().seen.twinTroubleCorrect) || 0).name,
      lifetimeCorrect: () => (getState().seen && getState().seen.twinTroubleCorrect) || 0,
      hint: () => useHint(),
      collected: () => collector.items().length
    };
  }

  return { unmount() { if (shell) shell.cleanup(); tts.cancel(); } };
}

function twinTroubleMiss(c) {
  return {
    ...choiceMiss({ id: 'soundtwins:' + c.setId, game: 'soundtwins', prompt: c.sentence.replace(/_+/g, '____'), options: c.options.slice(), answer: c.answer }),
    say: c.sentence.replace(/_+/g, c.answer)
  };
}
