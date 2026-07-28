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
import { sfx, music, beatvoice, audioClockMs } from '../sfx.js';
import { BOO_POP_HITS } from '../../data/songs.js';
import { resolveItem } from '../customs.js';
import { makeBeatQuestion, autoQuestion, BLOCK_CATEGORIES } from '../questions.js';
import { timedGate } from '../smartmix.js';
import { arcadeHasPicker, filterArcadeCategories } from '../content.js';
import { pickForMeButton } from '../picker.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { nameWithValue, readAloudButton, readAloudOn } from '../a11y.js';

const AUTO = '__auto__';   // Light-tier arcade: no picker, Smart-Mix-driven (C9)

const LANES = 3;
const FALL = 4;                        // beats from top to the hit line
const PHRASES = 10;
// ---- RUN14 U2: the judge -------------------------------------------------------------
// U0 measured the old window: 80/160ms, and a press outside it was SILENTLY IGNORED — a
// child pressing 200ms early (entirely normal at nine) got no sound, no wobble, nothing.
// The window is now generous and honest, and the judge is INSTRUMENTED: every press logs
// its error so the constant is evidence-based. See tests/run14_hitwindow.md.
const PERFECT_MS = 110;                // a "Perfect!" — still a real achievement
const GOOD_MS = 220;                   // the authored starting point, tuned by simulation
const NEAR_MS = 380;                   // outside GOOD but clearly aimed: acknowledged with
                                       // a soft "so close!" wobble, NEVER silence
// ---- tap-along notes: the groove between questions ------------------------------------
// U2.4, and a PERMANENT RULE for every timed game in this app: difficulty rises through
// MUSIC — more tap-along notes and more syncopation — and NEVER by shortening thinking
// time. The reading lead and the judged window below are identical at every level; only
// this density changes.
const TAPALONG_PER_BAR = { 1: 2, 2: 3, 3: 4 };   // by level: how many groove notes per bar
const SYNCOPATION = { 1: 0, 2: 0.25, 3: 0.5 };   // by level: how often a groove note lands
                                                 // off the beat (an eighth late)
