// js/games/bounce.js — Boo Bounce (spec RUN2 C5).
// A gentle brick-breaker: a draggable paddle, one soft ball, a candy brick wall
// (6 across, 4 deep). Three bricks wear answer labels (one correct). Breaking the
// correct brick clears its row and brings the next question. Breaking a wrong label
// just breaks it and the label hops elsewhere. Ball loss dims a heart (never ends the
// round). Round = 8 questions answered or the wall fully cleared twice.

import { el, clear, starsRow, confetti, REDUCED } from '../ui.js';
import { getState, recordResult } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { makeQuestion, BLOCK_CATEGORIES } from '../questions.js';
import { createTrickyCollector, choiceMiss } from '../trickypile.js';

const COLS = 6, ROWS = 4;
const QUESTIONS = 8;           // round ends after 8 questions answered
const MAX_WALL_CLEARS = 2;     // ...or the wall fully cleared twice
const BRICK_COLORS = ['#FF7AC6', '#35D0BA', '#8FC7FF', '#C6A9F0', '#FFC93C', '#7FD8C3'];
const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen bounce' });
  container.appendChild(root);
  let shell = null, raf = null;

  startCard();

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
    BLOCK_CATEGORIES.forEach(c => {
      const b = el('button', { class: 'acc-chip' + (category === c.key ? ' sel' : ''), text: c.name, onclick: () => { category = c.key; sfx.tap(); catRow.querySelectorAll('.acc-chip').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); } });
      catRow.appendChild(b);
    });
    const levels = el('div', { class: 'level-row' });
    for (const lv of [1, 2, 3]) levels.appendChild(el('button', { class: 'btn level-btn', style: { '--accent': 'var(--pop)' }, onclick: () => { sfx.tap(); play(category, lv); } }, [el('span', { class: 'lv-num', text: 'Level ' + lv })]));
    card.append(el('p', { class: 'sc-q', text: 'What shall we practise?' }), catRow, el('p', { class: 'sc-q', text: 'Pick a level' }), levels);
    card.appendChild(el('div', { class: 'star-rule' }, [el('div', { html: starsRow(3, { size: 24 }) }), el('p', { text: 'Three stars: at most one wrong brick and one ball drop.' })]));
    root.appendChild(card);
  }

  function play(category, level) {
    clear(root);
    getState().seen.bounceCat = category;

    let question = makeQuestion(category, level, null, 3);
    let bricks = [], labels = [];
    let questionsAnswered = 0, wrongBricks = 0, ballLosses = 0, wallClears = 0;
    let ended = false;

    shell = createGameShell({ title: 'Boo Bounce', rounds: QUESTIONS, accent: 'var(--pop)', onBack: () => { stop(); ctx.go('hub'); }, hintEnabled: false });
    root.appendChild(shell.root);

    const qCard = el('div', { class: 'bounce-question' });
    const canvas = el('canvas', { class: 'bounce-canvas' });
    shell.area.append(qCard, el('div', { class: 'bounce-field' }, [canvas]));
    const collector = createTrickyCollector(shell.area);
    const cx = canvas.getContext('2d');

    let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    let paddle = { x: 0, w: 0, y: 0, h: 14 };
    let ball = { x: 0, y: 0, vx: 0, vy: 0, r: 9, speed: 0, stuck: true };

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

    // Put the current question's 3 options on 3 random alive bricks (one correct).
    function placeLabels() {
      labels = [];
      const alive = bricks.filter(b => b.alive);
      bricks.forEach(b => { b.label = null; b.correct = false; });
      const chosen = shuffle(alive.slice()).slice(0, Math.min(3, alive.length));
      const opts = question.options.map((text, i) => ({ text, correct: i === question.correct }));
      shuffle(opts);
      chosen.forEach((b, i) => { if (opts[i]) { b.label = opts[i].text; b.correct = opts[i].correct; labels.push(b); } });
    }
    // Move one wrong label to another alive unlabelled brick (keeps the correct one).
    function rehomeLabel(text, correct) {
      const free = bricks.filter(b => b.alive && !b.label);
      if (!free.length) return;
      const b = free[rand(free.length)]; b.label = text; b.correct = correct; labels.push(b);
    }

    function renderQuestion() {
      clear(qCard);
      qCard.appendChild(el('div', { class: 'bounce-prompt', text: question.prompt }));
      if (question.speak) speakMaybe(question.speak);
      if (typeof window !== 'undefined') window.__booQuestion = question;
    }

    function resetBall() {
      ball.stuck = true;
      ball.x = paddle.x + paddle.w / 2; ball.y = paddle.y - ball.r - 2;
      const ang = (-60 - rand(60)) * Math.PI / 180; // upward-ish
      ball.vx = Math.cos(ang) * ball.speed; ball.vy = Math.sin(ang) * ball.speed;
    }
    function launch() { if (ball.stuck) ball.stuck = false; }

    // ---- input: drag the paddle ----
    let auto = false;
    function movePaddleTo(clientX) {
      const rect = canvas.getBoundingClientRect();
      paddle.x = Math.min(Math.max(0, clientX - rect.left - paddle.w / 2), W - paddle.w);
      if (ball.stuck) { ball.x = paddle.x + paddle.w / 2; }
    }
    canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); movePaddleTo(e.clientX); launch(); });
    canvas.addEventListener('pointermove', e => { if (e.buttons || e.pressure > 0) movePaddleTo(e.clientX); });
    canvas.addEventListener('pointerup', () => launch());

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
      question = makeQuestion(category, level, question.key, 3);
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
      if (ball.stuck) { cx.fillStyle = 'rgba(255,255,255,0.85)'; cx.font = '600 15px Fredoka, sans-serif'; cx.textAlign = 'center'; cx.fillText('Tap to launch!', W / 2, H - 60); }
    }

    function finish() {
      if (ended) return; ended = true; stop(); shell.cleanup();
      const stars = starsForBounce(wrongBricks, ballLosses);
      ctx.go('results', { game: 'bounce', gameName: 'Boo Bounce', stars, tricky: collector.items(), replay: () => ctx.go('bounce') });
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
      state: () => ({ questionsAnswered, wrongBricks, ballLosses, wallClears, ended, alive: bricks.filter(b => b.alive).length, labels: labels.length, hearts: shell.heartsLeft(), bx: +ball.x.toFixed(1), by: +ball.y.toFixed(1), stuck: ball.stuck })
    };
    // clean up the resize listener on unmount via the shell cleanup chain
    play._cleanup = () => window.removeEventListener('resize', onResize);
  }

  return { unmount() { if (raf) cancelAnimationFrame(raf); if (play._cleanup) play._cleanup(); if (shell) shell.cleanup(); } };
}

export function starsForBounce(wrongBricks, ballLosses) {
  if (wrongBricks <= 1 && ballLosses <= 1) return 3;
  if (wrongBricks + ballLosses <= 3) return 2;
  return 1;
}

function roundRect(cx, x, y, w, h, r) {
  cx.beginPath();
  cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r);
  cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
}
