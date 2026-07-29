// js/games/storyorder.js — RUN16 W4: Story Order (sequencing and comprehension).
//
// Feel goal: putting a story right feels like understanding it. So the moment the order is
// correct the guide starts READING IT BACK, each panel lighting up as its line is read —
// the reward for ordering a story is hearing the story.
//
// Mechanic (RUN16 W4, exactly): three to five illustrated panels arrive shuffled; she drags
// them into order; the guide then reads the assembled story back with each panel
// highlighting as it is read; one comprehension question follows, answered from three
// pictures. The six stories are authored in CONTENT_STORIES.md and live in data/stories.js;
// option order is randomised at runtime.
//
// TWO DELIBERATE DESIGN CHOICES, both about not punishing her:
//   1. Reordering has no wrong move. Swapping two panels is never "incorrect" — the strip
//      simply is not finished yet. Stars come from the comprehension question and the hint
//      budget, never from how many swaps she took. A sequencing puzzle a child re-thinks
//      three times is a child thinking, not a child failing.
//   2. There is no "Done" button to get wrong. The read-back begins the instant the order
//      is right, so the feedback for finishing is the story itself.
//
// G14: every panel is a picture that carries its own beat of the story, the captions can be
// hidden entirely with the 👁 button (the pre-reader path, and the acceptance test), and
// both the captions and the question are spoken.

import { el, clear, starsRow, sparkleAt, backControl, REDUCED } from '../ui.js';
import { getState, mutate, recordResult } from '../state.js';
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
import { makeDraggable, makeDropTargets, clearLift } from '../dragdrop.js';
import { renderStoryArt } from '../storyart.js';
import { STORIES, STORY_BY_ID, STORY_LEVELS, storiesAtLevel } from '../../data/stories.js';
import { STORY_READER_SETS, reporterRankFor } from '../../data/storyReader.js';
import { contentTier } from '../content.js';

const MAX_HINTS = 2;
const READ_MS = 2400;          // how long each line is left highlighted while it is read
const rand = (n) => (Math.random() * n) | 0;
const starsFor = (wrong, hints) => (hints === 0 && wrong === 0) ? 3 : (wrong <= 1 ? 2 : 1);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// A shuffle that never hands her a solved puzzle, and never hands her the reverse either
// (a child who spots "it's just backwards" has not sequenced anything).
export function shuffleStory(n) {
  const solved = Array.from({ length: n }, (_, i) => i);
  let order = solved.slice();
  let guard = 0;
  do { order = shuffle(order.slice()); } while (guard++ < 200 && (isSolved(order) || isReversed(order)));
  return order;
}
export const isSolved = (order) => order.every((v, i) => v === i);
export const isReversed = (order) => order.every((v, i) => v === order.length - 1 - i);