const BARS_PER_QUESTION = 4;           // a QUESTION TRIO every four bars, on the phrase
const QUESTION_LEAD_BARS = 1;          // the card appears one bar ahead — reading time
const BEATS_PER_BAR = 4;
const FEVER_COMBO = 6;                 // combo that lights the fever (C3)
const FEVER_CROWD = 5;                 // max Boos bouncing along the bottom in fever (named cap)
// Boo Beat's backing tracks ARE the Boo Pop Hits now (RUN9 C6): the same four originals the
// band plays. Each Hit is adapted to Beat's needs — `bpm` drives scheduling; `melody` (the
// Hit's tune, transposed into Beat's G4-relative frame) is the lead reserved for the player
// (every on-time correct tap plays the next note); `bass` is a synth bass from the chord roots.
const HIT_ROOT_OFFSET = { C: -7, G: 0, Am: 2, F: -2, Em: -3, Dm: -5 };   // chord root vs G (bass base ≈ G2)
function hitToBeatTrack(hit) {
  return {
    id: hit.id, name: hit.name + ' 🎵', bpm: hit.bpm,
    melody: hit.melody.filter(m => m.note !== 'rest').map(m => m.semi - 7),   // C4-relative → G4-relative; rests shape the sheet, not the lead
    bass: hit.progression.map(ch => HIT_ROOT_OFFSET[ch] != null ? HIT_ROOT_OFFSET[ch] : 0),
    chords: hit.progression
  };
}
const TRACKS = Object.fromEntries(BOO_POP_HITS.map(h => [h.id, hitToBeatTrack(h)]));
const TRACK_KEYS = BOO_POP_HITS.map(h => h.id);
const DEFAULT_TRACK = BOO_POP_HITS[0].id;   // "golden"
const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen beat' });
  container.appendChild(root);
  let shell = null, raf = null;

  // Jump back in / level-up (RUN5 C0b).
  const rz = params && params.resume;
  const steadyDef = REDUCED || !!getState().seen.beatSteady;
  const trackDef = (getState().seen.beatTrack && TRACKS[getState().seen.beatTrack]) ? getState().seen.beatTrack : DEFAULT_TRACK;
  if (rz) { rz.mix ? play(AUTO, 2, steadyDef, trackDef) : play(rz.cat, rz.level, steadyDef, trackDef); }
  else if (arcadeHasPicker()) startCard(); else play(AUTO, 2, steadyDef, trackDef);   // Light auto-starts (C9)
  maybeIntro('beat');   // first-ever open: the guided intro (RUN5 C5)

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    let category = s.seen.beatCat || 'tables';
    let steady = REDUCED || !!s.seen.beatSteady;   // reduced-motion defaults to steady
    let track = (s.seen.beatTrack && TRACKS[s.seen.beatTrack]) ? s.seen.beatTrack : DEFAULT_TRACK;
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
    const catRow = el('div', { class: 'chip-row center scroll' });   // RUN9 C1: category strip keeps ≤8 primary buttons on screen
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
    // RUN9 C1 tidy sweep: the tune + steady choice (rarely changed) tucks into a
    // collapsible reveal so the card leads with just practise + level (matching the
    // other arcade cards) and stays under the 8-primary-buttons rule. Everything is
    // still reachable in two taps (open reveal → tap), and nothing is removed.
    const tuneReveal = el('div', { class: 'tune-reveal', dataset: { open: 'false' } }, [
      el('p', { class: 'sc-q', text: 'Pick a tune' }), trackRow, el('div', { class: 'steady-wrap' }, [steadyBtn])
    ]);
    const tuneToggle = el('button', { class: 'btn soft tune-toggle', onclick: () => {
      const open = tuneReveal.dataset.open === 'true';
      tuneReveal.dataset.open = open ? 'false' : 'true';
      tuneToggle.querySelector('.tt-arrow').textContent = open ? '▸' : '▾';
      sfx.tap();
    } });
    const tuneLabel = () => `🎵 Tune: ${TRACKS[track].name}${steady ? ' · 🐢 Steady' : ''}`;
    const refreshTune = () => { tuneToggle.querySelector('.tt-lbl').textContent = tuneLabel(); };
    tuneToggle.append(el('span', { class: 'tt-lbl', text: tuneLabel() }), el('span', { class: 'tt-arrow', text: '▸' }));
    // keep the toggle label current as she changes track/steady inside the reveal
    trackRow.addEventListener('click', refreshTune);
    steadyBtn.addEventListener('click', refreshTune);
    card.append(pfmRow, el('p', { class: 'sc-q', text: 'What shall we practise?' }), catRow, tuneToggle, tuneReveal, el('p', { class: 'sc-q', text: 'Pick a level' }), levels);
    card.appendChild(el('div', { class: 'star-rule' }, [el('div', { html: starsRow(3, { size: 24 }) }), el('p', { text: 'Three stars: 8+ right with 5+ perfect taps.' })]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));   // shared back (job 3)
  }

  function play(category, level, steady, trackKey) {
    clear(root);
    const auto = category === AUTO;
    const track = TRACKS[trackKey] || TRACKS[DEFAULT_TRACK];
    // tempo choice (RUN9 C6): gentle (steady) plays the same Hit noticeably slower, so the
    // scheduling — backing interval + note fall — is audibly different in the logs.
    const STEADY_TEMPO = 1.28;
    const beatMs = (60000 / track.bpm) * (steady ? STEADY_TEMPO : 1);
    mutate(s => { if (!auto) s.seen.beatCat = category; s.seen.beatSteady = steady; s.seen.beatTrack = TRACKS[trackKey] ? trackKey : DEFAULT_TRACK; });

    // RUN18B Y10: Boo Beat is timed — a question arrives on a falling note whether she is
    // ready or not — so it practises what she has already got right. Measured once per round.
    const genOne = (prev) => auto ? autoQuestion(prev, 3, true) : makeBeatQuestion(category, level, prev);
    const gate = timedGate(() => genOne(null), PHRASES);
    let question = gate.pick(() => genOne(null));
    let notes = [];              // active QUESTION notes {lane, text, correct, spawnBeat, node, judged}
    let taps = [];               // active TAP-ALONG notes (RUN14 U2) — groove, any lane
    let phraseIdx = 0, correct = 0, perfects = 0, misses = 0, combo = 0, melodyIdx = 0;
    let reAsked = false, resolving = false, ended = false, fever = false;
    let startTime = 0, backingTimer = null, backingStep = 0;
    let nextGrooveBeat = 2, questionArrival = null, lastArrival = null, grooveHits = 0, grooveMissed = 0, grooveSpawned = 0;
    let rushPhrases = false;   // QA only (see scheduleNextQuestion)
    // The instrumented judge (U2.3): every press records its signed error in ms, what it
    // was aimed at, and the verdict. tests/r14u2-beat.mjs reads this to report the
    // distribution that justifies GOOD_MS. Capped so a long round cannot grow unbounded.
    const judgeLog = [];
    const logJudge = (entry) => { judgeLog.push(entry); if (judgeLog.length > 600) judgeLog.shift(); };

    music.stop();   // the backing track IS the music in Boo Beat now (C3)
    shell = createGameShell({ title: 'Boo Beat', rounds: PHRASES, accent: 'var(--star)', bank: () => ({ correct, of: PHRASES }),
      onBack: (b) => { stop(); if (b && b.stars > 0) ctx.go('results', { game: 'beat', gameName: 'Boo Beat', stars: b.stars, level, cat: auto ? null : category, mix: auto, tricky: collector.items(), partial: b, replay: () => ctx.go('beat') }); else ctx.go('hub'); },
      hintEnabled: false, onHelp: () => replayIntro('beat') });
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
    // RUN14 U2.3: the hit window is a PLACE, not a guess — a visible band around the line,
    // sized to the real GOOD_MS window at this tempo so what she sees is what is judged.
    const hitzone = el('div', { class: 'beat-hitzone', 'aria-hidden': 'true' });
    const hitline = el('div', { class: 'beat-hitline' });
    const character = el('div', { class: 'beat-character', html: renderGuide(getState().guide, { view: 'head', size: 76 }) });
    const crowd = el('div', { class: 'beat-crowd' });   // fever crowd of her own Boos
    field.append(hitzone, hitline, character, crowd);
    // the band's height IS the window: (GOOD_MS / beatMs) beats of travel, both sides
    requestAnimationFrame(() => {
      const fieldH = field.clientHeight || 400;
      const perBeat = (fieldH - 70) / FALL;
      hitzone.style.height = Math.round(2 * (GOOD_MS / beatMs) * perBeat) + 'px';
    });
    shell.area.append(qCard, field);
    const collector = createTrickyCollector(shell.area);
    if (steady) field.classList.add('steady');

    // RUN12 S6: the round clock skips whatever the intro overlay held it for, so a note
    // that was two beats away when the child opened the intro is still two beats away.
    const now = () => audioClockMs() - shell.pausedMs();
    const curBeat = () => (now() - startTime) / beatMs;

    // ---- backing track (RUN9 C6 addendum — the specified pop backing, never optional):
    // kick on beats 1 & 3, snare on 2 & 4, hats in EIGHTHS with a small fill every fourth
    // bar, bass on the chord roots with passing notes, chord stabs landing OFF-beat.
    // Runs on an eighth-note grid (beatMs/2 per step, 8 steps/bar), music bus (ducks w/ TTS).
    function startBacking() {
      if (backingTimer) return;
      sfx.tap(); // Wake up audio context if suspended
      backingTimer = setInterval(scheduleBacking, 60);
    }
    
    function scheduleBacking() {
      if (document.hidden || ended || shell.paused()) return;   // audio scheduling held too
      const tNow = audioClockMs() / 1000;
      const tStart = startTime / 1000;
      let nextTime = tStart + (backingStep * beatMs / 2000);
      
      while (nextTime < tNow + 0.3) {
        const step = backingStep % 8;
        const bar = Math.floor(backingStep / 8);
        const fillBar = bar % 4 === 3;
        
        const v = 0.85 + Math.random() * 0.3; // humanize
        // hats
        if (fillBar && step >= 6) beatvoice.backingDrum('snare', { time: nextTime, vel: v });
        else beatvoice.backingDrum('hihat', { time: nextTime, vel: v * (step % 2 === 0 ? 1 : 0.6) });
        
        // kick / snare
        if (step === 0 || step === 4) beatvoice.backingDrum('kick', { time: nextTime, vel: v });
        if (step === 2 || step === 6) beatvoice.backingDrum('snare', { time: nextTime, vel: v });
        
        // bass
        const rootIdx = bar % track.bass.length;
        if (step % 2 === 0) beatvoice.bass(98 * Math.pow(2, track.bass[rootIdx] / 12), { time: nextTime, vel: v });
        else if (step === 7) beatvoice.bass(98 * Math.pow(2, ((track.bass[rootIdx] + track.bass[(rootIdx + 1) % track.bass.length]) / 2) / 12), { time: nextTime, vel: v });
        
        // stab
        if ((step === 3 || step === 7) && track.chords) beatvoice.stab(track.chords[rootIdx], { time: nextTime, vel: v });
        
        backingStep++;
        nextTime = tStart + (backingStep * beatMs / 2000);
      }
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
    // The first trio lands on bar 2's downbeat: a bar of groove to feel the pulse, then
    // the question — and every trio after it is exactly four bars on from this one.
    lastArrival = 2 * BEATS_PER_BAR;
    questionArrival = lastArrival;
    shell.after(Math.max(0, (lastArrival - FALL - curBeat()) * beatMs), () => { if (!ended) scheduleNotesAt(lastArrival - FALL); });
    raf = requestAnimationFrame(loop);
    let beatPulse = -1;

    function renderQuestion() {
      clear(qCard);
      qCard.appendChild(el('div', { class: 'beat-prompt', text: question.prompt }));
      if (readAloudOn()) qCard.appendChild(readAloudButton(() => question && question.prompt));
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
        // RUN12 S13.4: a lane note announces the answer it carries
        const node = el('div', { class: 'beat-note', text: String(text), role: 'img', 'aria-label': nameWithValue('note', text) });
        laneEls[lane].appendChild(node);
        notes.push({ lane, text, correct: i === question.correct, spawnBeat, node, judged: false });
      });
      resolving = false;
      questionArrival = spawnBeat + FALL;
    }

    // ---- RUN14 U2: TAP-ALONG NOTES ------------------------------------------------------
    // The hands are never idle. Between question trios, groove notes flow on the beat and
    // ANY lane accepts them — no learning value, all rhythm, which is exactly what makes a
    // rhythm game feel like playing along to a song you like. U0 measured the old game as
    // tappable 13.2% of a round; these fill the rest.
    function spawnTapAlong(beat) {
      const lane = rand(LANES);
      const node = el('div', { class: 'beat-note tapalong', 'aria-hidden': 'true', html: '<span class="ta-dot"></span>' });
      laneEls[lane].appendChild(node);
      taps.push({ lane, spawnBeat: beat, node, judged: false, arrival: beat + FALL });
    }
    // Schedule the groove up to a beat ahead, one pass per frame — never a burst.
    function scheduleGroove(cb) {
      const per = steady ? Math.max(1, (TAPALONG_PER_BAR[level] || 2) - 1) : (TAPALONG_PER_BAR[level] || 2);
      const step = BEATS_PER_BAR / per;                    // beats between groove notes
      const syncop = steady ? 0 : (SYNCOPATION[level] || 0);
      while (nextGrooveBeat < cb + FALL + 1) {
        // stay off the downbeat a question trio lands on, so the answer is never crowded
        const isQuestionBeat = questionArrival != null && Math.abs(nextGrooveBeat + FALL - questionArrival) < 0.51;
        // syncopation: some groove notes land an eighth late — harder to feel, same window
        const off = (syncop && grooveSpawned % 2 === 1 && Math.random() < syncop) ? 0.5 : 0;
        if (!isQuestionBeat) { spawnTapAlong(nextGrooveBeat + off); grooveSpawned++; }
        nextGrooveBeat += step;
      }
    }

    function loop() {
      if (!document.hidden && !ended && !shell.paused()) update();   // frozen behind an intro
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
      // ---- tap-along notes: the groove (RUN14 U2) ----
      scheduleGroove(cb);
      for (let i = taps.length - 1; i >= 0; i--) {
        const t = taps[i];
        const prog = (cb - t.spawnBeat) / FALL;
        t.node.style.transform = `translateY(${Math.max(-0.1, prog) * (fieldH - 70)}px)`;
        t.node.classList.toggle('at-line', Math.abs(prog - 1) < 0.18);
        // a groove note that sails past is simply gone — never a miss, never a penalty:
        // the tap-alongs are worth no learning value and must cost nothing (G12's spirit)
        if (!t.judged && (cb - t.arrival) * beatMs > NEAR_MS) { t.judged = true; grooveMissed++; }
        if (prog > 1.35) { t.node.remove(); taps.splice(i, 1); }
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

    // RUN14 U2: one judge for every press. It decides what the tap was AIMED at (the
    // question trio if one is at the line, else the nearest groove note in that lane),
    // measures the signed error, logs it, and — this is the part U0 found broken — NEVER
    // ignores a press silently. Outside the window she gets a "so close!" wobble.
    function tapLane(lane) {
      if (ended) return;
      const cb = curBeat();
      const now = () => 0;
      // 1) is the QUESTION trio the thing she is aiming at?
      if (notes.length && !resolving) {
        const arrival = notes[0].spawnBeat + FALL;
        let errMs;
        if (steady) {
          const row = Math.floor(cb - notes[0].spawnBeat);
          errMs = row === FALL ? 0 : (row - FALL) * beatMs;
        } else {
          errMs = (cb - arrival) * beatMs;
        }
        const absErr = Math.abs(errMs);
        if (absErr <= NEAR_MS) {
          const noteHere = notes.find(n => n.lane === lane);
          const grade = absErr <= PERFECT_MS ? 'perfect' : absErr <= GOOD_MS ? 'good' : 'near';
          logJudge({ kind: 'question', errMs: Math.round(errMs), grade, lane, correctLane: !!(noteHere && noteHere.correct), steady });
          if (grade === 'near') { nearMiss(absErr > 0 && errMs < 0 ? 'early' : 'late'); return; }
          if (noteHere && noteHere.correct) awardCorrect(noteHere, grade);
          else wrongTap();
          return;
        }
      }
      // 2) otherwise it is the groove: the nearest tap-along in this lane
      const cand = taps.filter(t => !t.judged && t.lane === lane)
        .sort((a, b) => Math.abs(cb - a.arrival) - Math.abs(cb - b.arrival))[0];
      if (cand) {
        const errMs = (cb - cand.arrival) * beatMs, absErr = Math.abs(errMs);
        if (absErr <= GOOD_MS) {
          cand.judged = true; grooveHits++;
          cand.node.classList.add('hit');
          setTimeout(() => { cand.node.remove(); taps = taps.filter(t => t !== cand); }, 160);
          logJudge({ kind: 'groove', errMs: Math.round(errMs), grade: absErr <= PERFECT_MS ? 'perfect' : 'good', lane });
          // the groove answers with the song, not with a score
          beatvoice.melody(track.melody[(melodyIdx + grooveHits) % track.melody.length], { sparkle: false, vel: 0.5 });
          if (!REDUCED) { const r = cand.node.getBoundingClientRect(); if (r.width) sparkleAt(r.left + r.width / 2, r.top + r.height / 2); }
          return;
        }
        logJudge({ kind: 'groove', errMs: Math.round(errMs), grade: 'near', lane });
      } else {
        logJudge({ kind: 'empty', errMs: null, grade: 'none', lane });
      }
      // 3) nothing to hit, or well outside: a tiny tick so the tap is never silence
      sfx.tap();
      laneEls[lane].classList.remove('lane-tick'); void laneEls[lane].offsetWidth; laneEls[lane].classList.add('lane-tick');
    }
    // A press clearly aimed at the answer but outside the honest window: acknowledged
    // warmly and NOT counted as wrong. She tried; the round simply waits for her.
    function nearMiss(side) {
      shell.react(side === 'early' ? 'So close — a tiny bit early!' : 'So close — a tiny bit late!', { voice: false, hold: 900 });
      field.classList.remove('near-wobble'); void field.offsetWidth; field.classList.add('near-wobble');
      sfx.tap();
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
      missOrReask(true);
    }
    // A note passing the hit line with no tap. The child did not answer wrongly — she did
    // not answer at all (RUN12 S2). The round still moves on and the star maths is unchanged;
    // only the LEDGER consequence differs, because an unanswered question is a non-event.
    function missPhrase() {
      resolving = true; breakCombo();
      beatvoice.thud(); shell.dimHeart();
      missOrReask(false);
    }
    function missOrReask(attempted) {
      resolving = true;
      if (!reAsked) { reAsked = true; shell.react(guideLine('oops'), { voice: false, hold: 1400 }); notes.forEach(n => n.node.remove()); notes = []; scheduleNextQuestion(); }
      else {
        misses++;                                  // star maths unchanged either way
        if (attempted) {
          recordResult(question.key, false);
          collector.addAttempted(choiceMiss({ id: question.key, game: 'beat', prompt: question.prompt, options: question.options, answer: question.options[question.correct] }));
        } else {
          collector.noteUnattempted();
        }
        nextPhrase(false);
      }
    }

    // RUN14 U2.2: QUESTIONS ON THE PHRASE. The next trio lands on the downbeat four bars
    // on, and its card appears ONE BAR AHEAD so there is reading time. Nothing stops the
    // music: the groove keeps flowing underneath while she reads and while she waits.
    function scheduleNextQuestion() {
      const cb = curBeat();
      // Exactly BARS_PER_QUESTION bars after the LAST trio, not after "now" — otherwise a
      // fast answer and a slow one produce different cadences and the music stops feeling
      // like a phrase. If that slot has already passed (a very slow round), take the next.
      // QA-only: `rush` shortens the PHRASE SPACING (never the reading lead, never the
      // judged window) so a suite can drive ten phrases in twenty seconds instead of
      // ninety. Nothing in the product sets it; it exists so tests about star maths and
      // the ledger do not have to sit through the music they are not measuring.
      const period = (rushPhrases ? 1 : BARS_PER_QUESTION) * BEATS_PER_BAR;
      let arrivalBeat = (lastArrival != null ? lastArrival : Math.ceil(cb / BEATS_PER_BAR) * BEATS_PER_BAR) + period;
      while (arrivalBeat - cb < FALL + 1) arrivalBeat += period;
      lastArrival = arrivalBeat;
      const cardBeat = arrivalBeat - QUESTION_LEAD_BARS * BEATS_PER_BAR;
      questionArrival = arrivalBeat;
      const showIn = Math.max(0, (cardBeat - cb) * beatMs);
      shell.after(showIn, () => {
        if (ended) return;
        renderQuestion();
        // spawn so the notes ARRIVE on the phrase downbeat (they fall for FALL beats)
        const spawnIn = Math.max(0, (arrivalBeat - FALL - curBeat()) * beatMs);
        shell.after(spawnIn, () => { if (!ended) scheduleNotesAt(arrivalBeat - FALL); });
      });
    }
    function scheduleNotesAt(spawnBeat) {
      notes.forEach(n => n.node.remove());
      notes = [];
      const lanes = shuffle([0, 1, 2]);
      question.options.forEach((text, i) => {
        const lane = lanes[i];
        const node = el('div', { class: 'beat-note', text: String(text), role: 'img', 'aria-label': nameWithValue('note', text) });
        laneEls[lane].appendChild(node);
        notes.push({ lane, text, correct: i === question.correct, spawnBeat, node, judged: false });
      });
      resolving = false;
      questionArrival = spawnBeat + FALL;
    }

    function nextPhrase(wasCorrect) {
      reAsked = false;
      phraseIdx++;
      shell.setProgress(phraseIdx);
      if (phraseIdx >= PHRASES) return shell.after(500, finish);
      question = gate.pick(() => genOne(question.key));
      // clear the resolved trio immediately — the groove carries the round onward
      notes.forEach(n => n.node.remove());
      notes = [];
      scheduleNextQuestion();
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
      track: () => TRACKS[trackKey] ? trackKey : DEFAULT_TRACK,
      // RUN18B Y10 QA: what she is being asked, and whether the eligible pool was big enough.
      key: () => question && question.key,
      gate: () => ({ on: gate.on, found: gate.found, want: gate.want }),
      tapCorrect: (grade = 'perfect') => { const n = notes.find(x => x.correct); if (n && !resolving) awardCorrect(n, grade); },
      tapWrong: () => { const n = notes.find(x => !x.correct); if (n && !resolving) wrongTap(); },
      missNow: () => { if (!resolving) missPhrase(); },
      melodyIdx: () => melodyIdx,
      fever: () => fever,
      crowd: () => crowd.children.length,
      melodyLen: () => track.melody.length,
      state: () => ({ phraseIdx, correct, perfects, misses, combo, ended, resolving, notes: notes.length, hearts: shell.heartsLeft() }),
      // RUN14 U2 hooks: the groove, the judge's log, and the beat clock.
      constants: () => ({ PERFECT_MS, GOOD_MS, NEAR_MS, FALL, BARS_PER_QUESTION, QUESTION_LEAD_BARS, BEATS_PER_BAR,
        // the EFFECTIVE groove density for this round (steady thins it), not the raw table
        tapAlongPerBar: steady ? Math.max(1, (TAPALONG_PER_BAR[level] || 2) - 1) : (TAPALONG_PER_BAR[level] || 2),
        syncopation: steady ? 0 : (SYNCOPATION[level] || 0), beatMs, level }),
      taps: () => taps.map(t => ({ lane: t.lane, arrival: t.arrival, judged: t.judged })),
      tapsOnScreen: () => taps.length,
      grooveStats: () => ({ hits: grooveHits, missed: grooveMissed }),
      judgeLog: () => judgeLog.slice(),
      beat: () => curBeat(),
      questionArrival: () => questionArrival,
      // tap a lane at a controlled offset from the trio's arrival (for the distribution)
      tapAt: (lane, offsetMs) => {
        const target = (questionArrival != null ? questionArrival : curBeat()) + offsetMs / beatMs;
        const waitMs = (target - curBeat()) * beatMs;
        if (waitMs > 0) return new Promise(r => setTimeout(() => { tapLane(lane); r(true); }, waitMs));
        tapLane(lane); return Promise.resolve(false);
      },
      tapLane: (lane) => tapLane(lane),
      // QA only: shorten the spacing BETWEEN phrases (never the reading lead or the
      // window) so a suite can drive a full round without sitting through 90s of music.
      rush: (on = true) => { rushPhrases = !!on; return rushPhrases; },
      anythingTappable: () => !!(document.querySelector('.beat-note.at-line')),
      musicRunning: () => !!backingTimer
    };
  }

  return { unmount() { if (raf) cancelAnimationFrame(raf); if (play._cleanup) play._cleanup(); if (shell) shell.cleanup(); } };
}

export function starsForBeat(correct, perfects) {
  if (correct >= 8 && perfects >= 5) return 3;
  if (correct >= 6) return 2;
  return 1;
}
