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
import { renderGuide, renderItem } from '../art.js';
import { sportyCameo } from '../cameo.js';   // RUN19 Z5: a sporty Boo jogs the far layer
import { guideLine } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { BUBBLE_BY_KEY, BUBBLE_CATEGORIES, genQuestion, LEVEL_NAME } from '../../data/bubbleCategories.js';
import { buildPicker, recordBest, MIX_KEY } from '../picker.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { nameWithValue, readAloudButton, readAloudOn } from '../a11y.js';
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

  // The pack's line, verbatim. «n» is the gate she hit; «answer» is the one she wanted.
  const dashWrongLine = (n, answerValue) => `That gate said ${n} — the answer was ${answerValue}!`;
  if (typeof window !== 'undefined') window.__dashLines = { dashWrongLine };

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
    // RUN19 Z7: the estimation gates for the CURRENT question, or null for a classic round.
    // Declared here with the other round-scoped state — it was originally declared below
    // newQuestion(), which put the first call straight into its temporal dead zone.
    let estGates = null;

    shell = createGameShell({ title: mix ? 'Smart Mix' : 'Boo Dash', rounds: GATES, accent: 'var(--pop)', bank: () => ({ correct: gate, of: GATES }),
      onBack: (b) => { stop(); if (b && b.stars > 0) ctx.go('results', { game: 'dash', gameName: mix ? 'Smart Mix' : 'Boo Dash', stars: b.stars, level, cat: mix ? null : catKey, mix, tricky: collector.items(), partial: b, replay: () => ctx.go('dash') }); else ctx.go('hub'); },
      hintEnabled: false, onHelp: () => replayIntro('dash') });
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
    // RUN19 Z5 — the sporty cameo. One owned SPORTY Boo jogs the FAR parallax layer at 0.6x
    // the scroll speed, so it reads as somebody out for a run in the distance rather than a
    // second racer. Behind the hills, in front of the sky; never near the lanes or the HUD.
    // No owned sporty Boo = no jogger and no placeholder.
    const joggerItem = sportyCameo();
    const jogger = joggerItem ? el('div', { class: 'd2-jogger' + (REDUCED ? ' static' : ''), 'aria-hidden': 'true' }, [
      el('div', { class: 'd2-jogger-art', html: renderItem(joggerItem, { size: 40 }) })
    ]) : null;
    const factCard = el('div', { class: 'dash-fact' });
    if (readAloudOn()) factCard.appendChild(readAloudButton(() => question && question.display));
    scene.append(sky, clouds, hills, ground, roadWrap, propsEl, gatesEl, boo, factCard);
    if (jogger) hills.appendChild(jogger);   // the far layer, so the hills' own depth carries it
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
        // RUN19 Z7: remember the level this question came from. Dash mixes levels per gate, and
        // whether the row shows two multiples or three depends on it.
        q.level = lv;
        if (!best) best = q;
        if (ledgerClass(q.key) === cls) return q;
      }
      return best;
    }
    function newQuestion() {
      const picked = questionWithGates(nextQ(gate), levelOfQuestion());
      question = picked.q;
      estGates = picked.gates;
      // RUN19 Z7: the card asks which way it leans, not what it equals.
      factCard.textContent = estGates ? nearerPrompt(question) : question.display;
      if (typeof window !== 'undefined') {
        window.__dashCorrect = question.answer;
        window.__dashGates = estGates ? estGates.map(g => g.v) : null;
        window.__dashNearest = estGates ? (estGates.find(g => g.correct) || {}).v : null;
      }
    }
    // Dash mixes categories and levels per gate, so the level that decides two-gates-or-three is
    // the one the CURRENT question came from.
    function levelOfQuestion() {
      const lv = question && question.level;
      if (Number.isFinite(lv)) return lv;
      return (level && Number.isFinite(level)) ? level : 1;
    }
    // ---- RUN19 Z7: ESTIMATION ------------------------------------------------------------
    // The gates stop being "which of these three IS the answer" and become "which is it
    // NEARER". The question sources are untouched — the same category items, the same keys, the
    // same ledger — only what the gates offer changes, which is the whole point: the child is
    // asked a different KIND of question about work she already knows how to do.
    //
    // Gates are the two nearest multiples of ten, and a tie is regenerated rather than shipped:
    // "is 65 nearer 60 or 70" has no answer, and offering it would teach her that the game
    // sometimes lies. At level 3 there are three consecutive multiples, so "nearest" needs a
    // real comparison rather than a coin toss between two.
    function estimationGates(answer, level) {
      const a = Number(answer);
      if (!Number.isFinite(a)) return null;
      const lo = Math.floor(a / 10) * 10;
      if (level >= 3) {
        // three CONSECUTIVE multiples, centred on the nearest one so the answer is inside them
        const near = Math.round(a / 10) * 10;
        const start = Math.max(0, near - 10);
        const three = [start, start + 10, start + 20];
        const dists = three.map(g => Math.abs(a - g));
        const best = Math.min(...dists);
        if (dists.filter(d => d === best).length > 1) return null;    // a tie: regenerate
        return three.map(v => ({ v, correct: Math.abs(a - v) === best }));
      }
      const two = [lo, lo + 10];
      const d0 = Math.abs(a - two[0]), d1 = Math.abs(a - two[1]);
      if (d0 === d1) return null;                                     // exactly halfway: regenerate
      return two.map(v => ({ v, correct: Math.abs(a - v) === Math.min(d0, d1) }));
    }
    // A question whose answer sits exactly halfway between two tens has no nearer gate, so ask
    // the source for another one. Bounded, and it falls back to the last question rather than
    // looping — the run must never stall on the generator.
    function questionWithGates(q, level) {
      let cur = q, gates = estimationGates(cur.answer, level);
      for (let i = 0; i < 8 && !gates; i++) {
        cur = nextQ(gate);
        gates = estimationGates(cur.answer, level);
      }
      return { q: cur, gates };
    }
    // "Which is «expr» nearer?" — the prompt the pack authors, spoken once.
    // Function DECLARATIONS, not const arrows: newQuestion() is called during setup, which runs
    // before this line would, and a const would put that first call in its temporal dead zone.
    // The «expr», not the whole card text: a display reads "10 x 3 = ?", and
    // "Which is 10 x 3 = ? nearer?" is two questions wearing one sentence. Trailing "= ?" goes.
    function nearerPrompt(q) { return `Which is ${String(q.display).replace(/\s*=\s*\?\s*$/, '')} nearer?`; }
    // "«expr» is «A» — nearer «correct»!" — the explanation, on right answers as well as wrong,
    // because this mechanic is NEW and the number it is teaching is the one she did not see.
    function nearerExplain(q, correct) { return `${String(q.display).replace(/\s*=\s*\?\s*$/, '')} is ${q.answer} — nearer ${correct}!`; }

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
      // RUN19 Z7 — the gates are the estimation multiples, IN ORDER (60 then 70 reads as a
      // number line; shuffling them would make the child hunt rather than compare). Two gates
      // take the outer lanes and the middle becomes a solid section of fence, so there is never
      // an invisible gap to run through. Three gates fill all three lanes at level 3.
      const opts = estGates
        ? (estGates.length === 2 ? [estGates[0], null, estGates[1]] : estGates.slice())
        : shuffle([{ v: question.answer, correct: true }, ...pickWrong(question).map(x => ({ v: x, correct: false }))]);
      const row = { z: stopZ, open: false, passed: false, gates: [] };
      opts.forEach((o, lane) => {
        if (!o) {
          // the middle: fence, not a gate. Not a button, so it can never be tapped or focused.
          const wallNode = el('div', { class: 'd2-gate d2-fence lane' + lane, 'aria-hidden': 'true' }, [
            el('div', { class: 'g-frame' }, [el('div', { class: 'g-top' }), el('div', { class: 'g-post left' }), el('div', { class: 'g-post right' })])
          ]);
          gatesEl.appendChild(wallNode);
          row.gates.push({ v: null, correct: false, node: wallNode, fence: true });
          return;
        }
        // RUN12 S13.4: the gate says which answer it IS
        const g = el('button', { class: 'd2-gate lane' + lane, 'aria-label': nameWithValue('answer gate', fmt(o.v)) }, [
          el('div', { class: 'g-frame' }, [
            el('div', { class: 'g-top' }),
            el('div', { class: 'g-door left' }), el('div', { class: 'g-door right' }),
            el('div', { class: 'g-post left' }), el('div', { class: 'g-post right' })
          ]),
          el('div', { class: 'g-label', text: fmt(o.v) })
        ]);
        g.onclick = () => tapGate(row, lane);
        gatesEl.appendChild(g);
        row.gates.push({ node: g, correct: o.correct, lane, v: o.v });   // RUN19 Z7: the explanation names the value
      });
      rows.push(row);
      if (steady) { worldZ = row.z; phase = 'wait'; setTrot('jog'); layout(); }
    }

    // ---- taps ---------------------------------------------------------------
    function tapGate(row, lane) {
      if (ended || phase !== 'wait' || row.open || row.passed) return;
      const g = row.gates[lane];
      if (g.fence) return;   // RUN19 Z7: the middle section of fence is not an answer
      if (g.correct) {
        row.open = true;
        recordResult(question.key, true);
        sfx.correct(); streak++;
        // RUN19 Z7 — the estimation explanation, on the RIGHT answer too. The number she was
        // estimating is the one she never saw, so saying it is the entire lesson; a chime alone
        // would confirm the guess and teach nothing.
        if (estGates) shell.react(nearerExplain(question, g.v), { voice: false, hold: 1800 });
        g.node.classList.add('open');
        if (!REDUCED) { const r = g.node.getBoundingClientRect(); sparkleAt(r.left + r.width / 2, r.top + r.height * 0.35); }
        boLane = lane - 1;               // drift through the opened gate
        boo.style.left = (50 + boLane * 26) + '%';
        gate++; shell.setProgress(gate);
        phase = 'open';
        shell.timeout(() => { if (!ended) continueRun(); }, steady ? 100 : OPEN_MS);
      } else {
        // soft bonk: wobble, heart dims, streak resets, the SAME question stays
        bonks++; streak = 0;
        recordResult(question.key, false);
        collector.addAttempted(missFor(question));
        sfx.oops();
        g.node.classList.remove('bonked'); void g.node.offsetWidth; g.node.classList.add('bonked');
        booInner.classList.remove('bonk'); void booInner.offsetWidth; booInner.classList.add('bonk');
        shell.dimHeart();
        // RUN18D, the EXPLANATION STANDARD. Line verbatim from the pack: the gate she ran
        // into is named, and so is the answer — a generic "oops" told her neither, on a
        // screen where the two numbers are the entire question.
        // RUN19 Z7: an estimation round explains itself in the pack's own words — the value, and
        // which multiple it is nearer. The classic gate keeps RUN18D's line.
        if (estGates) {
          const right = (estGates.find(x => x.correct) || {}).v;
          shell.react(nearerExplain(question, right), { voice: false, hold: 2600 });
        } else {
          shell.react(dashWrongLine((g.node.querySelector('.g-label') || {}).textContent, fmt(question.options[question.correct].v != null ? question.options[question.correct].v : question.options[question.correct])), { voice: false, hold: 2400 });
        }
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
        if (!document.hidden && !ended && !shell.paused()) update(dt);   // frozen behind an intro (RUN12 S6)
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
      // RUN19 Z5: the sporty cameo drifts with the FAR layer at 0.6x — slower than the road,
      // faster than the clouds, which is what puts it at middle distance. It wraps rather
      // than running off, so it is always somewhere out there.
      if (jogger) jogger.style.transform = `translateX(${(-(worldZ * 0.6) % 420).toFixed(1)}px)`;
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
      // ---- RUN19 Z7 ---------------------------------------------------------------------
      estimation: () => !!estGates,
      gates: () => (estGates ? estGates.map(g => ({ v: g.v, correct: !!g.correct })) : null),
      gateLabels: () => [...gatesEl.querySelectorAll('.d2-gate .g-label')].map(n => n.textContent),
      fences: () => gatesEl.querySelectorAll('.d2-fence').length,
      prompt: () => factCard.textContent,
      estimationGates: (a, lv) => estimationGates(a, lv),
      nearerExplain: (q, c) => nearerExplain(q || question, c),
      tapNearest: () => {
        const row = rows.find(r => !r.open && !r.passed); if (!row || phase !== 'wait') return false;
        const g = row.gates.find(x => x.correct); if (!g) return false;
        g.node.click(); return true;
      },
      tapWrong: () => {
        const row = rows.find(r => !r.open && !r.passed); if (!row || phase !== 'wait') return false;
        const g = row.gates.find(x => !x.correct && !x.fence); if (!g) return false;
        g.node.click(); return true;
      },
      // RUN19 Z7: skips the FENCE (it has no .g-label, and reading one crashed this hook), and
      // asks the gate's own `correct` flag rather than matching its label against the answer —
      // in an estimation round the right gate is the NEARER multiple, never the answer itself.
      tap: (wantCorrect) => {
        const row = rows.find(r => !r.open && !r.passed); if (!row || phase !== 'wait') return;
        const g = row.gates.find(x => !x.fence && !!x.correct === !!wantCorrect);
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
