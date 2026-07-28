// js/games/bubblepop.js — Game 1: Bubble Pop (maths fact fluency, spec §6).

import { el, clear, starsRow, wobble, sparkleAt, backControl, REDUCED } from '../ui.js';
import { getState, recordResult, ledgerClass } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { LEVELS, LEVEL_LABELS } from '../../data/tablesConfig.js';
import { BUBBLE_CATEGORIES, BUBBLE_BY_KEY, genQuestion, LEVEL_NAME } from '../../data/bubbleCategories.js';
import { buildPicker, recordBest, MIX_KEY } from '../picker.js';
import { mixPlan, timedGate } from '../smartmix.js';
import { createTrickyCollector, choiceMiss } from '../trickypile.js';
import { filterCategories, filterLevels } from '../content.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { nameWithValue, readAloudButton, readAloudOn } from '../a11y.js';
import { addMeterPoints } from '../rewards.js';
import { explainWrong } from '../celebrate.js';   // RUN18D: the Explanation Standard

const ROUNDS = 10;
const BUBBLE_COUNT = 6;
const MAX_HINTS = 2;
// Juice pass (RUN6 C5): named micro-delight constants.
const STREAK_TRAIL = 3;        // a streak of this many correct pops adds a sparkle trail to the next
const GOLDEN_CHANCE = 0.28;    // chance a question's correct bubble arrives golden
const GOLDEN_CAP = 2;          // ...capped this many times per round (+1 meter each)
const DROPLETS = 7;            // droplets a pop bursts into

const rand = (n) => (Math.random() * n) | 0;
// RUN12 S12: the play field's own inset. Bubbles never leave it, in either direction.
const FIELD_PAD = 6;

