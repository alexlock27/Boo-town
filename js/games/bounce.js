// js/games/bounce.js — Boo Bounce (spec RUN2 C5; aim-and-launch RUN6 C4; integrity RUN8 C0).
// A gentle brick-breaker: a draggable paddle, one soft ball, a candy brick wall
// (6 across, 4 deep). Three bricks wear answer labels (one correct). Breaking the
// correct brick clears its row and brings the next question. Breaking a wrong label
// just breaks it and the label hops elsewhere. Ball loss dims a heart (never ends the
// round). Round = 8 questions answered or the wall fully cleared twice.
//
// RUN8 C0 integrity:
//  · aim EVERY question — the ball returns to the paddle for a full aim-and-launch (with
//    the dotted preview) at the start of every question, not just round-start / ball-loss.
//  · label invariants enforced continuously while a question is active — exactly three
//    labelled bricks, exactly one correct; a labelled brick destroyed by anything other
//    than its answer-hit re-homes its label with a visible sparkle-hop; wrong labels drop
//    first when bricks are scarce (never below one wrong + the correct); a single brick
//    always carries the correct answer.
//  · wall replenishment — every new question tops the wall back up to at least MIN_WALL
//    bricks with a quick restack animation.

import { el, clear, starsRow, confetti, REDUCED, backControl } from '../ui.js';
import { getState, recordResult } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { makeQuestion, autoQuestion, BLOCK_CATEGORIES } from '../questions.js';
import { createTrickyCollector, choiceMiss } from '../trickypile.js';
import { arcadeHasPicker, filterArcadeCategories } from '../content.js';
import { pickForMeButton } from '../picker.js';
import { maybeIntro, replayIntro } from '../intro.js';

const AUTO = '__auto__';   // Light-tier arcade: no picker, Smart-Mix-driven (C9)

