// js/games/bounce.js — Boo Bounce (spec RUN2 C5).
// A gentle brick-breaker: a draggable paddle, one soft ball, a candy brick wall
// (6 across, 4 deep). Three bricks wear answer labels (one correct). Breaking the
// correct brick clears its row and brings the next question. Breaking a wrong label
// just breaks it and the label hops elsewhere. Ball loss dims a heart (never ends the
// round). Round = 8 questions answered or the wall fully cleared twice.

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
const BRICK_COLORS = ['#FF7AC6', '#35D0BA', '#8FC7FF', '#C6A9F0', '#FFC93C', '#7FD8C3'];
// Aim-and-launch (RUN6 C4): the serve rests on the paddle; a drag aims within an
// upward cone; a dotted preview shows the path incl. its first wall bounce; release fires.
const AIM_MIN = -172 * Math.PI / 180, AIM_MAX = -8 * Math.PI / 180;  // upward cone (never sideways/down)
const AIM_DEFAULT = -Math.PI / 2;      // straight up if she just taps
const PREVIEW_DOTS = 70, PREVIEW_STEP = 12;  // dotted trajectory sampling (long enough to reach a wall)
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
    let bricks = [], labels = [];
    let questionsAnswered = 0, wrongBricks = 0, ballLosses = 0, wallClears = 0;
    let ended = false;

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

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      W = Math.max(320, rect.width); H = Math.max(300, rect.height);
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paddle.w = Math.max(90, W * 0.2); paddle.y = H - 34; if (!paddle.x) paddle.x = W / 2 - paddle.w / 2;
      paddle.x = Math.min(Math.max(0, paddle.x), W - paddle.w);
      ball.r = Math.max(8, W * 0.012); ball.speed = Math.max(4.4, H * 0.011);
      buildWall();
      if (ball.stuck) resetBall();
    }

    function buildWall() {
      bricks = [];
      const top = H * 0.10, gap = 6;
      const bw = (W - gap * (COLS + 1)) / COLS, bh = Math.max(20, H * 0.055);
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        bricks.push({ c, r, x: gap + c * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh, alive: true, color: BRICK_COLORS[(r * COLS + c) % BRICK_COLORS.length], label: null, correct: false });
      }
      placeLabels();
    }

    // Reachability (C4): a labelled brick must have a clear column below it (a straight
    // shot) OR a one-bounce path (an adjacent column clear at/below its row).
    function columnClearBelow(b) { return !bricks.some(x => x.alive && x.c === b.c && x.r > b.r); }
    function reachable(b) {
      if (columnClearBelow(b)) return true;
      for (const dc of [-1, 1]) { const nc = b.c + dc; if (nc >= 0 && nc < COLS && !bricks.some(x => x.alive && x.c === nc && x.r >= b.r)) return true; }
      return false;
    }
    // Put the current question's 3 options on 3 alive bricks (one correct), preferring
    // reachable bricks so every label can actually be hit.
    function placeLabels() {
      labels = [];
      const alive = bricks.filter(b => b.alive);
      bricks.forEach(b => { b.label = null; b.correct = false; });
      const chosen = shuffle(alive.filter(reachable)).concat(shuffle(alive.filter(b => !reachable(b)))).slice(0, Math.min(3, alive.length));
      const opts = shuffle(question.options.map((text, i) => ({ text, correct: i === question.correct })));
      chosen.forEach((b, i) => { if (opts[i]) { b.label = opts[i].text; b.correct = opts[i].correct; labels.push(b); } });
    }
    // If a labelled brick is (or becomes) unreachable — bricks around it bury it — move
    // its label to a reachable brick (C4).
    function ensureReachableLabels() {
      for (const b of labels.slice()) {
        if (reachable(b)) continue;
        const free = shuffle(bricks.filter(x => x.alive && !x.label && reachable(x)));
        if (!free.length) continue;
        const t = free[0]; t.label = b.label; t.correct = b.correct; b.label = null; b.correct = false;
        labels[labels.indexOf(b)] = t;
      }
    }
    // Move one wrong label to another alive unlabelled brick (prefer reachable).
    function rehomeLabel(text, correct) {
      const free = bricks.filter(b => b.alive && !b.label);
      if (!free.length) return;
      const pool = free.filter(reachable).length ? free.filter(reachable) : free;
      const b = pool[rand(pool.length)]; b.label = text; b.correct = correct; labels.push(b);
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
    function onBrickHit(b) {
      if (ended) return;
      b.alive = false;
      if (b.label != null) {
        if (b.correct) { correctAnswer(b); return; } // correctAnswer handles a cleared wall
        wrongBricks++; sfx.oops();
        recordResult(question.key, false);
        collector.add(choiceMiss({ id: question.key, game: 'bounce', prompt: question.prompt, options: question.options, answer: question.options[question.correct] }));
        shell.react('Hmm!', { voice: false, hold: 1200 });
        const idx = labels.indexOf(b); if (idx >= 0) labels.splice(idx, 1);
        rehomeLabel(b.label, false);
      }
      if (bricks.every(x => !x.alive)) onWallCleared();
    }
    function correctAnswer(b) {
      sfx.correct();
      recordResult(question.key, true);
      // clear the whole row of the correct brick
      bricks.filter(x => x.r === b.r).forEach(x => x.alive = false);
      if (!REDUCED) { const rc = canvas.getBoundingClientRect(); confetti({ count: 40, power: 0.7, origin: { x: rc.left + b.x + b.w / 2, y: rc.top + b.y } }); }
      sfx.fanfare();
      questionsAnswered++; shell.setProgress(questionsAnswered);
      labels = [];
      if (bricks.every(x => !x.alive)) { onWallCleared(); }
      if (ended) return;
      if (questionsAnswered >= QUESTIONS) return finish();
      question = autoMix ? autoQuestion(question.key, 3) : makeQuestion(category, level, question.key, 3);
      renderQuestion();
      placeLabels();
    }
    function onWallCleared() {
      wallClears++;
      if (wallClears >= MAX_WALL_CLEARS) return finish();
      buildWall();
    }

    // ---- physics loop ----
    let last = performance.now();
    function step(now) {
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
      // bricks
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

    function draw() {
      cx.clearRect(0, 0, W, H);
      // bricks
      for (const b of bricks) {
        if (!b.alive) continue;
        cx.fillStyle = b.label != null ? (b.correct ? b.color : b.color) : b.color;
        roundRect(cx, b.x, b.y, b.w, b.h, 6); cx.fill();
        cx.lineWidth = 2.5; cx.strokeStyle = '#2A1B4E'; cx.stroke();
        if (b.label != null) {
          cx.fillStyle = '#2A1B4E'; cx.font = `700 ${Math.min(22, b.h * 0.55)}px Fredoka, sans-serif`;
          cx.textAlign = 'center'; cx.textBaseline = 'middle';
          cx.fillText(String(b.label), b.x + b.w / 2, b.y + b.h / 2);
        }
      }
      // paddle
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
      // reachability (C4)
      labelInfo: () => labels.map(b => ({ c: b.c, r: b.r, correct: b.correct, reachable: reachable(b), clearColumn: columnClearBelow(b), label: b.label })),
      brickAliveAt: (c, r) => bricks.some(b => b.c === c && b.r === r && b.alive),
      ballSpeed: () => Math.hypot(ball.vx, ball.vy),
      reflow: () => ensureReachableLabels(),
      // deliberately bury a label on a back brick with alive bricks below it, then it can re-place
      buryLabel: () => {
        const lbl = labels.find(x => !x.correct) || labels[0]; if (!lbl) return null;
        const buried = bricks.find(x => x.alive && !x.label && bricks.some(y => y.alive && y.c === x.c && y.r > x.r));
        if (!buried) return null;
        buried.label = lbl.label; buried.correct = lbl.correct; lbl.label = null; lbl.correct = false; labels[labels.indexOf(lbl)] = buried;
        return { c: buried.c, r: buried.r, reachable: reachable(buried) };
      },
      // serve straight up the target label's column (deterministic aimed hit for the test)
      serveAtLabel: (text) => {
        const b = labels.find(x => x.label === text) || labels.find(x => x.correct); if (!b) return null;
        ball.x = b.x + b.w / 2; paddle.x = Math.min(Math.max(0, ball.x - paddle.w / 2), W - paddle.w);
        aimAngle = AIM_DEFAULT; aiming = true; launch();
        return { c: b.c, r: b.r, correct: b.correct, lowest: columnClearBelow(b) };
      },
      state: () => ({ questionsAnswered, wrongBricks, ballLosses, wallClears, ended, aiming, stuck: ball.stuck, alive: bricks.filter(b => b.alive).length, labels: labels.length, hearts: shell.heartsLeft(), bx: +ball.x.toFixed(1), by: +ball.y.toFixed(1) })
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
