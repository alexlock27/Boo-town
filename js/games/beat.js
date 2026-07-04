// js/games/beat.js — Boo Beat (spec RUN2 C6).
// A three-lane rhythm game on the game's music, 100 BPM. Each phrase poses a question;
// three on-beat notes carry candidate answers down the lanes; tap the correct lane as
// its note reaches the glowing hit line where the player's character bops.
// Steady mode (and reduced-motion default): notes step one row per beat, no speed pressure.

import { el, clear, starsRow, sparkleAt, REDUCED } from '../ui.js';
import { getState, mutate, recordResult } from '../state.js';
import { createTrickyCollector, choiceMiss } from '../trickypile.js';
import { noteQuest } from '../quests.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { makeBeatQuestion, BLOCK_CATEGORIES } from '../questions.js';

const LANES = 3;
const BPM = 100, BEAT = 60000 / BPM;   // 600ms/beat
const FALL = 4;                        // beats from top to the hit line
const PHRASES = 10;
const PERFECT_MS = 80, GOOD_MS = 160;
const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen beat' });
  container.appendChild(root);
  let shell = null, raf = null;

  startCard();

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    let category = s.seen.beatCat || 'tables';
    let steady = REDUCED || !!s.seen.beatSteady;   // reduced-motion defaults to steady
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 104 }) }),
      el('h2', { text: 'Boo Beat' }),
      el('p', { class: 'sc-intro', text: 'Tap the lane with the right answer, right on the beat!' })
    ]);
    const catRow = el('div', { class: 'chip-row center' });
    BLOCK_CATEGORIES.forEach(c => {
      const b = el('button', { class: 'acc-chip' + (category === c.key ? ' sel' : ''), text: c.name, onclick: () => { category = c.key; sfx.tap(); catRow.querySelectorAll('.acc-chip').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); } });
      catRow.appendChild(b);
    });
    const steadyBtn = el('button', { class: 'acc-chip' + (steady ? ' sel' : ''), onclick: () => { steady = !steady; sfx.tap(); steadyBtn.classList.toggle('sel', steady); steadyBtn.textContent = steady ? '🐢 Steady mode: ON' : '🐢 Steady mode: off'; } });
    steadyBtn.textContent = steady ? '🐢 Steady mode: ON' : '🐢 Steady mode: off';
    const levels = el('div', { class: 'level-row' });
    for (const lv of [1, 2, 3]) levels.appendChild(el('button', { class: 'btn level-btn', style: { '--accent': 'var(--star)' }, onclick: () => { sfx.tap(); play(category, lv, steady); } }, [el('span', { class: 'lv-num', text: 'Level ' + lv })]));
    card.append(el('p', { class: 'sc-q', text: 'What shall we practise?' }), catRow, el('div', { class: 'steady-wrap' }, [steadyBtn]), el('p', { class: 'sc-q', text: 'Pick a level' }), levels);
    card.appendChild(el('div', { class: 'star-rule' }, [el('div', { html: starsRow(3, { size: 24 }) }), el('p', { text: 'Three stars: 8+ right with 5+ perfect taps.' })]));
    root.appendChild(card);
  }

  function play(category, level, steady) {
    clear(root);
    mutate(s => { s.seen.beatCat = category; s.seen.beatSteady = steady; });

    let question = makeBeatQuestion(category, level, null);
    let notes = [];              // active notes {lane, text, correct, spawnBeat, node, judged}
    let phraseIdx = 0, correct = 0, perfects = 0, misses = 0, combo = 0;
    let reAsked = false, resolving = false, ended = false;
    let startTime = 0;

    shell = createGameShell({ title: 'Boo Beat', rounds: PHRASES, accent: 'var(--star)', onBack: () => { stop(); ctx.go('hub'); }, hintEnabled: false });
    root.appendChild(shell.root);

    const qCard = el('div', { class: 'beat-question' });
    const field = el('div', { class: 'beat-field' });
    const laneEls = [];
    for (let i = 0; i < LANES; i++) {
      const lane = el('div', { class: 'beat-lane', dataset: { lane: String(i) } });
      lane.addEventListener('pointerdown', (e) => { e.preventDefault(); tapLane(i); });
      laneEls.push(lane); field.appendChild(lane);
    }
    const hitline = el('div', { class: 'beat-hitline' });
    const character = el('div', { class: 'beat-character', html: renderGuide(getState().guide, { view: 'head', size: 76 }) });
    field.append(hitline, character);
    shell.area.append(qCard, field);
    const collector = createTrickyCollector(shell.area);
    if (steady) field.classList.add('steady');

    const now = () => performance.now();
    const curBeat = () => (now() - startTime) / BEAT;

    renderQuestion();
    startTime = now();
    scheduleNotes(2);   // first phrase starts after a 2-beat lead-in
    raf = requestAnimationFrame(loop);
    let beatPulse = -1;

    function renderQuestion() {
      clear(qCard);
      qCard.appendChild(el('div', { class: 'beat-prompt', text: question.prompt }));
      if (question.speak) speakMaybe(question.speak);
      if (typeof window !== 'undefined') window.__booQuestion = question;
    }

    // Spawn the 3 candidate notes (one per lane), arriving together on a downbeat.
    function scheduleNotes(atBeat) {
      notes.forEach(n => n.node.remove());
      notes = [];
      const spawnBeat = Math.ceil(curBeat()) + atBeat;
      const lanes = shuffle([0, 1, 2]);
      question.options.forEach((text, i) => {
        const lane = lanes[i];
        const node = el('div', { class: 'beat-note', text: String(text) });
        laneEls[lane].appendChild(node);
        notes.push({ lane, text, correct: i === question.correct, spawnBeat, node, judged: false });
      });
      resolving = false;
    }

    function loop() {
      if (!document.hidden && !ended) update();
      raf = requestAnimationFrame(loop);
    }
    function update() {
      const cb = curBeat();
      // character bops on the beat
      const b = Math.floor(cb);
      if (b !== beatPulse) { beatPulse = b; if (!REDUCED) { character.classList.remove('bop'); void character.offsetWidth; character.classList.add('bop'); } }
      const fieldH = field.clientHeight || 400;
      for (const n of notes) {
        let prog = (cb - n.spawnBeat) / FALL;              // 0 at top, 1 at hit line
        if (steady) prog = Math.max(0, Math.floor(cb - n.spawnBeat)) / FALL; // discrete rows
        const y = Math.max(-0.1, prog) * (fieldH - 70);
        n.node.style.transform = `translateY(${y}px)`;
        n.node.classList.toggle('at-line', Math.abs(prog - 1) < (steady ? 0.13 : 0.16));
      }
      // in scroll mode, a note passing the line unresolved = a miss
      if (!steady && !resolving && notes.length) {
        const arrival = (notes[0].spawnBeat + FALL);
        if (cb > arrival + 0.32) missPhrase();
      }
      // in steady mode, if notes stepped past the hit row unresolved = a miss
      if (steady && !resolving && notes.length) {
        if (Math.floor(cb - notes[0].spawnBeat) > FALL) missPhrase();
      }
    }

    function tapLane(lane) {
      if (resolving || ended || !notes.length) return;
      const cb = curBeat();
      const arrival = notes[0].spawnBeat + FALL;
      let errMs;
      if (steady) {
        const row = Math.floor(cb - notes[0].spawnBeat);
        errMs = row === FALL ? 0 : Math.abs(row - FALL) * BEAT;  // aligned on the hit row = perfect
      } else {
        errMs = Math.abs(cb - arrival) * BEAT;
      }
      if (errMs > GOOD_MS) return;   // too early/late — no penalty, keep waiting
      const noteHere = notes.find(n => n.lane === lane);
      if (noteHere && noteHere.correct) awardCorrect(noteHere, errMs <= PERFECT_MS ? 'perfect' : 'good');
      else wrongTap();               // tapped a wrong-answer lane near the line
    }

    function awardCorrect(note, grade) {
      if (resolving) return;
      resolving = true;
      correct++; combo++; if (grade === 'perfect') perfects++;
      recordResult(question.key, true);
      sfx.correct();
      note.node.classList.add('hit', grade);
      const rc = note.node.getBoundingClientRect();
      if (!REDUCED) sparkleAt(rc.left + rc.width / 2, rc.top + rc.height / 2);
      if (combo >= 3) field.classList.add('combo');
      shell.react(grade === 'perfect' ? 'PERFECT! ✨' : 'Good!', { voice: false, hold: 1000 });
      nextPhrase(true);
    }

    function wrongTap() {
      combo = 0; field.classList.remove('combo');
      sfx.oops(); shell.dimHeart();
      missOrReask();
    }
    function missPhrase() {
      resolving = true; combo = 0; field.classList.remove('combo');
      sfx.oops(); shell.dimHeart();
      missOrReask();
    }
    function missOrReask() {
      resolving = true;
      if (!reAsked) { reAsked = true; shell.react(guideLine('oops'), { voice: false, hold: 1400 }); setTimeout(() => { if (!ended) scheduleNotes(2); }, 700); }
      else { misses++; recordResult(question.key, false); collector.add(choiceMiss({ id: question.key, game: 'beat', prompt: question.prompt, options: question.options, answer: question.options[question.correct] })); nextPhrase(false); }
    }

    function nextPhrase(wasCorrect) {
      reAsked = false;
      phraseIdx++;
      shell.setProgress(phraseIdx);
      if (phraseIdx >= PHRASES) return setTimeout(finish, 500);
      question = makeBeatQuestion(category, level, question.key);
      setTimeout(() => { if (ended) return; renderQuestion(); scheduleNotes(2); }, 450);
    }

    function finish() {
      if (ended) return; ended = true; stop(); shell.cleanup();
      const stars = starsForBeat(correct, perfects);
      if (perfects > 0) noteQuest('perfects', { count: perfects });   // daily quest (RUN3 C4)
      ctx.go('results', { game: 'beat', gameName: 'Boo Beat', stars, tricky: collector.items(), replay: () => ctx.go('beat') });
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }

    // Test hook (invisible): drive a headless round.
    if (typeof window !== 'undefined') window.__beat = {
      steady: () => steady,
      tapCorrect: (grade = 'perfect') => { const n = notes.find(x => x.correct); if (n && !resolving) awardCorrect(n, grade); },
      tapWrong: () => { const n = notes.find(x => !x.correct); if (n && !resolving) wrongTap(); },
      missNow: () => { if (!resolving) missPhrase(); },
      state: () => ({ phraseIdx, correct, perfects, misses, combo, ended, notes: notes.length, hearts: shell.heartsLeft() })
    };
    play._cleanup = () => {};
  }

  return { unmount() { if (raf) cancelAnimationFrame(raf); if (shell) shell.cleanup(); } };
}

export function starsForBeat(correct, perfects) {
  if (correct >= 8 && perfects >= 5) return 3;
  if (correct >= 6) return 2;
  return 1;
}
