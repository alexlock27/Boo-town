// js/games/dash.js — Boo Dash, run-up-and-wait (DASH_PATCH job 2; supersedes the
// EXPANSION_2 frame-4 runner and the phase-9b hotfix).
//
// Behind-the-character view down a 3-lane path with parallax scenery (road stripes,
// roadside trees, drifting clouds) and a visible trot cycle. Each question spawns three
// labelled gates ahead — one per lane, exactly one correct, never an ungated lane — while
// the question stays readable on a fixed card at the top. The Boo runs up to the gates,
// then the world EASES TO A STOP and the Boo jogs on the spot: no timer, nothing keeps
// approaching, nothing can be failed by waiting. Tapping the correct gate pops its doors
// open with a sparkle and the run continues through it; a 3-streak makes the running
// stretches faster and smoother. A wrong tap is a soft bonk: the gate wobbles, a heart
// dims, and the same question stays. 12 gates a round; star rules unchanged. Steady mode
// (gates simply appear at the line, no travel) only via prefers-reduced-motion or the
// explicit toggle on the start card — never the default.

import { el, clear, starsRow, sparkleAt, REDUCED, backControl } from '../ui.js';
import { getState, mutate, recordResult, ledgerClass } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { BUBBLE_BY_KEY, BUBBLE_CATEGORIES, genQuestion, LEVEL_NAME } from '../../data/bubbleCategories.js';
import { buildPicker, recordBest, MIX_KEY } from '../picker.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { mixPlan } from '../smartmix.js';
import { createTrickyCollector, choiceMiss } from '../trickypile.js';
import { filterCategories, filterLevels } from '../content.js';

const GATES = 12;
// world geometry (abstract z units; the stop line is d = 0)
const SPAWN = 100;            // gates spawn this far ahead
const RUN_MS = 1350;          // a run stretch: ease in, cruise, ease to a stop
const RUN_MS_FAST = 900;      // after a 3-streak the stretches are faster and smoother
const OPEN_MS = 140;          // sparkle beat before the run continues through the doors
const HORIZON_Y = 0.30, STOP_Y = 0.78;   // gate row travel, as a fraction of scene height
const PROP_STEP = 15, PROP_COUNT = 12;   // roadside scenery spacing / pool