// ---- RUN18D D2: containment, in pixels per second ---------------------------------
// The drift is AUTHORED per level and identical for every bubble on the board, so
// reading the question is never a race: speed pressure belongs to material she has
// already mastered (RUN18B Y10), not to working out what is being asked.
export const BUBBLE_SPEED_PX_S = { S: 110, 1: 140, 2: 170, 3: 200 };
export const DESPAWN_FADE_MS = 300;      // a bubble reaching the HUD edge fades out over this
export const CORRECT_RESPAWN_MS = 800;   // ...and the CORRECT one is back from the bottom within this
export const SPAWN_BAND = 0.20;          // respawns arrive in the bottom fifth of the field

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen bubblepop' });
  container.appendChild(root);
  let shell = null;
  let loopId = null;

  // Jump back in / level-up (RUN5 C0b): launch straight into a saved mode.
  const rz = params && params.resume;
  if (rz) { rz.mix ? play(MIX_KEY, null) : play(rz.cat, rz.level); }
  else startCard();
  maybeIntro('bubblepop');   // first-ever open: the guided intro (RUN5 C5)

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 100 }) }),
      el('h2', { text: 'Bubble Pop' }),
      el('p', { class: 'sc-intro', text: guideLine('gameIntroBubble') })
    ]);
    const picker = buildPicker({
      game: 'bubblepop',
      choices: filterCategories(BUBBLE_CATEGORIES).map(c => ({ key: c.key, name: c.name, sub: c.sample })),
      levelsFor: (key) => filterLevels(BUBBLE_BY_KEY[key].levels),
      levelName: LEVEL_NAME,
      onStart: (catKey, level) => play(catKey, level),
      scrollChoices: true   // RUN9 C1 tidy sweep: category strip keeps ≤8 primary buttons on screen
    });
    // (Smart Mix is prepended by buildPicker; play() handles MIX_KEY.)
    card.appendChild(picker.node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: at most one wrong pop, and no hints.' })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));   // shared back (job 3)
  }

  function play(catKey, level) {
    clear(root);
    const mix = catKey === MIX_KEY;
    const plan = mix ? mixPlan(ROUNDS) : null;
    let prevKey = null;
    // RUN18B Y10: Bubble Pop is timed, so it practises what she has already got right.
    // The gate is measured ONCE per round against this round's own generator.
    const genOne = () => mix ? genMixCandidate() : genQuestion(catKey, level, prevKey);
    const gate = timedGate(genOne, ROUNDS);
    let target = nextTarget(0);
    prevKey = target.key;
    let solved = 0;
    let wrongPops = 0;
    let hintsUsed = 0;
    let locked = false;
    let streak = 0, goldenCount = 0, goldenThisRound = false;   // juice + golden-bubble delight (C5)
    let toldThisQuestion = false;   // RUN18D: the timed-out line, once per question
    const fmt = () => (target.fmt || String);
    const skyFor = () => 'bp-sky-' + Math.max(1, Math.min(3, mix ? (solved < 4 ? 1 : solved < 7 ? 2 : 3) : (level || 1)));
    const updateSky = () => { field.classList.remove('bp-sky-1', 'bp-sky-2', 'bp-sky-3'); field.classList.add(skyFor()); };

    // In Smart Mix, generate a weak-weighted question from ALL categories for this slot.
    function genMixCandidate() {
      const cat = BUBBLE_CATEGORIES[rand(BUBBLE_CATEGORIES.length)];
      return genQuestion(cat.key, cat.levels[rand(cat.levels.length)], prevKey);
    }
    // The class plan is now a PREFERENCE and Y10's eligibility is the filter: a slot that
    // wanted a 'weak' item and cannot have an eligible one is served anyway, never skipped.
    function nextTarget(slot) {
      if (!mix) return gate.pick(() => genQuestion(catKey, level, prevKey));
      const cls = plan[slot] || 'middle';
      return gate.pick(genMixCandidate, { prefer: (q) => ledgerClass(q.key) === cls });
    }

    shell = createGameShell({
      title: mix ? 'Smart Mix' : 'Bubble Pop', rounds: ROUNDS, accent: 'var(--pop)',
      onHelp: () => replayIntro('bubblepop'),
      // RUN12 S11: leaving mid-round banks what she actually got right, through results —
      // the single crediting path (RUN5 C0), so nothing else has to know about stars.
      bank: () => ({ correct: solved, of: ROUNDS }),
      onBack: (b) => { stopLoop(); if (b && b.stars > 0) ctx.go('results', { game: 'bubblepop', gameName: mix ? 'Smart Mix' : 'Bubble Pop', stars: b.stars, level, cat: mix ? null : catKey, mix, tricky: collector.items(), partial: b, replay: () => ctx.go('bubblepop') }); else ctx.go('hub'); },
      onHint: doHint,
      hintEnabled: true
    });
    root.appendChild(shell.root);

    // target card
    const targetCard = el('div', { class: 'target-card', html: targetHTML(target) });
    // RUN12 S13.2 — a control, never autoplay: it speaks the question she is looking at now.
    if (readAloudOn()) targetCard.appendChild(readAloudButton(() => target.display));
    const field = el('div', { class: 'bubble-field bp-glass' });
    shell.area.append(targetCard, field);
    updateSky();   // backdrop evolves with level (C5)
    const collector = createTrickyCollector(shell.area);

    // build bubbles
    const bubbles = [];
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const b = { value: 0, correct: false, x: 0, y: 0, vx: 0, speed: 0, size: 0, hidden: false, node: null, _pi: i };
      // RUN12 S13.4: the name carries the VALUE — "bubble" alone tells a screen-reader
      // user nothing they can act on. Repainted with the value in paint().
      const node = el('button', { class: 'bubble', 'aria-label': 'bubble' });
      node.addEventListener('click', () => onPop(b));
      b.node = node;
      field.appendChild(node);
      bubbles.push(b);
    }
    // RUN12 S12 — the play field must EXCLUDE the chrome, not just the HUD. The question
    // card is laid over the same absolutely-positioned area, so bubbles drifted behind it
    // and a hit-test at their centre landed on .target-card. The field's top inset is
    // measured from the card, so the answer is never behind the question.
    function fitField() {
      const area = shell.area.getBoundingClientRect();
      const card = targetCard.getBoundingClientRect();
      const top = Math.max(0, Math.round(card.bottom - area.top) + 8);
      if (field.style.top !== top + 'px') { field.style.top = top + 'px'; resetPositions(); }
    }
    requestAnimationFrame(fitField);
    const onFieldResize = () => fitField();
    window.addEventListener('resize', onFieldResize);

    layoutValues();
    resetPositions();
    startLoop();

    function targetHTML(t) {
      return `<span class="target-eq">${t.display}</span>`;
    }

    function layoutValues() {
      // exactly one correct value (answer), rest distinct distractors (never == answer)
      const ds = shuffle(target.distractors.slice());
      const values = [target.answer, ...ds.slice(0, BUBBLE_COUNT - 1)];
      // bulletproof: never leave a bubble blank
      let pad = 1;
      while (values.length < BUBBLE_COUNT) {
        const v = target.answer + pad++;
        if (!values.includes(v)) values.push(v);
      }
      shuffle(values);
      // an occasional golden bubble carries the correct answer (+1 meter), capped per round (C5).
      // A test flag disables it so the exact star→meter economy stays deterministic.
      const noGolden = typeof window !== 'undefined' && window.__bubblepopNoGolden;
      goldenThisRound = !noGolden && goldenCount < GOLDEN_CAP && Math.random() < GOLDEN_CHANCE;
      bubbles.forEach((b, i) => {
        b.value = values[i];
        b.correct = (b.value === target.answer);
        b.golden = goldenThisRound && b.correct;
        b.hidden = false;
        paint(b);
      });
    }

    function paint(b) {
      b.node.textContent = fmt()(b.value);
      b.node.setAttribute('aria-label', nameWithValue('bubble', fmt()(b.value)));
      b.node.classList.remove('burst');
      b.node.style.visibility = b.hidden ? 'hidden' : 'visible';
      b.node.style.pointerEvents = b.hidden ? 'none' : 'auto';
      const palette = ['#FF7AC6', '#35D0BA', '#8FC7FF', '#C6A9F0', '#FFC93C', '#7FD8C3'];
      b.node.style.setProperty('--bub', palette[b._pi % palette.length]);
      b.node.classList.toggle('golden', !!b.golden);
    }

    // RUN18D D2: the board's drift, in px/s, from the authored table. Smart Mix has no
    // level of its own, so it climbs the same ladder its sky already climbs - the child
    // sees one thing getting brisker, not two unrelated things.
    function driftPxS() {
      const key = mix ? (solved < 4 ? 1 : solved < 7 ? 2 : 3) : (level == null ? 1 : level);
      return BUBBLE_SPEED_PX_S[key] != null ? BUBBLE_SPEED_PX_S[key] : BUBBLE_SPEED_PX_S[1];
    }

    function resetPositions() {
      const W = field.clientWidth || 600, H = field.clientHeight || 500;
      bubbles.forEach((b, i) => {
        b.size = 74 + rand(16);
        b._pi = i;
        b.x = (i + 0.5) / BUBBLE_COUNT * W - b.size / 2 + (Math.random() * 24 - 12);
        // Spread across the field, entirely INSIDE it (S12). Every bubble now drifts at the
        // SAME authored speed, so this opening stagger is the only thing keeping the board
        // from rising and re-entering as one solid block - it is load-bearing, not cosmetic.
        b.y = FIELD_PAD + (i / BUBBLE_COUNT) * Math.max(0, H - b.size - FIELD_PAD * 2);
        b.phase = Math.random() * Math.PI * 2;
        b.fadingSince = 0;
        b.node.classList.remove('bp-sink');
      });
      separate();
      bubbles.forEach(place);
    }

    function swayOf(b) { return Math.sin((b.y + b.phase * 80) / 90) * 14; }   // hoisted: resetPositions runs before this line

    // RUN18D D2 — bubbles keep their CENTRES out of each other.
    // Two bubbles are allowed to overlap: six of them, 74-90px across, cannot always be
    // laid out on a 378px phone field without touching, and jostling reads as bubbles.
    // What is NOT allowed is one bubble's centre sitting under another, because that is
    // exactly the point a thumb aims at — and when the covered one is the answer, the
    // answer is on screen and unreachable. Measured before this: 2-4 samples in a 60s
    // round where the correct bubble failed a hit-test at its own centre.
    // One relaxation pass per frame, x only, so the authored vertical drift is untouched.
    function separate() {
      const W = field.clientWidth || 600;
      for (let i = 0; i < bubbles.length; i++) {
        const a = bubbles[i];
        if (a.hidden) continue;
        for (let j = i + 1; j < bubbles.length; j++) {
          const c = bubbles[j];
          if (c.hidden) continue;
          const need = Math.max(a.size, c.size) / 2 + 10;
          const ay = a.y + a.size / 2, cy = c.y + c.size / 2;
          const dy = cy - ay;
          if (Math.abs(dy) >= need) continue;                 // not level with each other
          const ax = a.x + swayOf(a) + a.size / 2, cx = c.x + swayOf(c) + c.size / 2;
          const dx = cx - ax;
          const wantDx = Math.sqrt(need * need - dy * dy);    // the x gap that clears both centres
          if (Math.abs(dx) >= wantDx) continue;
          const sign = dx === 0 ? (i % 2 ? 1 : -1) : Math.sign(dx);
          const push = (wantDx - Math.abs(dx)) / 2;
          a.x = Math.max(FIELD_PAD, Math.min(W - a.size - FIELD_PAD, a.x - sign * push));
          c.x = Math.max(FIELD_PAD, Math.min(W - c.size - FIELD_PAD, c.x + sign * push));
        }
      }
    }

    function place(b) {
      const W = field.clientWidth || 600, H = field.clientHeight || 500;
      const sway = swayOf(b);
      const px = Math.max(FIELD_PAD, Math.min(W - b.size - FIELD_PAD, b.x + sway));
      // hard containment: whatever the drift does, the bubble stays inside the play field,
      // so every answer on screen is a whole answer and every centre is tappable (S12)
      b.y = Math.max(FIELD_PAD, Math.min(H - b.size - FIELD_PAD, b.y));
      b.node.style.width = b.node.style.height = b.size + 'px';
      b.node.style.left = px + 'px';
      b.node.style.bottom = b.y + 'px';
      b.node.style.fontSize = Math.max(28, b.size * 0.42) + 'px';
    }

    function startLoop() {
      stopLoop();
      let lastNow = performance.now();
      const stepFrame = (now) => {
        if (!now) now = performance.now();
        // RUN18D D2: the frame clock only ever advanced on a PAUSED frame, so `now - lastNow`
        // grew without bound and the 38ms clamp made every playing frame a fixed 38ms step -
        // the drift was neither the authored speed nor frame-rate independent. It advances
        // every frame now, and the clamp does what it was always meant to do: absorb a
        // dropped frame or a backgrounded tab without teleporting the board.
        const ms = Math.min(now - lastNow, 38);
        lastNow = now;
        const sec = ms / 1000;
        // RUN12 S6: bubbles do not drift on behind an intro or a "?" replay
        if (!document.hidden && !shell.paused()) {
          const H = field.clientHeight || 500;
          const step = driftPxS() * sec;
          for (const b of bubbles) {
            // RUN18D D2 - a bubble RETIRES at the HUD edge with a 300ms fade rather than
            // vanishing mid-air, and it never crosses the edge to do it. It stays inside the
            // field and stays tappable all the way through the fade, which is what keeps the
            // correct-answer guarantee true: the answer is on screen and reachable at every
            // instant, including the instant it is leaving.
            if (b.fadingSince) {
              if (now - b.fadingSince >= DESPAWN_FADE_MS) respawn(b);
              continue;
            }
            b.y += step;
            // RUN12 S12 — a bubble is RETIRED when its top edge reaches the top of the play
            // field and respawned from the bottom, fully inside. It used to drift on until
            // it was completely past the field (b.y > H + b.size) and respawn from
            // b.y = -size - up to 60 more: for seconds at a time the answer was outside the
            // play area entirely, clipped from view but still in the DOM, so a hit-test at
            // its centre hit the screen behind it. Measured at 390x844: bubbles crossed into
            // the HUD's band in 10 of 12 samples, worst overlap 164px, and one bubble was
            // genuinely untappable.
            if (b.y + b.size >= H - FIELD_PAD) {
              // RUN18D, the Explanation Standard: the CORRECT bubble leaving the top
              // unanswered is the pack's "times out unanswered" case. It is said once per
              // question, so a slow reader is told the answer rather than watching it go by
              // in silence over and over.
              if (b.correct && !toldThisQuestion) {
                toldThisQuestion = true;
                shell.react(timeoutLine(), { voice: false, hold: 2800 });
              }
              b.y = Math.max(FIELD_PAD, H - b.size - FIELD_PAD);
              b.fadingSince = now;
              b.node.classList.remove('bp-fresh');
              b.node.classList.add('bp-sink');
            }
          }
          separate();
          for (const b of bubbles) place(b);
        }
        loopId = requestAnimationFrame(stepFrame);
      };
      loopId = requestAnimationFrame(stepFrame);
    }
    function stopLoop() { if (loopId) cancelAnimationFrame(loopId); loopId = null; }

    function respawn(b) {
      // RUN18D D2: back in the bottom SPAWN_BAND of the field, fully inside it. The correct
      // bubble is therefore never more than DESPAWN_FADE_MS away from being a whole,
      // untouched answer again - well inside the 800ms the pack allows.
      const H = field.clientHeight || 500;
      const usable = Math.max(0, H - b.size - FIELD_PAD * 2);
      b.y = FIELD_PAD + Math.random() * usable * SPAWN_BAND;
      b.x = Math.random() * ((field.clientWidth || 600) - b.size - 12) + 6;
      b.fadingSince = 0;
      b.node.classList.remove('bp-sink');
      // a short fade so a retired bubble reads as a new one arriving, not a teleport
      b.node.classList.remove('bp-fresh'); void b.node.offsetWidth; b.node.classList.add('bp-fresh');
      if (!b.correct) {
        // fresh distractor value, keeping exactly one correct on the board
        const onBoard = new Set(bubbles.map(x => x.value));
        const pool = target.distractors.filter(v => v !== target.answer && !onBoard.has(v));
        b.value = pool.length ? pool[rand(pool.length)] : Math.max(1, target.answer + (rand(11) - 5));
      }
      b.hidden = false;
      paint(b);
    }

    // The pack's two lines, verbatim. «a» × «b» is the QUESTION she is looking at: for the
    // times-tables category that is literally "7 × 8", and for the other four (bonds,
    // add & subtract, doubles, more or less) it is that category's own written question,
    // because there is no a and b to name. Noted for Alex.
    const asked = () => String(target.display || '').replace(/\s*=\s*\?\s*$/, '').trim();
    const wrongLine = (tapped) => `Not ${tapped} — we're after ${asked()}!`;
    const timeoutLine = () => `It was ${fmt()(target.answer)} — ${asked()} = ${fmt()(target.answer)}.`;
    if (typeof window !== 'undefined') window.__bubblepopLines = { wrongLine, timeoutLine, asked };

    function onPop(b) {
      if (locked || b.hidden) return;
      if (b.correct) {
        locked = true;
        streak++;
        sfx.ping ? sfx.ping(streak) : sfx.pop();
        recordResult(target.key, true);
        const r = b.node.getBoundingClientRect();
        const px = r.left + r.width / 2, py = r.top + r.height / 2;
        sparkleAt(px, py);
        burstDroplets(px, py);                       // pops burst into droplets (C5)
        if (streak >= STREAK_TRAIL) sparkleTrail(px, py);   // a hot streak trails sparkles
        if (b.golden) { goldenCount++; sfx.star(); addMeterPoints(1); goldenPop(px, py); }   // golden delight
        b.node.classList.add('burst');
        solved++;
        shell.setProgress(solved);
        shell.timeout(() => {
          if (solved >= ROUNDS) return finish();
          target = nextTarget(solved);
          toldThisQuestion = false;
          prevKey = target.key;
          targetCard.innerHTML = targetHTML(target);
          layoutValues();
          updateSky();
          locked = false;
        }, 260);
      } else {
        wrongPops++;
        streak = 0;
        recordResult(target.key, false);
        collector.addAttempted(missFor(target));
        // RUN18D, the EXPLANATION STANDARD: a wrong answer always teaches. It used to
        // wobble in silence and say "oops" only on the SECOND one — so the first wrong tap
        // of a round taught nothing at all. Line verbatim from the pack.
        explainWrong(b.node, wrongLine(fmt()(b.value)), { say: (t) => shell.react(t, { voice: false, hold: 2600 }), speak: false });
        b.node.classList.add('dim');
        setTimeout(() => b.node.classList.remove('dim'), 420);
        shell.dimHeart();
      }
    }

    function doHint() {
      if (hintsUsed >= MAX_HINTS) return;
      hintsUsed++;
      // fade out half of the wrong bubbles
      const wrong = bubbles.filter(b => !b.correct && !b.hidden);
      shuffle(wrong);
      wrong.slice(0, Math.ceil(wrong.length / 2)).forEach(b => { b.hidden = true; paint(b); });
      shell.react(guideLine('hintBubble'));
      if (hintsUsed >= MAX_HINTS) shell.enableHint(false);
    }

    function missFor(t) {
      const f = t.fmt || String;
      const ds = shuffle(t.distractors.slice()).filter(v => v !== t.answer).slice(0, 2);
      return choiceMiss({ id: t.key, game: 'bubblepop', prompt: t.display, options: [t.answer, ...ds].map(f), answer: f(t.answer) });
    }

    // ---- juice fx (C5): droplet burst, streak sparkle trail, golden "+1" ----
    function burstDroplets(x, y) {
      if (REDUCED) return;
      for (let i = 0; i < DROPLETS; i++) {
        const d = el('div', { class: 'bp-droplet' });
        const a = (i / DROPLETS) * Math.PI * 2 + Math.random();
        d.style.left = x + 'px'; d.style.top = y + 'px';
        d.style.setProperty('--dx', (Math.cos(a) * (28 + Math.random() * 34)).toFixed(0) + 'px');
        d.style.setProperty('--dy', (Math.sin(a) * (28 + Math.random() * 34) - 12).toFixed(0) + 'px');
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 720);
      }
    }
    function sparkleTrail(x, y) { if (REDUCED) return; for (let i = 1; i <= 4; i++) setTimeout(() => sparkleAt(x + (Math.random() * 40 - 20), y - i * 22), i * 50); }
    function goldenPop(x, y) {
      const t = el('div', { class: 'bp-goldpop', text: '+1 ✨' });
      t.style.left = x + 'px'; t.style.top = y + 'px';
      document.body.appendChild(t); setTimeout(() => t.remove(), 1100);
      if (!REDUCED) for (let i = 0; i < 6; i++) setTimeout(() => sparkleAt(x + (Math.random() * 50 - 25), y - Math.random() * 40), i * 40);
    }

    // Test hook (invisible): drive + inspect the juice.
    if (typeof window !== 'undefined') window.__bubblepop = {
      state: () => ({ solved, streak, goldenCount, wrongPops, sky: skyFor() }),
      // RUN18B Y10 QA: what she is being asked, and whether the eligible pool was big enough.
      key: () => target.key,
      gate: () => ({ on: gate.on, found: gate.found, want: gate.want }),
      forceGolden: () => { const b = bubbles.find(x => x.correct && !x.hidden); if (b && goldenCount < GOLDEN_CAP) { b.golden = true; goldenThisRound = true; b.node.classList.add('golden'); } return !!(b && b.golden); },
      popCorrect: () => { const b = bubbles.find(x => x.correct && !x.hidden); if (b) onPop(b); },
      popWrong: () => { const b = bubbles.find(x => !x.correct && !x.hidden); if (b) onPop(b); },
      hasGolden: () => bubbles.some(b => b.golden && !b.hidden),
      droplets: () => document.querySelectorAll('.bp-droplet').length,
      // RUN12 S12 QA: the field's own box and every bubble's, for the containment sweep
      fieldRect: () => { const r = field.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; },
      bubbleRects: () => bubbles.filter(b => !b.hidden).map(b => { const r = b.node.getBoundingClientRect(); return { correct: b.correct, top: r.top, bottom: r.bottom, left: r.left, right: r.right, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }),
      pad: () => FIELD_PAD,
      goldPops: () => document.querySelectorAll('.bp-goldpop').length,
      // RUN18D D2 QA: the authored drift for the board as it stands, and whether the
      // correct answer is on screen, whole and hit-testable, at this instant.
      speedPxS: () => driftPxS(),
      spawnBand: () => SPAWN_BAND,
      correctState: () => {
        const b = bubbles.find(x => x.correct);
        if (!b) return null;
        const r = b.node.getBoundingClientRect(), f = field.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const hit = document.elementFromPoint(cx, cy);
        return {
          hidden: b.hidden, fading: !!b.fadingSince,
          inside: r.top >= f.top - 0.5 && r.bottom <= f.bottom + 0.5 && r.left >= f.left - 0.5 && r.right <= f.right + 0.5,
          tappable: !!(hit && (hit === b.node || b.node.contains(hit)))
        };
      }
    };

    function finish() {
      stopLoop();
      window.removeEventListener('resize', onFieldResize);
      shell.cleanup();
      const stars = starsFor(wrongPops, hintsUsed);
      recordBest('bubblepop', mix ? MIX_KEY : catKey, stars);
      ctx.go('results', { game: 'bubblepop', gameName: mix ? 'Smart Mix' : 'Bubble Pop', stars, level, cat: mix ? null : catKey, mix, tricky: collector.items(), replay: () => ctx.go('bubblepop') });
    }
  }

  return { unmount() { if (loopId) cancelAnimationFrame(loopId); if (shell) shell.cleanup(); } };
}

