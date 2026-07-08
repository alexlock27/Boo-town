// js/games/beat.js — Boo Beat (spec RUN2 C6).
// A three-lane rhythm game on the game's music, 100 BPM. Each phrase poses a question;
// three on-beat notes carry candidate answers down the lanes; tap the correct lane as
// its note reaches the glowing hit line where the player's character bops.
// Steady mode (and reduced-motion default): notes step one row per beat, no speed pressure.

import { el, clear, starsRow, sparkleAt, REDUCED, backControl } from '../ui.js';
import { getState, mutate, recordResult } from '../state.js';
import { createTrickyCollector, choiceMiss } from '../trickypile.js';
import { noteQuest } from '../quests.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide, renderItem } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music, beatvoice } from '../sfx.js';
import { resolveItem } from '../customs.js';
import { makeBeatQuestion, autoQuestion, BLOCK_CATEGORIES } from '../questions.js';
import { arcadeHasPicker, filterArcadeCategories } from '../content.js';
import { pickForMeButton } from '../picker.js';
import { maybeIntro, replayIntro } from '../intro.js';

const AUTO = '__auto__';   // Light-tier arcade: no picker, Smart-Mix-driven (C9)

const LANES = 3;
const FALL = 4;                        // beats from top to the hit line
const PHRASES = 10;
const PERFECT_MS = 80, GOOD_MS = 160;
const FEVER_COMBO = 6;                 // combo that lights the fever (C3)
const FEVER_CROWD = 5;                 // max Boos bouncing along the bottom in fever (named cap)
// Three selectable backing tracks (C3). Tempo stays kid-tuned (≤100 BPM, chill slower).
// `melody` is the lead reserved for the player: every on-time correct tap plays the next note.
const TRACKS = {
  chill:  { name: 'Chill 🌙',  bpm: 84,  bass: [0, 0, -5, -3], melody: [0, 2, 4, 7, 4, 2, 0, -3, 0, 4, 7, 9, 7, 4, 2, 0] },
  pop:    { name: 'Pop ✨',    bpm: 96,  bass: [0, -3, -5, -3], melody: [7, 7, 9, 7, 4, 2, 0, 2, 4, 4, 2, 0, -1, 0, 2, 4] },
  bounce: { name: 'Bounce 🎈', bpm: 100, bass: [0, 0, 5, 3], melody: [0, 4, 7, 12, 7, 4, 0, 4, 9, 7, 4, 2, 4, 7, 4, 0] }
};
const TRACK_KEYS = ['chill', 'pop', 'bounce'];
const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen beat' });
  container.appendChild(root);
  let shell = null, raf = null;

  // Jump back in / level-up (RUN5 C0b).
  const rz = params && params.resume;
  const steadyDef = REDUCED || !!getState().seen.beatSteady;
  const trackDef = (getState().seen.beatTrack && TRACKS[getState().seen.beatTrack]) ? getState().seen.beatTrack : 'pop';
  if (rz) { rz.mix ? play(AUTO, 2, steadyDef, trackDef) : play(rz.cat, rz.level, steadyDef, trackDef); }
  else if (arcadeHasPicker()) startCard(); else play(AUTO, 2, steadyDef, trackDef);   // Light auto-starts (C9)
  maybeIntro('beat');   // first-ever open: the guided intro (RUN5 C5)

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    let category = s.seen.beatCat || 'tables';
    let steady = REDUCED || !!s.seen.beatSteady;   // reduced-motion defaults to steady
    let track = (s.seen.beatTrack && TRACKS[s.seen.beatTrack]) ? s.seen.beatTrack : 'pop';
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 104 }) }),
      el('h2', { text: 'Boo Beat' }),
      el('p', { class: 'sc-intro', text: 'Right answers play the tune! Tap the beat.' })
    ]);
    // choose the backing track (C3)
    const trackRow = el('div', { class: 'chip-row center beat-tracks' });
    TRACK_KEYS.forEach(k => {
      const b = el('button', { class: 'acc-chip' + (track === k ? ' sel' : ''), text: TRACKS[k].name, onclick: () => { track = k; sfx.tap(); trackRow.querySelectorAll('.acc-chip').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); } });
      trackRow.appendChild(b);
    });
    const catRow = el('div', { class: 'chip-row center' });
    filterArcadeCategories(BLOCK_CATEGORIES).forEach(c => {
      const b = el('button', { class: 'acc-chip' + (category === c.key ? ' sel' : ''), text: c.name, onclick: () => { category = c.key; sfx.tap(); catRow.querySelectorAll('.acc-chip').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); } });
      catRow.appendChild(b);
    });
    const steadyBtn = el('button', { class: 'acc-chip' + (steady ? ' sel' : ''), onclick: () => { steady = !steady; sfx.tap(); steadyBtn.classList.toggle('sel', steady); steadyBtn.textContent = steady ? '🐢 Steady mode: ON' : '🐢 Steady mode: off'; } });
    steadyBtn.textContent = steady ? '🐢 Steady mode: ON' : '🐢 Steady mode: off';
    const levels = el('div', { class: 'level-row' });
    for (const lv of [1, 2, 3]) levels.appendChild(el('button', { class: 'btn level-btn', style: { '--accent': 'var(--star)' }, onclick: () => { sfx.tap(); play(category, lv, steady, track); } }, [el('span', { class: 'lv-num', text: 'Level ' + lv })]));
    // one-tap Smart-Mix front door (RUN4 C2), same control as the shared pickers
    const pfmRow = el('div', { class: 'picker-choices' }, [pickForMeButton(() => play(AUTO, 2, steady, track))]);
    card.append(pfmRow, el('p', { class: 'sc-q', text: 'What shall we practise?' }), catRow, el('p', { class: 'sc-q', text: 'Pick a tune' }), trackRow, el('div', { class: 'steady-wrap' }, [steadyBtn]), el('p', { class: 'sc-q', text: 'Pick a level' }), levels);
    card.appendChild(el('div', { class: 'star-rule' }, [el('div', { html: starsRow(3, { size: 24 }) }), el('p', { text: 'Three stars: 8+ right with 5+ perfect taps.' })]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));   // shared back (job 3)
  }

  function play(category, level, steady, trackKey) {
    clear(root);
    const auto = category === AUTO;
    const track = TRACKS[trackKey] || TRACKS.pop;
    const beatMs = 60000 / track.bpm;
    mutate(s => { if (!auto) s.seen.beatCat = category; s.seen.beatSteady = steady; s.seen.beatTrack = TRACKS[trackKey] ? trackKey : 'pop'; });

    let question = auto ? autoQuestion(null, 3, true) : makeBeatQuestion(category, level, null);
    let notes = [];              // active notes {lane, text, correct, spawnBeat, node, judged}
    let phraseIdx = 0, correct = 0, perfects = 0, misses = 0, combo = 0, melodyIdx = 0;
    let reAsked = false, resolving = false, ended = false, fever = false;
    let startTime = 0, backingTimer = null, backingStep = 0;

    music.stop();   // the backing track IS the music in Boo Beat now (C3)
    shell = createGameShell({ title: 'Boo Beat', rounds: PHRASES, accent: 'var(--star)', onBack: () => { stop(); ctx.go('hub'); }, hintEnabled: false, onHelp: () => replayIntro('beat') });
    root.appendChild(shell.root);

    const qCard = el('div', { class: 'beat-question' });
    const field = el('div', { class: 'beat-field highway' });
    field.appendChild(el('div', { class: 'beat-road' }));   // soft perspective highway backdrop (C3)
    const laneEls = [];
    for (let i = 0; i < LANES; i++) {
      const lane = el('div', { class: 'beat-lane', dataset: { lane: String(i) } });
      lane.addEventListener('pointerdown', (e) => { e.preventDefault(); tapLane(i); });
      laneEls.push(lane); field.appendChild(lane);
    }
    const hitline = el('div', { class: 'beat-hitline' });
    const character = el('div', { class: 'beat-character', html: renderGuide(getState().guide, { view: 'head', size: 76 }) });
    const crowd = el('div', { class: 'beat-crowd' });   // fever crowd of her own Boos
    field.append(hitline, character, crowd);
    shell.area.append(qCard, field);
    const collector = createTrickyCollector(shell.area);
    if (steady) field.classList.add('steady');

    const now = () => performance.now();
    const curBeat = () => (now() - startTime) / beatMs;

    // ---- backing track (C3): soft drums + bass, never stops, on the music bus (ducks w/ TTS) ----
    function startBacking() {
      if (backingTimer) return;
      backingTimer = setInterval(() => {
        if (document.hidden || ended) return;
        const step = backingStep % 8;
        if (step % 2 === 0) beatvoice.backingDrum('hihat');
        if (step === 0 || step === 4) beatvoice.backingDrum('kick');
        if (step === 2 || step === 6) beatvoice.backingDrum('snare');
        if (step % 2 === 0) beatvoice.bass(98 * Math.pow(2, track.bass[(backingStep / 2 | 0) % track.bass.length] / 12));
        backingStep++;
      }, beatMs / 2);
    }
    function stopBacking() { if (backingTimer) { clearInterval(backingTimer); backingTimer = null; } }
    // ---- combo fever (C3): the highway blooms, a Boo crowd bounces, the melody shimmers ----
    function enterFever() { fever = true; field.classList.add('fever'); renderCrowd(); }
    function exitFever() { if (!fever) return; fever = false; field.classList.remove('fever'); clear(crowd); }
    function renderCrowd() {
      clear(crowd);
      const st = getState();
      let boos = Object.keys(st.inventory || {}).filter(id => (st.inventory[id] || 0) > 0 && (resolveItem(id) || {}).kind === 'boo');
      if (!boos.length) boos = ['boo_inky', 'boo_plum', 'boo_pippin'];
      boos.slice(0, FEVER_CROWD).forEach((id, i) => {
        const b = el('div', { class: 'beat-crowd-boo', html: renderItem(resolveItem(id) || { id, kind: 'boo', name: 'Boo', rarity: 'common' }, { size: 40 }) });
        b.style.setProperty('--i', String(i)); b.style.left = (8 + i * 20) + '%';
        crowd.appendChild(b);
      });
    }

    renderQuestion();
    startTime = now();
    startBacking();
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
        errMs = row === FALL ? 0 : Math.abs(row - FALL) * beatMs;  // aligned on the hit row = perfect
      } else {
        errMs = Math.abs(cb - arrival) * beatMs;
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
      // her on-time correct tap PLAYS the next melody note (C3): +sparkle harmonic on a
      // Perfect, +shimmer layer while combo fever is lit.
      beatvoice.melody(track.melody[melodyIdx % track.melody.length], { sparkle: grade === 'perfect', shimmer: fever });
      melodyIdx++;
      note.node.classList.add('hit', grade);
      const rc = note.node.getBoundingClientRect();
      if (!REDUCED) sparkleAt(rc.left + rc.width / 2, rc.top + rc.height / 2);
      if (combo >= 3) field.classList.add('combo');
      if (combo >= FEVER_COMBO && !fever) enterFever();
      shell.react(grade === 'perfect' ? 'Perfect! ✨' : 'Nice!', { voice: false, hold: 1000 });
      nextPhrase(true);
    }

    function breakCombo() { combo = 0; field.classList.remove('combo'); exitFever(); }   // gentle: no jeers
    function wrongTap() {
      breakCombo();
      beatvoice.thud(); shell.dimHeart();   // a miss is a soft thud, never silence (C3)
      missOrReask();
    }
    function missPhrase() {
      resolving = true; breakCombo();
      beatvoice.thud(); shell.dimHeart();
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
      question = auto ? autoQuestion(question.key, 3, true) : makeBeatQuestion(category, level, question.key);
      setTimeout(() => { if (ended) return; renderQuestion(); scheduleNotes(2); }, 450);
    }

    function finish() {
      if (ended) return; ended = true; stop(); shell.cleanup();
      const stars = starsForBeat(correct, perfects);
      if (perfects > 0) noteQuest('perfects', { count: perfects });   // daily quest (RUN3 C4)
      ctx.go('results', { game: 'beat', gameName: 'Boo Beat', stars, level, cat: auto ? null : category, mix: auto, tricky: collector.items(), replay: () => ctx.go('beat') });
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; stopBacking(); }
    play._cleanup = () => { stopBacking(); };

    // Test hook (invisible): drive a headless round.
    if (typeof window !== 'undefined') window.__beat = {
      steady: () => steady,
      track: () => TRACKS[trackKey] ? trackKey : 'pop',
      tapCorrect: (grade = 'perfect') => { const n = notes.find(x => x.correct); if (n && !resolving) awardCorrect(n, grade); },
      tapWrong: () => { const n = notes.find(x => !x.correct); if (n && !resolving) wrongTap(); },
      missNow: () => { if (!resolving) missPhrase(); },
      melodyIdx: () => melodyIdx,
      fever: () => fever,
      crowd: () => crowd.children.length,
      melodyLen: () => track.melody.length,
      state: () => ({ phraseIdx, correct, perfects, misses, combo, ended, resolving, notes: notes.length, hearts: shell.heartsLeft() })
    };
  }

  return { unmount() { if (raf) cancelAnimationFrame(raf); if (play._cleanup) play._cleanup(); if (shell) shell.cleanup(); } };
}

export function starsForBeat(correct, perfects) {
  if (correct >= 8 && perfects >= 5) return 3;
  if (correct >= 6) return 2;
  return 1;
}