export function mount(container, params, ctx) {
  // RUN18E L5/Part E: at Medium ONLY (and never for the Toddler door) the card becomes
  // the reporter's INSERTION game — sentences, not pictures, revealed one at a time. Full
  // keeps the picture-arrange game (r16w4-storyorder's own fixture defaults to Full and
  // expects exactly that); Light's picture stories are untouched either way.
  const toddlerMode0 = !!(params && params.toddler);
  const t0 = contentTier();
  if (!toddlerMode0 && t0 === 'medium') return mountReader(container, params, ctx);
  const root = el('div', { class: 'screen storyorder' });
  container.appendChild(root);
  let shell = null;

  // RUN18E L1: the Toddler hub's "Stories" card jumps straight into the two shortest
  // stories, captions permanently hidden (a pre-reader has no use for the eye toggle),
  // read-back spoken as ever.
  const toddlerMode = !!(params && params.toddler);
  const rz = params && params.resume;
  if (toddlerMode) playToddler();
  else if (rz && rz.mix) playMix();
  else if (rz && rz.level) play(rz.level);
  else startCard();
  if (!toddlerMode) maybeIntro('storyorder');

  function startCard() {
    clear(root);
    music.play('calm');
    const s = getState();
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 96 }) }),
      el('h2', { text: 'Story Order' }),
      el('p', { class: 'sc-intro', text: 'The pictures got muddled! Put the story back together and I will read it to you.' })
    ]);
    card.appendChild(buildPicker({
      game: 'storyorder',
      choices: [{ key: 'stories', name: 'Story Order', sub: 'six little stories' }],
      levelsFor: () => filterLevels(STORY_LEVELS),
      levelName: (l) => `${storiesAtLevel(l).length} ${storiesAtLevel(l).length === 1 ? 'story' : 'stories'} · level ${l}`,
      onStart: (key, level) => (key === MIX_KEY ? playMix() : play(level))
    }).node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: get every story question right first time, with no hints. Moving the pictures around never costs anything.' })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
  }

  function play(level) {
    startRound(shuffle(storiesAtLevel(level).slice()), { badgeKey: 'L' + level, level, title: 'Story Order' });
  }
  function playToddler() {
    const shortest = STORIES.slice().sort((a, b) => a.panels.length - b.panels.length).slice(0, 2);
    startRound(shortest, { badgeKey: 'toddler', level: null, title: 'Story Order', toddler: true });
  }
  function playMix() {
    const pool = STORIES.map(s => ({ id: 'storyorder:' + s.id, story: s.id, boost: pileBoost('storyorder:' + s.id) }));
    const items = buildSmartMix(pool, 3).map(it => STORY_BY_ID[it.story]).filter(Boolean);
    startRound(items.length ? items : [STORIES[0]], { badgeKey: MIX_KEY, level: null, title: 'Smart Mix', mix: true });
  }

  function startRound(stories, { badgeKey, level, title, mix = false, toddler = false }) {
    clear(root);
    if (!stories.length) return startCard();
    let idx = 0, wrong = 0, hintsUsed = 0, done = 0, renders = 0;
    let order = [], panelNodes = [], drags = [], phase = 'order', captionsOn = !toddler, readingAt = -1;
    let untangle = null;

    shell = createGameShell({
      title, rounds: stories.length, accent: 'var(--zing)',
      onHelp: () => replayIntro('storyorder'),
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: () => useHint(),
      bank: () => ({ correct: done, of: stories.length })
    });
    root.appendChild(shell.root);
    const guide = getState().guide;
    const stage = el('div', { class: 'so-stage' });
    shell.area.appendChild(stage);
    const collector = createTrickyCollector(shell.area);

    renderStory();
    function cur() { return stories[idx]; }

    function renderStory() {
      renders++;
      phase = 'order';
      readingAt = -1;
      clear(stage);
      if (untangle) { untangle(); untangle = null; }
      clearLift();
      const story = cur();
      order = shuffleStory(story.panels.length);
      shell.setProgress(idx);

      const eye = el('button', {
        class: 'btn soft so-eye', 'aria-label': captionsOn ? 'Hide the words' : 'Show the words',
        text: captionsOn ? '👁 Hide the words' : '👁 Show the words',
        onclick: () => { captionsOn = !captionsOn; sfx.tap(); applyCaptions(); eye.textContent = captionsOn ? '👁 Hide the words' : '👁 Show the words'; eye.setAttribute('aria-label', captionsOn ? 'Hide the words' : 'Show the words'); }
      });
      const head = el('div', { class: 'so-head' }, [
        el('div', { class: 'ss-guide', html: renderGuide(guide, { view: 'head', size: 56 }) }),
        el('div', { class: 'so-title', text: story.title }),
        ...(toddler ? [] : [eye])
      ]);
      const strip = el('div', { class: 'so-strip' });
      const readback = el('div', { class: 'so-readback', 'aria-live': 'polite' });
      stage.append(head, el('p', { class: 'tm-try-instruction', text: 'Swap the pictures until the story makes sense.' }), strip, readback);

      drawStrip(strip);
      shell.react('Which one happened first?', { voice: false, hold: 2400 });
      speakMaybe(`${story.title}. Put the pictures in order.`);
    }

    // The strip is rebuilt from `order` after every swap: one code path for the initial
    // deal and for every rearrangement, so what she sees can never drift from the state.
    function drawStrip(stripArg) {
      const strip = stripArg || stage.querySelector('.so-strip');
      const story = cur();
      clear(strip);
      panelNodes = []; drags = [];
      if (untangle) { untangle(); untangle = null; }
      order.forEach((panelIdx, slot) => {
        const p = story.panels[panelIdx];
        const node = el('div', {
          class: 'so-panel', dataset: { panel: String(panelIdx), slot: String(slot) },
          role: 'button', tabindex: '0', 'aria-label': `Picture ${slot + 1}: ${p.caption}`
        }, [
          el('span', { class: 'so-slot-n', text: String(slot + 1) }),
          el('span', { html: renderStoryArt(p.art, { w: 132, label: p.caption }) }),
          el('span', { class: 'so-caption' + (captionsOn ? '' : ' hidden'), text: p.caption })
        ]);
        strip.appendChild(node);
        panelNodes.push(node);
      });
      // every panel is both a draggable and a drop target: drop one on another to swap
      const targets = () => panelNodes.map((n, i) => ({ node: n, key: i }));
      drags = panelNodes.map((node, i) => makeDraggable(node, {
        targets, data: i, disabled: () => phase !== 'order',
        onDrop: (slotB) => { if (slotB === i) return false; swap(i, slotB); return true; },
        onLift: () => speakMaybe('Now tap where it should go.')
      }));
      untangle = makeDropTargets(targets());
      // keyboard: focus a panel and press Enter/Space to lift, then Enter/Space to drop
      panelNodes.forEach((node, i) => node.addEventListener('keydown', (e) => {
        if (phase !== 'order') return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drags[i].lift(); }
      }));
    }

    function applyCaptions() {
      stage.querySelectorAll('.so-caption').forEach(n => n.classList.toggle('hidden', !captionsOn));
    }

    function swap(a, b) {
      if (phase !== 'order') return;
      [order[a], order[b]] = [order[b], order[a]];
      sfx.tap();
      drawStrip();
      const moved = [panelNodes[a], panelNodes[b]];
      if (!REDUCED) moved.forEach(n => { n.classList.remove('settled'); void n.offsetWidth; n.classList.add('settled'); });
      if (isSolved(order)) shell.timeout(readBack, 420);
    }

    // ---- the reward: the guide reads the assembled story, panel by panel ----
    function readBack() {
      phase = 'reading';
      const story = cur();
      const readback = stage.querySelector('.so-readback');
      stage.querySelector('.tm-try-instruction').textContent = 'That\'s it! Listen...';
      sfx.star();
      const step = (i) => {
        panelNodes.forEach(n => n.classList.remove('reading'));
        if (i >= story.panels.length) {
          readingAt = -1;
          readback.textContent = '';
          return shell.timeout(askQuestion, 600);
        }
        readingAt = i;
        const p = story.panels[order.indexOf(i)] || story.panels[i];
        const node = panelNodes[i];
        if (node) node.classList.add('reading');
        readback.textContent = p.caption;
        speakMaybe(p.caption);
        shell.timeout(() => step(i + 1), REDUCED ? 700 : READ_MS);
      };
      step(0);
    }

    // ---- one comprehension question, three pictures, order randomised at runtime ----
    function askQuestion() {
      phase = 'question';
      const story = cur();
      clear(stage);
      const q = el('div', { class: 'so-question' }, [
        el('div', { class: 'ss-guide', html: renderGuide(guide, { view: 'head', size: 56 }) }),
        el('div', { class: 'so-q-text', text: story.question }),
        el('button', { class: 'btn soft ss-say', text: '🔊 Ask me again', 'aria-label': 'Hear the question again — always free', onclick: () => { sfx.tap(); speakMaybe(story.question); } })
      ]);
      const opts = el('div', { class: 'so-options' });
      shuffle(story.options.slice()).forEach(o => {
        const b = el('button', {
          class: 'pic-card so-option', 'aria-label': o, dataset: { opt: o },
          onclick: () => answer(o, b)
        }, [
          el('span', { html: renderStoryArt(story.optionArt[o], { w: 116, label: o }) }),
          el('span', { class: 'so-opt-word', text: o })
        ]);
        opts.appendChild(b);
      });
      stage.append(q, opts);
      speakMaybe(story.question);
      shell.react(story.question, { voice: false, hold: 3000 });
    }

    function answer(opt, node) {
      if (phase !== 'question') return;
      const story = cur();
      if (opt === story.answer) {
        phase = 'done';
        node.classList.add('right');
        sfx.star();
        recordResult('storyorder:' + story.id, true);
        const r = node.getBoundingClientRect();
        if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
        shell.react('You understood the whole story! 🌟', { voice: false, hold: 1800 });
        speakMaybe('You understood the whole story!');
        done++;
        shell.advance();
        idx++;
        shell.timeout(() => (idx >= stories.length ? finish() : renderStory()), REDUCED ? 800 : 1700);
      } else {
        wrong++;
        shell.dimHeart();
        sfx.oops();
        node.classList.remove('miss'); void node.offsetWidth; node.classList.add('miss');
        recordResult('storyorder:' + story.id, false);
        collector.addAttempted(storyMiss(story));
        const line = `Hmm — think back to the pictures. ${story.question}`;
        shell.react(line, { voice: false, hold: 3000 });
        speakMaybe(line);
      }
    }

    function useHint() {
      if (hintsUsed >= MAX_HINTS) return;
      if (phase === 'order') {
        // show her which picture comes first, by moving it into place for her
        const at = order.indexOf(0);
        if (at < 0) return;
        hintsUsed++;
        if (hintsUsed >= MAX_HINTS) shell.enableHint(false);
        if (at !== 0) { [order[0], order[at]] = [order[at], order[0]]; drawStrip(); }
        const n = panelNodes[0];
        if (n) { n.classList.remove('nudge'); void n.offsetWidth; n.classList.add('nudge'); }
        shell.react('This one happened first!', { voice: false, hold: 2000 });
        if (isSolved(order)) shell.timeout(readBack, 500);
      } else if (phase === 'question') {
        const story = cur();
        const wrongNode = [...stage.querySelectorAll('.so-option')].find(n => n.dataset.opt !== story.answer && !n.disabled);
        if (!wrongNode) return;
        hintsUsed++;
        if (hintsUsed >= MAX_HINTS) shell.enableHint(false);
        wrongNode.disabled = true;
        wrongNode.style.opacity = '.35';
        shell.react('Not that one — I took it away!', { voice: false, hold: 1800 });
      }
    }

    function finish() {
      tts.cancel();
      shell.cleanup();
      if (untangle) untangle();
      clearLift();
      const stars = starsFor(wrong, hintsUsed);
      recordBest('storyorder', badgeKey, stars);
      ctx.go('results', {
        game: 'storyorder', gameName: mix ? 'Smart Mix' : 'Story Order', stars, level,
        cat: mix ? null : badgeKey, mix, tricky: collector.items(),
        replay: () => ctx.go('storyorder', toddler ? { toddler: true } : undefined)
      });
    }

    if (typeof window !== 'undefined') window.__story = {
      state: () => ({ idx, wrong, hintsUsed, done, renders, phase, total: stories.length }),
      story: () => ({ id: cur().id, title: cur().title, panels: cur().panels.map(p => p.caption), question: cur().question, answer: cur().answer }),
      order: () => order.slice(),
      solved: () => isSolved(order),
      captionsOn: () => captionsOn,
      toggleCaptions: () => { const b = stage.querySelector('.so-eye'); if (b) b.click(); },
      captionsVisible: () => [...stage.querySelectorAll('.so-caption')].filter(n => !n.classList.contains('hidden')).length,
      swap: (a, b) => swap(a, b),
      // the tap path, exactly as a child using it would: lift one, tap the other
      tapSwap: (a, b) => { drags[a].lift(); panelNodes[b].click(); },
      solveOrder: () => {
        // repeated swaps into place — the same operation she performs, nothing privileged
        for (let i = 0; i < order.length; i++) {
          if (order[i] === i) continue;
          const at = order.indexOf(i);
          swap(i, at);
          if (phase !== 'order') break;
        }
      },
      readingAt: () => readingAt,
      readingPanel: () => { const n = stage.querySelector('.so-panel.reading'); return n ? Number(n.dataset.slot) : -1; },
      options: () => [...stage.querySelectorAll('.so-option')].map(n => n.dataset.opt),
      answerCorrect: () => { const n = [...stage.querySelectorAll('.so-option')].find(x => x.dataset.opt === cur().answer); if (n) n.click(); },
      answerWrong: () => { const n = [...stage.querySelectorAll('.so-option')].find(x => x.dataset.opt !== cur().answer && !x.disabled); if (n) n.click(); },
      hint: () => useHint(),
      collected: () => collector.items().length
    };
  }

  return { unmount() { if (shell) shell.cleanup(); tts.cancel(); clearLift(); } };
}