// ---- stars ----
export function starsFor(wrongPops, hintsUsed) {
  if (hintsUsed === 0 && wrongPops <= 1) return 3;
  if (wrongPops <= 3) return 2;
  return 1;
}

// ---- question generation (spec §6, §10.3) ----
export function genTarget(level, prevKey) {
  const cfg = LEVELS[level];
  let op, t, f, answer, display, factorAnswer, key;
  let guard = 0;
  do {
    op = cfg.ops[rand(cfg.ops.length)];
    t = cfg.tables[rand(cfg.tables.length)];
    f = 1 + rand(12);
    const product = t * f;
    if (op === 'mul') { answer = product; display = `${t} × ${f} = ?`; factorAnswer = false; }
    else if (op === 'div') { answer = f; display = `${product} ÷ ${t} = ?`; factorAnswer = true; }
    else { answer = f; display = `? × ${t} = ${product}`; factorAnswer = true; }
    key = `${op}:${t}:${f}`;
  } while (key === prevKey && ++guard < 12);
  return { op, t, f, answer, display, factorAnswer, key };
}

function digitSwap(n) {
  if (n >= 10 && n < 100) {
    const r = (n % 10) * 10 + Math.floor(n / 10);
    if (r !== n && r > 0) return r;
  }
  return null;
}