const COLS = 6, ROWS = 4;
const QUESTIONS = 8;           // round ends after 8 questions answered
const MAX_WALL_CLEARS = 2;     // ...or the wall fully cleared twice
const MIN_WALL = 12;           // every new question tops the wall back up to >= this many bricks (C0)
const MAX_LABELS = 3;          // exactly three labelled bricks while bricks allow (C0)
const BRICK_COLORS = ['#FF7AC6', '#35D0BA', '#8FC7FF', '#C6A9F0', '#FFC93C', '#7FD8C3'];
// Aim-and-launch (RUN6 C4): the serve rests on the paddle; a drag aims within an
// upward cone; a dotted preview shows the path incl. its first wall bounce; release fires.
const AIM_MIN = -172 * Math.PI / 180, AIM_MAX = -8 * Math.PI / 180;  // upward cone (never sideways/down)
const AIM_DEFAULT = -Math.PI / 2;      // straight up if she just taps
const PREVIEW_DOTS = 70, PREVIEW_STEP = 12;  // dotted trajectory sampling (long enough to reach a wall)
const HOP_MS = 520, RESTACK_MS = 380;  // sparkle-hop + restack animation durations (C0)
// Star thresholds as named constants (C4). Aiming makes intent expressible, so the
// gentle floor stands; 3★ still rewards a clean run.
const WRONG_3STAR = 1, DROPS_3STAR = 1;
const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen bounce' });
  container.appendChild(root);
  let shell = null, raf = null;

  // Jump back in / level-up (RUN5 C0b).
  const rz = params && params.resume;
  if (rz) { rz.mix ? play(AUTO, 2) : play(rz.cat, rz.level); }
  else if (arcadeHasPicker()) startCard(); else play(AUTO, 2);   // Light tier auto-starts (C9)
  maybeIntro('bounce');   // first-ever open: the guided intro (RUN5 C5)

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    let category = s.seen.bounceCat || 'tables';
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 104 }) }),
      el('h2', { text: 'Boo Bounce' }),
      el('p', { class: 'sc-intro', text: 'Bounce the ball into the brick with the right answer!' })
    ]);
    const catRow = el('div', { class: 'chip-row center' });
    filterArcadeCategories(BLOCK_CATEGORIES).forEach(c => {
      const b = el('button', { class: 'acc-chip' + (category === c.key ? ' sel' : ''), text: c.name, onclick: () => { category = c.key; sfx.tap(); catRow.querySelectorAll('.acc-chip').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); } });
      catRow.appendChild(b);
    });
    const levels = el('div', { class: 'level-row' });
    for (const lv of [1, 2, 3]) levels.appendChild(el('button', { class: 'btn level-btn', style: { '--accent': 'var(--pop)' }, onclick: () => { sfx.tap(); play(category, lv); } }, [el('span', { class: 'lv-num', text: 'Level ' + lv })]));
    // one-tap Smart-Mix front door (RUN4 C2), same control as the shared pickers
    const pfmRow = el('div', { class: 'picker-choices' }, [pickForMeButton(() => play(AUTO, 2))]);
    card.append(pfmRow, el('p', { class: 'sc-q', text: 'What shall we practise?' }), catRow, el('p', { class: 'sc-q', text: 'Pick a level' }), levels);
    card.appendChild(el('div', { class: 'star-rule' }, [el('div', { html: starsRow(3, { size: 24 }) }), el('p', { text: 'Three stars: at most one wrong brick and one ball drop.' })]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));   // shared back (job 3)
  }

  function play(category, level) {
    clear(root);
    getState().seen.bounceCat = category;

    const autoMix = category === AUTO;
    let question = autoMix ? autoQuestion(null, 3) : makeQuestion(category, level, null, 3);
    // The active question's option set, split into the one correct text and the wrong texts.
    let correctText = '', wrongTexts = [];
    let bricks = [];
    let questionsAnswered = 0, wrongBricks = 0, ballLosses = 0, wallClears = 0;
    let ended = false;
    let hops = [];             // in-flight sparkle-hops {fx,fy,tx,ty,bornAt,text,correct}
    let animNow = performance.now();

    shell = createGameShell({ title: 'Boo Bounce', rounds: QUESTIONS, accent: 'var(--pop)', onBack: () => { stop(); ctx.go('hub'); }, hintEnabled: false, onHelp: () => replayIntro('bounce') });
    root.appendChild(shell.root);

    const qCard = el('div', { class: 'bounce-question' });
    const canvas = el('canvas', { class: 'bounce-canvas' });
    shell.area.append(qCard, el('div', { class: 'bounce-field' }, [canvas]));
    const collector = createTrickyCollector(shell.area);
    const cx = canvas.getContext('2d');

    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let paddle = { x: 0, w: 0, y: 0, h: 14 };
    let ball = { x: 0, y: 0, vx: 0, vy: 0, r: 9, speed: 0, stuck: true };
    let aiming = false, aimAngle = AIM_DEFAULT;   // aim-and-launch (C4)

    // Split the current question into correct + wrong option texts (deduped, correct kept).
    function setQuestionTexts() {
      const opts = question.options || [];
      correctText = opts[question.correct];
      const seen = new Set([correctText]);
      wrongTexts = [];
      opts.forEach((t, i) => { if (i !== question.correct && !seen.has(t)) { seen.add(t); wrongTexts.push(t); } });
    }
    setQuestionTexts();

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      W = Math.max(320, rect.width); H = Math.max(300, rect.height);
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paddle.w = Math.max(90, W * 0.2); paddle.y = H - 34; if (!paddle.x) paddle.x = W / 2 - paddle.w / 2;
      paddle.x = Math.min(Math.max(0, paddle.x), W - paddle.w);
      ball.r = Math.max(8, W * 0.012); ball.speed = Math.max(4.4, H * 0.011);
      buildWall();
      placeLabels();
      if (ball.stuck) resetBall();
    }

    // Geometry for a grid cell (positions depend on W/H, recomputed here so revived bricks land right).
    function cellGeom(c, r) {
      const top = H * 0.10, gap = 6;
      const bw = (W - gap * (COLS + 1)) / COLS, bh = Math.max(20, H * 0.055);
      return { x: gap + c * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh };
    }
    function buildWall() {
      bricks = [];
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const g = cellGeom(c, r);
        bricks.push({ c, r, x: g.x, y: g.y, w: g.w, h: g.h, alive: true, color: BRICK_COLORS[(r * COLS + c) % BRICK_COLORS.length], label: null, correct: false, bornAt: animNow });
      }
    }
    // Wall replenishment (C0): top the wall back up to >= MIN_WALL by reviving dead cells,
    // top rows first (a natural restack) so the revived bricks sit above and stay hittable.
    function replenishWall() {
      let alive = bricks.filter(b => b.alive).length;
      if (alive >= MIN_WALL) return;
      const dead = bricks.filter(b => !b.alive).sort((a, b) => (a.r - b.r) || (a.c - b.c));
      for (const b of dead) {
        if (alive >= MIN_WALL) break;
        const g = cellGeom(b.c, b.r);
        b.x = g.x; b.y = g.y; b.w = g.w; b.h = g.h;
        b.alive = true; b.label = null; b.correct = false; b.bornAt = animNow;
        b.color = BRICK_COLORS[(b.r * COLS + b.c) % BRICK_COLORS.length];
        alive++;
      }
    }

    function labelBricks() { return bricks.filter(b => b.alive && b.label != null); }

    // Reachability (C4): a labelled brick must have a clear column below it (a straight
    // shot) OR a one-bounce path (an adjacent column clear at/below its row).
    function columnClearBelow(b) { return !bricks.some(x => x.alive && x.c === b.c && x.r > b.r); }
    function reachable(b) {
      if (columnClearBelow(b)) return true;
      for (const dc of [-1, 1]) { const nc = b.c + dc; if (nc >= 0 && nc < COLS && !bricks.some(x => x.alive && x.c === nc && x.r >= b.r)) return true; }
      return false;
    }

    // The texts that SHOULD be labelled right now: correct first, then wrongs, up to
    // min(MAX_LABELS, alive). Wrong labels drop first when bricks are scarce; a single
    // brick carries only the correct answer (C0).
    function wantedTexts() {
      const alive = bricks.filter(b => b.alive).length;
      if (alive <= 0) return [];
      const want = Math.min(MAX_LABELS, alive);
      const out = [correctText];
      for (const w of wrongTexts) { if (out.length >= want) break; out.push(w); }
      return out;
    }
    // Reconcile the bricks' labels to the wanted set, keeping every label on an alive,
    // reachable brick. hop=true animates any move (the visible sparkle-hop).
    function reconcile(hop) {
      const want = wantedTexts();
      // 1. strip labels on dead bricks or no longer wanted
      bricks.forEach(b => { if (b.label != null && (!b.alive || want.indexOf(b.label) < 0)) { b.label = null; b.correct = false; } });
      // 2. de-dupe (a text lives on at most one brick)
      const placed = {};
      bricks.forEach(b => { if (b.alive && b.label != null) { if (placed[b.label]) { b.label = null; b.correct = false; } else placed[b.label] = b; } });
      // 3. every wanted text sits on an alive, reachable brick
      for (const text of want) {
        const isCorrect = text === correctText;
        const cur = placed[text];
        if (cur && reachable(cur)) { cur.correct = isCorrect; continue; }
        const free = shuffle(bricks.filter(x => x.alive && x.label == null));
        const rpool = free.filter(reachable);
        const pool = rpool.length ? rpool : free;
        if (!pool.length) { if (cur) cur.correct = isCorrect; continue; }  // best effort: no free home
        const t = pool[0];
        if (cur && cur !== t) { if (hop) spawnHop(cur.x + cur.w / 2, cur.y + cur.h / 2, t, text, isCorrect); cur.label = null; cur.correct = false; }
        t.label = text; t.correct = isCorrect; placed[text] = t;
      }
    }
    // Fresh assignment for a NEW question: clear every previous label, then place (no hops).
    function placeLabels() { bricks.forEach(b => { b.label = null; b.correct = false; }); reconcile(false); }
    // Exposed as the reflow hook: re-home any label buried out of reach (C4).
    function ensureReachableLabels() { reconcile(true); }

    // A visible sparkle-hop from (fx,fy) to a target brick — makes a re-home legible (C0).
    function spawnHop(fx, fy, tb, text, correct) {
      if (REDUCED) return;
      hops.push({ fx, fy, tx: tb.x + tb.w / 2, ty: tb.y + tb.h / 2, bornAt: animNow, text: String(text), correct: !!correct });
    }

    function renderQuestion() {
      clear(qCard);
      qCard.appendChild(el('div', { class: 'bounce-prompt', text: question.prompt }));
      if (question.speak) speakMaybe(question.speak);
      if (typeof window !== 'undefined') window.__booQuestion = question;
    }

    function resetBall() {
      ball.stuck = true; aiming = false; aimAngle = AIM_DEFAULT;
      ball.x = paddle.x + paddle.w / 2; ball.y = paddle.y - ball.r - 2;
      ball.vx = Math.cos(aimAngle) * ball.speed; ball.vy = Math.sin(aimAngle) * ball.speed;
    }
    // Fire along the current aim (C4). Flight physics below is UNCHANGED.
    function launch() { if (!ball.stuck) return; aiming = false; ball.vx = Math.cos(aimAngle) * ball.speed; ball.vy = Math.sin(aimAngle) * ball.speed; ball.stuck = false; }
    // The drag aims the resting ball within an upward cone.
    function setAim(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      let a = Math.atan2((clientY - rect.top) - ball.y, (clientX - rect.left) - ball.x);
      if (a >= 0) a = (a > Math.PI / 2) ? AIM_MIN : AIM_MAX;   // pointer at/below the ball → nearest cone edge
      aimAngle = Math.max(AIM_MIN, Math.min(AIM_MAX, a));
    }
    // The dotted trajectory preview: march along the aim, reflecting off the FIRST wall.
    function computePreview() {
      const pts = []; let x = ball.x, y = ball.y, vx = Math.cos(aimAngle), vy = Math.sin(aimAngle), bounced = false, after = 0;
      for (let i = 0; i < PREVIEW_DOTS; i++) {
        x += vx * PREVIEW_STEP; y += vy * PREVIEW_STEP;
        if (x < ball.r) { x = ball.r; vx = Math.abs(vx); bounced = true; }
        else if (x > W - ball.r) { x = W - ball.r; vx = -Math.abs(vx); bounced = true; }
        if (y < ball.r) { y = ball.r; vy = Math.abs(vy); bounced = true; }
        pts.push({ x, y });
        if (bricks.some(b => b.alive && x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)) break;
        if (bounced && ++after > 6) break;   // show the path a little past its first bounce
        if (y > H) break;
      }
      return { pts, bounced };
    }

    // ---- input: aim while resting on the paddle; move the paddle in flight (C4) ----
    let auto = false;
    function movePaddleTo(clientX) {
      const rect = canvas.getBoundingClientRect();
      paddle.x = Math.min(Math.max(0, clientX - rect.left - paddle.w / 2), W - paddle.w);
      if (ball.stuck) { ball.x = paddle.x + paddle.w / 2; }
    }
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); if (ball.stuck) { aiming = true; setAim(e.clientX, e.clientY); } else movePaddleTo(e.clientX); });
    canvas.addEventListener('pointermove', e => { if (aiming) setAim(e.clientX, e.clientY); else if ((e.buttons || e.pressure > 0) && !ball.stuck) movePaddleTo(e.clientX); });
    canvas.addEventListener('pointerup', () => { if (aiming) launch(); });

    // ---- brick hit handling ----
    // A labelled brick destroyed by anything OTHER than its registered answer-hit re-homes
    // its label (with a sparkle-hop); reconcile keeps every surviving label hittable (C0).
    function destroyBrick(b) {
      if (!b.alive) return;
      const fx = b.x + b.w / 2, fy = b.y + b.h / 2, lost = b.label, lostCorrect = b.correct;
      b.alive = false; b.label = null; b.correct = false;
      reconcile(true);
      if (lost != null) {
        const nb = labelBricks().find(x => x.label === lost);
        if (nb) spawnHop(fx, fy, nb, lost, lostCorrect);   // its label found a new home → show the hop
      }
    }
    function onBrickHit(b) {
      if (ended || !b.alive) return;
      if (b.label != null && b.correct) {                 // the correct brick's answer-hit
        b.alive = false; b.label = null; b.correct = false;
        correctAnswer(b); return;
      }
      if (b.label != null) {                              // a wrong brick's answer-hit: count + re-home
        wrongBricks++; sfx.oops();
        recordResult(question.key, false);
        collector.add(choiceMiss({ id: question.key, game: 'bounce', prompt: question.prompt, options: question.options, answer: question.options[question.correct] }));
        shell.react('Hmm!', { voice: false, hold: 1200 });
      }
      destroyBrick(b);                                    // re-homes its label (if any) + keeps invariants
      if (bricks.every(x => !x.alive)) onWallCleared();
    }
    // Incidental destruction (collateral / scripted) — never counts as an answer (C0).
    function killIncidental(b) {
      if (!b || !b.alive || ended) return;
      destroyBrick(b);
      if (bricks.every(x => !x.alive)) onWallCleared();
    }
    function correctAnswer(b) {
      sfx.correct();
      recordResult(question.key, true);
      // clear the whole row of the correct brick
      bricks.filter(x => x.r === b.r).forEach(x => { x.alive = false; x.label = null; x.correct = false; });
      if (!REDUCED) { const rc = canvas.getBoundingClientRect(); confetti({ count: 40, power: 0.7, origin: { x: rc.left + b.x + b.w / 2, y: rc.top + b.y } }); }
      sfx.fanfare();
      questionsAnswered++; shell.setProgress(questionsAnswered);
      if (bricks.every(x => !x.alive)) onWallCleared();
      if (ended) return;
      if (questionsAnswered >= QUESTIONS) return finish();
      // next question: clear old labels, top the wall up, place fresh labels, and return
      // the ball to the paddle so she AIMS AGAIN (aim every question, C0).
      question = autoMix ? autoQuestion(question.key, 3) : makeQuestion(category, level, question.key, 3);
      setQuestionTexts();
      renderQuestion();
      replenishWall();
      placeLabels();
      resetBall();
    }
    function onWallCleared() {
      wallClears++;
      if (wallClears >= MAX_WALL_CLEARS) return finish();
      buildWall();
      placeLabels();   // the active question's labels reappear on the fresh wall (correct always present)
    }

    // ---- physics loop ----
    let last = performance.now();
    function step(now) {
      animNow = now;
      const dt = Math.min(2.4, (now - last) / 16.6); last = now;
      if (!document.hidden && !ended) update(dt);
      draw();
      raf = requestAnimationFrame(step);
    }
    function update(dt) {
      if (auto) { const target = ball.x - paddle.w / 2; paddle.x += Math.sign(target - paddle.x) * Math.min(Math.abs(target - paddle.x), ball.speed * 1.6 * dt); paddle.x = Math.min(Math.max(0, paddle.x), W - paddle.w); if (ball.stuck) launch(); }
      if (ball.stuck) return;
      // normalize speed
      const sp = Math.hypot(ball.vx, ball.vy) || 1; ball.vx = ball.vx / sp * ball.speed; ball.vy = ball.vy / sp * ball.speed;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      // walls
      if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
      // paddle
      if (ball.vy > 0 && ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h && ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.w + ball.r) {
        ball.y = paddle.y - ball.r;
        const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1..1
        const ang = (-90 + hit * 60) * Math.PI / 180;                     // paddle bends the bounce
        ball.vx = Math.cos(ang) * ball.speed; ball.vy = Math.sin(ang) * ball.speed;
        clampAngle();
      }
      // bricks — hitting the correct brick always registers as the answer (C0), whatever
      // the speed or approach: any overlap runs onBrickHit for the struck brick.
      for (const b of bricks) {
        if (!b.alive) continue;
        if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w && ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
          // reflect on the shallower penetration axis
          const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
          const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
          if (overlapX < overlapY) ball.vx = -ball.vx; else ball.vy = -ball.vy;
          onBrickHit(b);
          break;
        }
      }
      // lost the ball
      if (ball.y - ball.r > H) loseBall();
    }
    function clampAngle() {
      // never crawl horizontally: keep |vy| above a floor
      const minVy = ball.speed * 0.35;
      if (Math.abs(ball.vy) < minVy) { ball.vy = (ball.vy < 0 ? -1 : 1) * minVy; const s = Math.hypot(ball.vx, ball.vy) || 1; ball.vx = ball.vx / s * ball.speed; ball.vy = ball.vy / s * ball.speed; }
    }
    function loseBall() {
      ballLosses++; shell.dimHeart(); sfx.oops();
      shell.react(guideLine('oops'), { voice: false, hold: 1600 });
      resetBall(); // hearts never end the round
    }

    function drawBrick(b) {
      let sc = 1, dy = 0;
      if (!REDUCED && b.bornAt != null) {
        const t = Math.min(1, (animNow - b.bornAt) / RESTACK_MS);
        if (t < 1) { const e = 1 - Math.pow(1 - t, 3); sc = 0.3 + 0.7 * e; dy = -(1 - e) * 16; }
      }
      const midx = b.x + b.w / 2, midy = b.y + b.h / 2;
      cx.save();
      if (sc !== 1 || dy !== 0) { cx.translate(midx, midy + dy); cx.scale(sc, sc); cx.translate(-midx, -midy); }
      cx.fillStyle = b.color;
      roundRect(cx, b.x, b.y, b.w, b.h, 6); cx.fill();
      cx.lineWidth = 2.5; cx.strokeStyle = '#2A1B4E'; cx.stroke();
      if (b.label != null) {
        cx.fillStyle = '#2A1B4E'; cx.font = `700 ${Math.min(22, b.h * 0.55)}px Fredoka, sans-serif`;
        cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText(String(b.label), midx, midy);
      }
      cx.restore();
    }
    function drawHops() {
      hops = hops.filter(h => animNow - h.bornAt < HOP_MS);
      for (const h of hops) {
        const t = Math.min(1, (animNow - h.bornAt) / HOP_MS);
        const e = 1 - Math.pow(1 - t, 2);
        const x = h.fx + (h.tx - h.fx) * e;
        const y = h.fy + (h.ty - h.fy) * e - Math.sin(t * Math.PI) * 30;   // a little hop-arc
        cx.save();
        for (let k = 0; k < 6; k++) {
          const a = t * 6.5 + k * 1.05, rr = 5 + t * 12;
          cx.globalAlpha = (1 - t) * 0.9; cx.fillStyle = k % 2 ? '#FFD84D' : '#FFFFFF';
          cx.beginPath(); cx.arc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, 2.4, 0, Math.PI * 2); cx.fill();
        }
        // the hopping label chip
        cx.globalAlpha = 1 - t * 0.25;
        cx.fillStyle = h.correct ? '#FFE9A8' : '#FFFFFF';
        roundRect(cx, x - 15, y - 12, 30, 24, 7); cx.fill();
        cx.lineWidth = 2; cx.strokeStyle = '#2A1B4E'; cx.stroke();
        cx.fillStyle = '#2A1B4E'; cx.font = '700 14px Fredoka, sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
        cx.fillText(h.text, x, y);
        cx.restore();
      }
    }
    function draw() {
      cx.clearRect(0, 0, W, H);
      cx.globalAlpha = 1;
      for (const b of bricks) { if (b.alive) drawBrick(b); }
      drawHops();
      // paddle
      cx.globalAlpha = 1;
      cx.fillStyle = '#FF7AC6'; roundRect(cx, paddle.x, paddle.y, paddle.w, paddle.h, 7); cx.fill(); cx.lineWidth = 3; cx.strokeStyle = '#2A1B4E'; cx.stroke();
      // ball
      cx.beginPath(); cx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); cx.fillStyle = '#FFF8F0'; cx.fill(); cx.lineWidth = 3; cx.strokeStyle = '#2A1B4E'; cx.stroke();
      if (ball.stuck) {
        if (aiming && !REDUCED) {
          const { pts } = computePreview();
          cx.fillStyle = 'rgba(255,255,255,0.8)';
          pts.forEach((p, i) => { if (i % 2 === 0) { cx.beginPath(); cx.arc(p.x, p.y, 3.2, 0, Math.PI * 2); cx.fill(); } });
        }
        cx.fillStyle = 'rgba(255,255,255,0.85)'; cx.font = '600 15px Fredoka, sans-serif'; cx.textAlign = 'center';
        cx.fillText(aiming ? 'Let go to fire! 🎯' : 'Drag to aim, let go to fire!', W / 2, H - 60);
      }
    }

    function finish() {
      if (ended) return; ended = true; stop(); shell.cleanup();
      const stars = starsForBounce(wrongBricks, ballLosses);
      ctx.go('results', { game: 'bounce', gameName: 'Boo Bounce', stars, level, cat: autoMix ? null : category, mix: autoMix, tricky: collector.items(), replay: () => ctx.go('bounce') });
    }
    function stop() { if (raf) cancelAnimationFrame(raf); raf = null; }

    renderQuestion();
    requestAnimationFrame(() => { resize(); last = performance.now(); raf = requestAnimationFrame(step); });
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    // Test hook (invisible): drive a headless round.
    if (typeof window !== 'undefined') window.__bounce = {
      autoPaddle: (on) => { auto = on; },
      launch: () => launch(),
      breakCorrect: () => { const b = bricks.find(x => x.alive && x.correct); if (b) onBrickHit(b); },
      breakWrong: () => { const b = bricks.find(x => x.alive && x.label != null && !x.correct); if (b) onBrickHit(b); },
      loseBall: () => loseBall(),
      // aim-and-launch (C4)
      aimDeg: (deg) => { aiming = true; aimAngle = Math.max(AIM_MIN, Math.min(AIM_MAX, deg * Math.PI / 180)); },
      aimAngleDeg: () => aimAngle * 180 / Math.PI,
      aimStart: () => { aiming = true; },
      preview: () => computePreview(),
      fire: () => launch(),
      // reachability + label invariants (C4/C0)
      labelInfo: () => labelBricks().map(b => ({ c: b.c, r: b.r, correct: b.correct, reachable: reachable(b), clearColumn: columnClearBelow(b), label: b.label })),
      labelSummary: () => { const L = labelBricks(); return { total: L.length, correct: L.filter(b => b.correct).length, correctPresent: L.some(b => b.correct), correctReachable: L.some(b => b.correct && reachable(b)), wrong: L.filter(b => !b.correct).length }; },
      brickAliveAt: (c, r) => bricks.some(b => b.c === c && b.r === r && b.alive),
      ballSpeed: () => Math.hypot(ball.vx, ball.vy),
      reflow: () => ensureReachableLabels(),
      // wall replenishment + animation evidence (C0)
      minWall: () => MIN_WALL,
      wallCount: () => bricks.filter(b => b.alive).length,
      restacking: () => bricks.filter(b => b.alive && b.bornAt != null && (animNow - b.bornAt) < RESTACK_MS).length,
      hopCount: () => hops.length,
      question: () => ({ prompt: question.prompt, key: question.key, correctText }),
      // incidental (non-answer) destruction — for the integrity scenario (C0)
      killBrickAt: (c, r) => { const b = bricks.find(x => x.c === c && x.r === r && x.alive); if (!b) return null; killIncidental(b); return { c, r }; },
      killCorrectBrick: () => { const b = labelBricks().find(x => x.correct); if (!b) return null; const info = { c: b.c, r: b.r }; killIncidental(b); return info; },
      killWrongBrick: () => { const b = labelBricks().find(x => !x.correct) || labelBricks()[0]; if (!b) return null; const info = { c: b.c, r: b.r, correct: b.correct }; killIncidental(b); return info; },
      // deplete the wall to n alive bricks WITHOUT ever removing the correct answer (C0 88-case)
      depleteTo: (n) => { let g = 0; while (bricks.filter(b => b.alive).length > n && g++ < 200) { const b = bricks.find(x => x.alive && !x.correct && x.label == null) || bricks.find(x => x.alive && !x.correct); if (!b) break; killIncidental(b); } return bricks.filter(b => b.alive).length; },
      // deliberately bury a label on a back brick with alive bricks below it, then it can re-place
      buryLabel: () => {
        const lbl = labelBricks().find(x => !x.correct) || labelBricks()[0]; if (!lbl) return null;
        const buried = bricks.find(x => x.alive && x.label == null && bricks.some(y => y.alive && y.c === x.c && y.r > x.r));
        if (!buried) return null;
        buried.label = lbl.label; buried.correct = lbl.correct; lbl.label = null; lbl.correct = false;
        return { c: buried.c, r: buried.r, reachable: reachable(buried) };
      },
      // serve straight up the target label's column (deterministic aimed hit for the test)
      serveAtLabel: (text) => {
        const b = labelBricks().find(x => x.label === text) || labelBricks().find(x => x.correct); if (!b) return null;
        ball.x = b.x + b.w / 2; paddle.x = Math.min(Math.max(0, ball.x - paddle.w / 2), W - paddle.w);
        ball.y = paddle.y - ball.r - 2; ball.stuck = true;
        aimAngle = AIM_DEFAULT; aiming = true; launch();
        return { c: b.c, r: b.r, correct: b.correct, lowest: columnClearBelow(b) };
      },
      state: () => ({ questionsAnswered, wrongBricks, ballLosses, wallClears, ended, aiming, stuck: ball.stuck, alive: bricks.filter(b => b.alive).length, labels: labelBricks().length, hearts: shell.heartsLeft(), bx: +ball.x.toFixed(1), by: +ball.y.toFixed(1) })
    };
    // clean up the resize listener on unmount via the shell cleanup chain
    play._cleanup = () => window.removeEventListener('resize', onResize);
  }

  return { unmount() { if (raf) cancelAnimationFrame(raf); if (play._cleanup) play._cleanup(); if (shell) shell.cleanup(); } };
}

export function starsForBounce(wrongBricks, ballLosses) {
  if (wrongBricks <= WRONG_3STAR && ballLosses <= DROPS_3STAR) return 3;
  if (wrongBricks + ballLosses <= 3) return 2;
  return 1;
}

function roundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r);
  cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
}