// ===================== RUN18E L5/Part E: STORY ORDER — MEDIUM (insertion) =====================
// Fiction: she's the reporter, Snaffle scrambled the story, the printing press waits.
// Sentences are revealed ONE AT A TIME (in a shuffled reveal order, not the story's own
// order) and she inserts each into the growing line at the gap that keeps it in TRUE order —
// so she has to reason about the connective, not just append to the end.

const READER_LEVEL_SLOTS = [1, 2, 3, 4];

// Build a reveal order that is a genuine shuffle (never simply the true order).
function revealOrderFor(n) {
  const order = Array.from({ length: n }, (_, i) => i);
  let guard = 0;
  let shuffled = order.slice();
  do { shuffled = shuffle(shuffled.slice()); } while (guard++ < 50 && shuffled.every((v, i) => v === order[i]));
  return shuffled;
}
export { revealOrderFor };

function mountReader(container, params, ctx) {
  const root = el('div', { class: 'screen storyorder reader' });
  container.appendChild(root);
  let shell = null;
  startCard();
  maybeIntro('storyorder-reader');

  function startCard() {
    clear(root);
    music.play('calm');
    const s = getState();
    const rank = reporterRankFor((s.seen && s.seen.reporterCorrect) || 0);
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 96 }) }),
      el('h2', { text: 'Story Order' }),
      el('p', { class: 'sc-intro', text: "Snaffle scrambled the story! Slot each sentence into place and print the front page." }),
      el('div', { class: 'tt-rank-badge', text: '📰 ' + rank.name })
    ]);
    const levelRow = el('div', { class: 'so-reader-levels' });
    for (const l of READER_LEVEL_SLOTS) {
      levelRow.appendChild(l === 1
        ? el('button', { class: 'btn big', text: 'Start', onclick: () => { sfx.tap(); play(); } })
        : el('div', { class: 'btn soft so-soon', 'aria-disabled': 'true', text: 'More stories soon!' }));
    }
    card.append(levelRow);
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
  }

  function play() { startRound(STORY_READER_SETS.slice()); }

  function startRound(stories) {
    clear(root);
    let sIdx = 0, wrong = 0, hintsUsed = 0, correctQuestions = 0;
    let placed = [], revealOrder = [], revealPtr = 0, phase = 'insert';

    shell = createGameShell({
      title: 'Story Order', rounds: stories.length, accent: 'var(--zing)',
      onHelp: () => replayIntro('storyorder-reader'),
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: () => useHint(),
      bank: () => ({ correct: correctQuestions, of: stories.length })
    });
    root.appendChild(shell.root);
    const guide = getState().guide;
    const stage = el('div', { class: 'so-reader-stage' });
    shell.area.appendChild(stage);
    const collector = createTrickyCollector(shell.area);

    renderStory();
    function cur() { return stories[sIdx]; }

    function renderStory() {
      placed = []; revealPtr = 0; phase = 'insert';
      const story = cur();
      revealOrder = revealOrderFor(story.sentences.length);
      clear(stage);
      shell.setProgress(sIdx);
      stage.append(el('div', { class: 'so-title', text: story.title }));
      drawInsert();
    }

    function drawInsert() {
      const old = stage.querySelector('.so-reader-line'); if (old) old.remove();
      const oldCard = stage.querySelector('.so-reveal-card'); if (oldCard) oldCard.remove();
      const story = cur();
      const line = el('div', { class: 'so-reader-line' });
      // one gap before each placed card, and one after the last
      const gapBtn = (gapIdx) => el('button', { class: 'so-gap', 'aria-label': 'Place here', onclick: () => tryPlace(gapIdx) });
      line.appendChild(gapBtn(0));
      placed.forEach((trueIdx, i) => {
        line.appendChild(el('div', { class: 'so-placed-card', text: story.sentences[trueIdx].text }));
        line.appendChild(gapBtn(i + 1));
      });
      stage.appendChild(line);
      if (revealPtr < revealOrder.length) {
        const revealIdx = revealOrder[revealPtr];
        stage.appendChild(el('div', { class: 'so-reveal-card', text: story.sentences[revealIdx].text }));
        speakMaybe(story.sentences[revealIdx].text);
      }
    }

    function correctGap(revealIdx) { return placed.filter(i => i < revealIdx).length; }

    function tryPlace(gapIdx) {
      if (phase !== 'insert' || revealPtr >= revealOrder.length) return;
      const revealIdx = revealOrder[revealPtr];
      if (gapIdx === correctGap(revealIdx)) {
        sfx.tap();
        placed.splice(gapIdx, 0, revealIdx);
        revealPtr++;
        if (revealPtr >= revealOrder.length) shell.timeout(pressStamp, 300);
        else drawInsert();
      } else {
        wrong++;
        shell.dimHeart();
        sfx.oops();
        const card = stage.querySelector('.so-reveal-card');
        if (card) { card.classList.remove('nudge'); void card.offsetWidth; card.classList.add('nudge'); }
        const why = cur().sentences[revealIdx].why;
        shell.react(why, { voice: false, hold: 2400 });
        speakMaybe(why);
      }
    }

    function pressStamp() {
      phase = 'stamp';
      clear(stage);
      const story = cur();
      sfx.correct();
      const press = el('div', { class: 'so-press stamping' }, [el('span', { class: 'so-press-label', text: '📰 Printing…' })]);
      stage.appendChild(press);
      shell.timeout(() => {
        clear(stage);
        const prose = story.sentences.map(s => s.text).join(' ');
        stage.append(el('div', { class: 'so-frontpage' }, [
          el('div', { class: 'so-fp-title', text: story.title.toUpperCase() }),
          el('div', { class: 'so-fp-prose', text: prose })
        ]));
        sfx.star();
        speakMaybe(prose);
        shell.timeout(askQuestion, REDUCED ? 400 : 2200);
      }, REDUCED ? 100 : 800);
    }

    function askQuestion() {
      phase = 'question';
      clear(stage);
      const story = cur();
      const q = el('div', { class: 'so-question' }, [
        el('div', { class: 'ss-guide', html: renderGuide(guide, { view: 'head', size: 56 }) }),
        el('div', { class: 'so-q-text', text: story.question }),
        el('button', { class: 'btn soft ss-say', text: '🔊 Ask me again', onclick: () => { sfx.tap(); speakMaybe(story.question); } })
      ]);
      const opts = el('div', { class: 'so-options' });
      shuffle(story.options.slice()).forEach(o => {
        opts.appendChild(el('button', { class: 'btn so-option', text: o, dataset: { opt: o }, onclick: (e) => answer(o, e.currentTarget) }));
      });
      stage.append(q, opts);
      speakMaybe(story.question);
    }

    function answer(opt, node) {
      if (phase !== 'question') return;
      const story = cur();
      mutate(s => { s.seen.reporterCorrect = (s.seen.reporterCorrect || 0) + (opt === story.answer ? 1 : 0); });
      if (opt === story.answer) {
        phase = 'done';
        node.classList.add('right');
        sfx.star();
        correctQuestions++;
        recordResult('storyorder:' + story.id, true);
        checkRankUp();
        shell.react('Front page printed — story understood! 🌟', { voice: false, hold: 1800 });
        speakMaybe('Front page printed. Story understood!');
        shell.advance();
        sIdx++;
        shell.timeout(() => (sIdx >= stories.length ? finish() : renderStory()), 1700);
      } else {
        wrong++;
        shell.dimHeart();
        sfx.oops();
        node.classList.add('miss');
        recordResult('storyorder:' + story.id, false);
        collector.addAttempted(storyReaderMiss(story));
        const line = `Hmm — think back to the front page. ${story.question}`;
        shell.react(line, { voice: false, hold: 2600 });
        speakMaybe(line);
      }
    }

    function checkRankUp() {
      const s = getState();
      const total = (s.seen && s.seen.reporterCorrect) || 0;
      const rank = reporterRankFor(total), prev = reporterRankFor(total - 1);
      if (rank.name !== prev.name && total > 0) {
        shell.react(`Promoted to ${rank.name}! 📰`, { voice: false, hold: 2200 });
        speakMaybe(`Promoted to ${rank.name}!`);
      }
    }

    function useHint() {
      if (hintsUsed >= 2 || phase !== 'insert' || revealPtr >= revealOrder.length) return;
      hintsUsed++;
      if (hintsUsed >= 2) shell.enableHint(false);
      const revealIdx = revealOrder[revealPtr];
      shell.react(cur().sentences[revealIdx].why, { voice: false, hold: 2400 });
    }

    function finish() {
      tts.cancel();
      shell.cleanup();
      const stars = (hintsUsed === 0 && wrong === 0) ? 3 : (wrong <= 2 ? 2 : 1);
      recordBest('storyorder', 'reader', stars);
      ctx.go('results', {
        game: 'storyorder', gameName: 'Story Order', stars, level: null,
        cat: 'reader', mix: false, tricky: collector.items(),
        replay: () => ctx.go('storyorder')
      });
    }

    if (typeof window !== 'undefined') window.__storyreader = {
      state: () => ({ sIdx, wrong, hintsUsed, correctQuestions, placed: placed.slice(), revealPtr, phase, total: stories.length }),
      currentReveal: () => (revealPtr < revealOrder.length ? cur().sentences[revealOrder[revealPtr]].text : null),
      correctGapNow: () => (revealPtr < revealOrder.length ? correctGap(revealOrder[revealPtr]) : -1),
      place: (gapIdx) => tryPlace(gapIdx),
      placeCorrect: () => tryPlace(revealPtr < revealOrder.length ? correctGap(revealOrder[revealPtr]) : 0),
      placeWrong: () => { const c = correctGap(revealOrder[revealPtr]); const bad = c === 0 ? c + 1 : c - 1; tryPlace(Math.max(0, Math.min(placed.length, bad))); },
      answerCorrect: () => { const n = [...stage.querySelectorAll('.so-option')].find(x => x.dataset.opt === cur().answer); if (n) n.click(); },
      answerWrong: () => { const n = [...stage.querySelectorAll('.so-option')].find(x => x.dataset.opt !== cur().answer); if (n) n.click(); },
      rank: () => reporterRankFor((getState().seen && getState().seen.reporterCorrect) || 0).name,
      hint: () => useHint(),
      collected: () => collector.items().length
    };
  }

  return { unmount() { if (shell) shell.cleanup(); tts.cancel(); } };
}

function storyReaderMiss(story) {
  return { ...choiceMiss({ id: 'storyorder:' + story.id, game: 'storyorder', prompt: story.question, options: story.options.slice(), answer: story.answer }), say: story.question };
}

// A missed comprehension question goes to the Tricky Pile with its own three pictures.
export function storyMiss(story) {
  const options = story.options.slice(0, 3);
  return {
    ...choiceMiss({ id: 'storyorder:' + story.id, game: 'storyorder', prompt: story.question, options, answer: story.answer }),
    pics: Object.fromEntries(options.map(o => [o, renderStoryArt(story.optionArt[o], { w: 96, label: o })])),
    say: story.question
  };
}
export { STORIES };