export function distractors(target) {
  const { answer, t, f, factorAnswer } = target;
  const set = new Set();
  const add = (v) => { if (Number.isInteger(v) && v > 0 && v !== answer) set.add(v); };
  if (!factorAnswer) {
    add(answer - t); add(answer + t);
    add(t * (f - 1)); add(t * (f + 1)); add(t * (f + 2)); add(t * (f - 2));
    const sw = digitSwap(answer); if (sw) add(sw);
  } else {
    add(answer - 1); add(answer + 1); add(answer - 2); add(answer + 2); add(answer + 3); add(answer - 3);
  }
  let guard = 0;
  while (set.size < 8 && guard++ < 80) {
    if (factorAnswer) { add(1 + rand(13)); add(answer + (rand(9) - 4)); }   // factors: any 1..13
    else { const j = (1 + rand(4)) * t; add(Math.random() < 0.5 ? answer + j : answer - j); add(answer + (rand(13) - 6)); }
  }
  return [...set];
}

function freshDistractor(target, onBoard) {
  const ds = distractors(target).filter(v => v !== target.answer && !onBoard.has(v));
  if (ds.length) return ds[rand(ds.length)];
  // fallback near-range
  let v; let guard = 0;
  do { v = Math.max(1, target.answer + (rand(11) - 5)); } while ((v === target.answer || onBoard.has(v)) && guard++ < 20);
  return v;
}

function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