const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Boo Dash reuses the Bubble Pop generators (tables, bonds, add & subtract, doubles).
const DASH_CATS = ['tables', 'bonds', 'addsub', 'doubles'];

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen dash' });
  container.appendChild(root);
  let shell = null, raf = null;

  // Jump back in / level-up (RUN5 C0b).
  const rz = params && params.resume;
  if (rz) { const st = !!getState().seen.dashSteady; rz.mix ? play(MIX_KEY, null, st) : play(rz.cat, rz.level, st); }
  else startCard();
  maybeIntro('dash');   // first-ever open: the guided intro (RUN5 C5)

  function startCard() {
    clear(root); music.play('game');
    const s = getState();
    let steady = !!s.seen.dashSteady;      // explicit opt-in only; REDUCED is applied at play()
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 100 }) }),
      el('h2', { text: 'Boo Dash' }),
      el('p', { class: 'sc-intro', text: 'Run up the path and open the gate with the right answer!' })
    ]);
    const picker = buildPicker({
      game: 'dash',
      choices: filterCategories(DASH_CATS.map(k => ({ key: k, name: BUBBLE_BY_KEY[k].name, sub: BUBBLE_BY_KEY[k].sample }))),
      levelsFor: (key) => filterLevels(BUBBLE_BY_KEY[key].levels),
      levelName: LEVEL_NAME,
      onStart: (catKey, level) => play(catKey, level, steady),
      scrollChoices: true   // RUN9 C1 tidy sweep: category strip keeps ≤8 primary buttons on screen
    });
    card.appendChild(picker.node);
    // steady mode is an explicit opt-in (never the default)
    const steadyBtn = el('button', { class: 'acc-chip' + (steady ? ' sel' : '') });
    steadyBtn.textContent = steady ? '🐢 Steady mode: ON' : '🐢 Steady mode: off';
    steadyBtn.onclick = () => { steady = !steady; sfx.tap(); steadyBtn.classList.toggle('sel', steady); steadyBtn.textContent = steady ? '🐢 Steady mode: ON' : '🐢 Steady mode: off'; };
    card.appendChild(el('div', { class: 'steady-wrap' }, [steadyBtn]));
    card.appendChild(el('div', { class: 'star-rule' }, [el('div', { html: starsRow(3, { size: 24 }) }), el('p', { text: 'Three stars: a clean run, no bonks.' })]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));   // shared back (job 3)
  }

  function play(catKey, level, steadyOpt) {
    clear(root);
    mutate(st => { st.seen.dashSteady = !!steadyOpt; });
    const steady = REDUCED || !!steadyOpt;   // media query or explicit toggle only
    const mix = catKey === MIX_KEY;
    const plan = mix ? mixPlan(GATES) : null;

    let gate = 0, bonks = 0, streak = 0, ended = false;
    let question = null;
    let phase = 'run';            // run -> wait -> open -> run … -> done
    let worldZ = 0;               // distance travelled
    let stopZ = SPAWN;            // where the current gate row's stop line is
    let runFromZ = 0, runT = 0, runDur = RUN_MS, lastRunMs = 0;
    let boLane = 0;               // which lane the Boo is drifting through (-1/0/1)

    shell = createGameShell({ title: mix ? 'Smart Mix' : 'Boo Dash', rounds: GATES, accent: 'var(--pop)', onBack: () => { stop(); ctx.go('hub'); }, hintEnabled: false, onHelp: () => replayIntro('dash') });
    root.appendChild(shell.root);

    // ---- scene ------------------------------------------------------------
    const scene = el('div', { class: 'dash-track d2-scene' + (steady ? ' steady' : '') });
    const sky = el('div', { class: 'd2-sky' });
    const clouds = el('div', { class: 'd2-clouds' }, [0, 1, 2].map(i => el('div', { class: 'd2-cloud c' + i })));
    const hills = el('div', { class: 'd2-hills' });
    const ground = el('div', { class: 'd2-ground' });
    const roadWrap = el('div', { class: 'd2-roadwrap' }, [el('div', { class: 'd2-road' })]);
    const propsEl = el('div', { class: 'd2-props' });
    const gatesEl = el('div', { class: 'd2-gates' });
    const boo = el('div', { class: 'd2-boo' }, [
      el('div', { class: 'd2-boo-inner', html: renderGuide(getState().guide, { view: 'full', size: 92 }) }),
      el('div', { class: 'd2-shadow' })
    ]);
    const factCard = el('div', { class: 'dash-fact' });
    scene.append(sky, clouds, hills, ground, roadWrap, propsEl, gatesEl, boo, factCard);
    shell.area.appendChild(scene);
    const road = roadWrap.firstChild;
    const booInner = boo.firstChild;
    const collector = createTrickyCollector(shell.area);

    // roadside props (recycled): alternate sides, varied sprites, spaced up the path
    const props = [];
    for (let i = 0; i < PROP_COUNT; i++) {
      const node = el('div', { class: 'd2-prop', html: propSVG(i) });
      propsEl.appendChild(node);
      props.push({ node, side: i % 2 === 0 ? -1 : 1, z: 30 + i * PROP_STEP });
    }

    // gate rows: [{ z, gates: [{node, correct, label}], open, passed }]
    let rows = [];

    newQuestion();
    spawnRow();
    setTrot('run');
    startLoop();

    // ---- questions (unchanged logic: categories, Smart Mix, ledger) --------
    function nextQ(slot) {
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
      question = nextQ(gate);
      factCard.textContent = question.display;
      if (typeof window !== 'undefined') window.__dashCorrect = question.answer;
    }
    function pickWrong(q) {
      const pool = q.distractors.filter(x => x !== q.answer);
      return shuffle(pool.slice()).slice(0, 2);
    }
    function missFor(q) {
      const f = q.fmt || String;
      const ds = pickWrong(q);
      return choiceMiss({ id: q.key, game: 'dash', prompt: q.display, options: [q.answer, ...ds].map(f), answer: f(q.answer) });
    }

    // ---- gate rows ----------------------------------------------------------
    // Every lane always carries a gate: answer + 2 distractors, shuffled across lanes.
    function spawnRow() {
      const fmt = question.fmt || String;
      const opts = shuffle([{ v: question.answer, correct: true }, ...pickWrong(question).map(x => ({ v: x, correct: false }))]);
      const row = { z: stopZ, open: false, passed: false, gates: [] };
      opts.forEach((o, lane) => {
        const g = el('button', { class: 'd2-gate lane' + lane, 'aria-label': 'answer gate' }, [
          el('div', { class: 'g-frame' }, [
            el('div', { class: 'g-top' }),
            el('div', { class: 'g-door left' }), el('div', { class: 'g-door right' }),
            el('div', { class: 'g-post left' }), el('div', { class: 'g-post right' })
          ]),
          el('div', { class: 'g-label', text: fmt(o.v) })
        ]);
        g.onclick = () => tapGate(row, lane);
        gatesEl.appendChild(g);
        row.gates.push({ node: g, correct: o.correct, lane });
      });
      rows.push(row);
      if (steady) { worldZ = row.z; phase = 'wait'; setTrot('jog'); layout(); }
    }

    // ---- taps ---------------------------------------------------------------
    function tapGate(row, lane) {
      if (ended || phase !== 'wait' || row.open || row.passed) return;
      const g = row.gates[lane];
      if (g.correct) {
        row.open = true;
        recordResult(question.key, true);
        sfx.correct(); streak++;
        g.node.classList.add('open');
        if (!REDUCED) { const r = g.node.getBoundingClientRect(); sparkleAt(r.left + r.width / 2, r.top + r.height * 0.35); }
        boLane = lane - 1;               // drift through the opened gate
        boo.style.left = (50 + boLane * 26) + '%';
        gate++; shell.setProgress(gate);
        phase = 'open';
        setTimeout(() => { if (!ended) continueRun(); }, steady ? 100 : OPEN_MS);
      } else {
        // soft bonk: wobble, heart dims, streak resets, the SAME question stays
        bonks++; streak = 0;
        recordResult(question.key, false);
        collector.add(missFor(question));
        sfx.oops();
        g.node.classList.remove('bonked'); void g.node.offsetWidth; g.node.classList.add('bonked');
        booInner.classList.remove('bonk'); void booInner.offsetWidth; booInner.classList.add('bonk');
        shell.dimHeart();
        shell.react(guideLine('oops'), { voice: false, hold: 1400 });
        setTimeout(() => booInner.classList.remove('bonk'), 450);
      }
    }

    function continueRun() {
      if (gate >= GATES) { finishAfterPass(); return; }
      newQuestion();
      stopZ += SPAWN;
      spawnRow();
      if (steady) { cleanupPassed(true); recenter(); return; }
      startRun(streak >= 3 ? RUN_MS_FAST : RUN_MS);
      scene.classList.toggle('speedy', streak >= 3);
    }
    function finishAfterPass() {
      if (steady) { finish(); return; }
      // one last stretch: run on through the final gate, then finish
      stopZ += SPAWN * 0.55;
      startRun(700);
      finishAfterPass._pending = true;
    }
    function startRun(dur) { phase = 'run'; runFromZ = worldZ; runT = 0; runDur = dur; setTrot('run'); }
    function recenter() { boLane = 0; boo.style.left = '50%'; }

    // ---- the motion loop ----------------------------------------------------
    // Each run stretch follows one smooth ease-in-out curve: the Boo accelerates, cruises,
    // and the whole world EASES TO A STOP at the gates. Waiting is completely static.
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
      if (phase !== 'run') return;
      runT += dt;
      const p = Math.min(1, runT / runDur);
      const e = 0.5 - 0.5 * Math.cos(Math.PI * p);      // ease in … cruise … ease out
      worldZ = runFromZ + (stopZ - runFromZ) * e;
      if (p >= 1) {
        worldZ = stopZ;
        lastRunMs = Math.round(runT);
        if (finishAfterPass._pending) { finishAfterPass._pending = false; layout(); return finish(); }
        phase = 'wait';
        setTrot('jog');
        recenter();
        cleanupPassed(false);
      }
      layout();
    }

    // projection: d (distance ahead of the camera's stop line) -> screen placement
    function projT(d) { return 1 - Math.max(-1.2, Math.min(1, d / SPAWN)); }   // 0 far … 1 at line … >1 passing
    function place(node, t, laneOffset, baseScale = 1, far = 0.22) {
      const H = scene.clientHeight || 400, W = scene.clientWidth || 600;
      const tt = Math.min(t, 1), over = Math.max(0, t - 1);
      const curve = Math.pow(tt, 1.7);
      const y = (HORIZON_Y + (STOP_Y - HORIZON_Y) * curve + over * 0.5) * H;
      const spread = (0.02 + 0.24 * curve + over * 0.22) * W;   // lane centres: ±26% at the stop line
      const scale = (far + (1 - far) * curve + over * 2.1) * baseScale;
      const x = W / 2 + laneOffset * spread;
      node.style.transform = `translate(${(x).toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
      node.style.opacity = over > 0 ? String(Math.max(0, 1 - over * 2.4)) : '1';
      node.style.zIndex = String(2 + Math.round(t * 10));
    }
    function layout() {
      // gate rows
      for (const row of rows) {
        const t = projT(row.z - worldZ);
        if (t > 1.45) { row.passed = true; row.gates.forEach(g => { g.node.style.display = 'none'; }); continue; }
        row.gates.forEach((g, lane) => place(g.node, t, lane - 1));
      }
      // roadside props (recycle far ahead once passed; chunky so the sweep-past reads fast)
      for (const p of props) {
        let t = projT(p.z - worldZ);
        if (t > 1.45) { p.z += PROP_COUNT * PROP_STEP; t = projT(p.z - worldZ); }
        place(p.node, t, p.side * 1.55, 1.35, 0.12);
      }
      // parallax: road cross-stripes + lane dashes fast, clouds slow (hills sit at infinity)
      road.style.backgroundPosition = `0 ${(worldZ * 3.1).toFixed(1)}px, 0 0`;
      clouds.style.transform = `translateX(${(-worldZ * 0.3).toFixed(1)}px)`;
    }
    function cleanupPassed(instant) {
      rows = rows.filter(row => {
        if (row.passed || (instant && row.open)) { row.gates.forEach(g => g.node.remove()); return false; }
        return true;
      });
    }
    function setTrot(mode) {
      booInner.classList.remove('trot-run', 'trot-jog');
      if (!steady) booInner.classList.add(mode === 'run' ? 'trot-run' : 'trot-jog');
    }

    function finish() {
      if (ended) return; ended = true; stop(); shell.cleanup();
      const stars = bonks === 0 ? 3 : bonks <= 3 ? 2 : 1;    // star rules unchanged
      recordBest('dash', mix ? MIX_KEY : catKey, stars);
      ctx.go('results', { game: 'dash', gameName: mix ? 'Smart Mix' : 'Boo Dash', stars, level, cat: mix ? null : catKey, mix, tricky: collector.items(), replay: () => ctx.go('dash') });
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }

    layout();

    // test hook (invisible). Kept shape-compatible with p8-frames: tap() no-ops unless waiting.
    if (typeof window !== 'undefined') window.__dash = {
      correct: () => question.answer,
      tap: (wantCorrect) => {
        const row = rows.find(r => !r.open && !r.passed); if (!row || phase !== 'wait') return;
        const fmt = question.fmt || String;
        const g = row.gates.find(x => (x.node.querySelector('.g-label').textContent === String(fmt(question.answer))) === wantCorrect);
        if (g) g.node.click();
      },
      state: () => ({ gate, bonks, streak, ended, phase, worldZ: +worldZ.toFixed(1), stopZ, lastRunMs: Math.round(lastRunMs), speedy: scene.classList.contains('speedy'), steady }),
      ended: () => ended
    };
  }

  return { unmount() { if (raf) cancelAnimationFrame(raf); if (shell) shell.cleanup(); } };
}

// Sticker-look roadside sprites: trees, bushes, flowers (alternating).
function propSVG(i) {
  const kind = i % 3;
  if (kind === 0) return `<svg viewBox="0 0 60 80" width="58" height="77" aria-hidden="true">
    <rect x="26" y="46" width="8" height="26" rx="3" fill="#8A5A44" stroke="#2A1B4E" stroke-width="3"/>
    <ellipse cx="30" cy="30" rx="22" ry="20" fill="#5FBF7A" stroke="#2A1B4E" stroke-width="3.5"/>
    <ellipse cx="19" cy="40" rx="12" ry="10" fill="#7FD8C3" stroke="#2A1B4E" stroke-width="3"/>
  </svg>`;
  if (kind === 1) return `<svg viewBox="0 0 60 44" width="56" height="41" aria-hidden="true">
    <ellipse cx="20" cy="28" rx="16" ry="13" fill="#5FBF7A" stroke="#2A1B4E" stroke-width="3.5"/>
    <ellipse cx="40" cy="30" rx="14" ry="11" fill="#7FD8C3" stroke="#2A1B4E" stroke-width="3.5"/>
    <circle cx="30" cy="18" r="5" fill="#FF7AC6" stroke="#2A1B4E" stroke-width="2.5"/>
  </svg>`;
  return `<svg viewBox="0 0 40 56" width="36" height="50" aria-hidden="true">
    <rect x="17" y="26" width="5" height="26" rx="2.5" fill="#5FBF7A" stroke="#2A1B4E" stroke-width="2.5"/>
    <circle cx="20" cy="16" r="11" fill="#FFC93C" stroke="#2A1B4E" stroke-width="3"/>
    <circle cx="20" cy="16" r="4.5" fill="#FF9F68" stroke="#2A1B4E" stroke-width="2"/>
  </svg>`;
}
