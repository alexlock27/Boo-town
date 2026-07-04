// js/games/dash.js — Boo Dash (EXPANSION_2 frame 4).
// A gentle fluency runner with REAL motion: the ground scrolls under a trotting
// character while a gate (a fact + three answer arches) approaches from up the path,
// growing as it nears. Tap an arch to steer — the runner slides under it and dashes
// through. Wrong arch: a soft bonk, and the SAME fact re-approaches slower. If she
// doesn't answer, the gate simply waits at the line, bobbing — no death, no countdown,
// no falling behind. Pace quickens a little after a 3-streak. A round is 12 gates.

import { el, clear, starsRow, sparkleAt, REDUCED } from '../ui.js';
import { getState, recordResult, ledgerClass } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { BUBBLE_BY_KEY, BUBBLE_CATEGORIES, genQuestion, LEVEL_NAME } from '../../data/bubbleCategories.js';
import { buildPicker, recordBest, MIX_KEY } from '../picker.js';
import { mixPlan } from '../smartmix.js';
import { createTrickyCollector, choiceMiss } from '../trickypile.js';
import { filterCategories, filterLevels } from '../content.js';

const GATES = 12;
const HOLD_AT = 0.86;         // gates wait at 86% of the path until she answers
const DASH_MS = 320;          // dash-through time once she steers
const APPROACH_MS = 3300;     // slow trot
const APPROACH_FAST_MS = 2300;// after a 3-streak the trot quickens a little
const APPROACH_SLOW_MS = 5200;// after a bonk the same fact re-approaches slower
const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Boo Dash reuses the Bubble Pop generators (tables, bonds, add & subtract, doubles).
const DASH_CATS = ['tables', 'bonds', 'addsub', 'doubles'];

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen dash' });
  container.appendChild(root);
  let shell = null, raf = null;

  startCard();

  function startCard() {
    clear(root); music.play('game');
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(getState().guide, { view: 'head', size: 100 }) }),
      el('h2', { text: 'Boo Dash' }),
      el('p', { class: 'sc-intro', text: 'Trot along the path and dash through the arch with the right answer!' })
    ]);
    const picker = buildPicker({
      game: 'dash',
      choices: filterCategories(DASH_CATS.map(k => ({ key: k, name: BUBBLE_BY_KEY[k].name }))),
      levelsFor: (key) => filterLevels(BUBBLE_BY_KEY[key].levels),
      levelName: LEVEL_NAME,
      onStart: (catKey, level) => play(catKey, level)
    });
    card.appendChild(picker.node);
    card.appendChild(el('div', { class: 'star-rule' }, [el('div', { html: starsRow(3, { size: 24 }) }), el('p', { text: 'Three stars: a clean run, no bonks.' })]));
    root.appendChild(card);
  }

  function play(catKey, level) {
    clear(root);
    const mix = catKey === MIX_KEY;
    const plan = mix ? mixPlan(GATES) : null;
    let gate = 0, bonks = 0, streak = 0, ended = false;
    let question = null;
    let phase = 'approach';      // approach -> hold (waiting) -> dash -> resolve
    let prog = 0, duration = APPROACH_MS, pending = null;

    shell = createGameShell({ title: mix ? 'Smart Mix' : 'Boo Dash', rounds: GATES, accent: 'var(--pop)', onBack: () => { stop(); ctx.go('hub'); }, hintEnabled: false });
    root.appendChild(shell.root);

    const track = el('div', { class: 'dash-track' });
    const ground = el('div', { class: 'dash-ground' });
    const factCard = el('div', { class: 'dash-fact' });
    const archWrap = el('div', { class: 'dash-arches' });
    const runner = el('div', { class: 'dash-runner' }, [
      el('div', { class: 'dash-runner-inner', html: renderGuide(getState().guide, { view: 'head', size: 84 }) })
    ]);
    track.append(ground, factCard, archWrap, runner);
    shell.area.appendChild(track);
    const collector = createTrickyCollector(shell.area);
    const runnerInner = runner.firstChild;

    newQuestion();
    startApproach(false);
    startLoop();

    // ---- gate lifecycle ---------------------------------------------------
    // In Smart Mix, generate a weak-weighted fact from ALL dash categories per gate.
    function nextQuestion(slot) {
      if (!mix) return genQuestion(catKey, level, question && question.key);
      const cls = plan[slot] || 'middle';
      let best = null;
      for (let t = 0; t < 12; t++) {
        const k = DASH_CATS[rand(DASH_CATS.length)];
        const lv = BUBBLE_BY_KEY[k].levels[rand(BUBBLE_BY_KEY[k].levels.length)];
        const q = genQuestion(k, lv, question && question.key);
        if (!best) best = q;
        if (ledgerClass(q.key) === cls) return q;
      }
      return best;
    }
    function newQuestion() {
      question = nextQuestion(gate);
      factCard.textContent = question.display;
      buildArches();
      if (typeof window !== 'undefined') window.__dashCorrect = question.answer;
    }
    function buildArches() {
      clear(archWrap);
      const fmt = question.fmt || String;
      const opts = shuffle([{ v: question.answer, correct: true }, ...pickWrong(question).map(v => ({ v, correct: false }))]);
      opts.forEach(o => {
        const arch = el('button', { class: 'dash-arch', onclick: () => tap(o, arch) }, [
          el('div', { class: 'arch-top' }),
          el('div', { class: 'arch-label', text: fmt(o.v) })
        ]);
        archWrap.appendChild(arch);
      });
    }
    // The gate starts small and far (up the path) and approaches the runner.
    function startApproach(slower) {
      phase = 'approach'; prog = 0;
      duration = slower ? APPROACH_SLOW_MS : (streak >= 3 ? APPROACH_FAST_MS : APPROACH_MS);
      archWrap.classList.remove('waiting');
      runner.style.left = '50%';                   // back to the middle of the path
      track.classList.toggle('speedy', streak >= 3 && !REDUCED);
      if (REDUCED) { prog = 1; phase = 'hold'; }   // reduced motion: gate simply at the line
      applyTransform();
    }

    // ---- the motion loop ----------------------------------------------------
    function startLoop() {
      let last = performance.now();
      const step = (now) => {
        const dt = Math.min(64, now - last); last = now;
        if (!document.hidden && !ended) update(dt);
        raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
    function update(dt) {
      if (phase === 'approach') {
        prog = Math.min(HOLD_AT, prog + dt / duration);
        if (prog >= HOLD_AT) { phase = 'hold'; archWrap.classList.add('waiting'); } // waits, bobbing — no time pressure
        applyTransform();
      } else if (phase === 'dash') {
        prog = Math.min(1, prog + dt / DASH_MS);
        applyTransform();
        if (prog >= 1) { phase = 'resolve'; onArrive(); }
      }
    }
    // Approach = translate down the path + grow. Transform-only (cheap).
    function applyTransform() {
      const travel = Math.max(40, track.clientHeight - archWrap.offsetTop - archWrap.offsetHeight - 106);
      const s = 0.55 + 0.45 * prog;
      archWrap.style.transform = `translateY(${(prog * travel).toFixed(1)}px) scale(${s.toFixed(3)})`;
    }

    // ---- steering -----------------------------------------------------------
    function tap(o, arch) {
      if (ended || phase === 'dash' || phase === 'resolve') return;
      // steer: the runner slides across the path to under the chosen arch
      const ar = arch.getBoundingClientRect(), tr = track.getBoundingClientRect();
      runner.style.left = (ar.left + ar.width / 2 - tr.left) + 'px';
      if (o.correct) {
        pending = arch;
        archWrap.classList.remove('waiting');
        if (REDUCED) { phase = 'resolve'; prog = 1; applyTransform(); onArrive(); }
        else { phase = 'dash'; }                    // dash forward through the arch
        runnerInner.classList.remove('bonk'); void runnerInner.offsetWidth; runnerInner.classList.add('run');
      } else {
        // soft bonk on the wrong arch — same fact re-approaches, slower
        bonks++; streak = 0; sfx.oops();
        recordResult(question.key, false);
        collector.add(missFor(question));
        arch.classList.add('bonked'); setTimeout(() => arch.classList.remove('bonked'), 400);
        runnerInner.classList.remove('run'); void runnerInner.offsetWidth; runnerInner.classList.add('bonk');
        shell.react(guideLine('oops'), { voice: false, hold: 1400 });
        setTimeout(() => { runnerInner.classList.remove('bonk'); if (!ended) startApproach(true); }, 500);
      }
    }
    function onArrive() {
      sfx.correct(); streak++;
      recordResult(question.key, true);
      if (pending) {
        pending.classList.add('through');
        const r = pending.getBoundingClientRect();
        if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height * 0.3);
      }
      gate++; shell.setProgress(gate);
      setTimeout(() => {
        runnerInner.classList.remove('run'); pending = null;
        if (ended) return;
        if (gate >= GATES) return finish();
        newQuestion(); startApproach(false);
      }, 360);
    }

    function pickWrong(q) {
      const pool = q.distractors.filter(v => v !== q.answer);
      return shuffle(pool.slice()).slice(0, 2);
    }
    function missFor(q) {
      const f = q.fmt || String;
      const ds = pickWrong(q);
      return choiceMiss({ id: q.key, game: 'dash', prompt: q.display, options: [q.answer, ...ds].map(f), answer: f(q.answer) });
    }

    function finish() {
      if (ended) return; ended = true; stop(); shell.cleanup();
      const stars = bonks === 0 ? 3 : bonks <= 3 ? 2 : 1;
      recordBest('dash', mix ? MIX_KEY : catKey, stars);
      ctx.go('results', { game: 'dash', gameName: mix ? 'Smart Mix' : 'Boo Dash', stars, tricky: collector.items(), replay: () => ctx.go('dash') });
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }

    // test hook (invisible)
    if (typeof window !== 'undefined') window.__dash = {
      correct: () => question.answer,
      tap: (wantCorrect) => { const fmt = question.fmt || String; const btns = [...archWrap.querySelectorAll('.dash-arch')]; const t = btns.find(b => (b.querySelector('.arch-label').textContent === String(fmt(question.answer))) === wantCorrect); if (t) t.click(); },
      state: () => ({ gate, bonks, streak, ended, phase, prog: +prog.toFixed(3) }),
      ended: () => ended
    };
  }

  return { unmount() { if (raf) cancelAnimationFrame(raf); if (shell) shell.cleanup(); } };
}
