// js/games/bubblepop.js — Game 1: Bubble Pop (maths fact fluency, spec §6).

import { el, clear, starsRow, wobble, sparkleAt } from '../ui.js';
import { getState } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { LEVELS, LEVEL_LABELS } from '../../data/tablesConfig.js';
import { BUBBLE_CATEGORIES, BUBBLE_BY_KEY, genQuestion, LEVEL_NAME } from '../../data/bubbleCategories.js';
import { buildPicker, recordBest } from '../picker.js';

const ROUNDS = 10;
const BUBBLE_COUNT = 6;
const MAX_HINTS = 2;

const rand = (n) => (Math.random() * n) | 0;

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen bubblepop' });
  container.appendChild(root);
  let shell = null;
  let loopId = null;

  startCard();

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
      choices: BUBBLE_CATEGORIES.map(c => ({ key: c.key, name: c.name })),
      levelsFor: (key) => BUBBLE_BY_KEY[key].levels,
      levelName: LEVEL_NAME,
      onStart: (catKey, level) => play(catKey, level)
    });
    card.appendChild(picker.node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: at most one wrong pop, and no hints.' })
    ]));
    root.appendChild(card);
  }

  function play(catKey, level) {
    clear(root);
    let prevKey = null;
    let target = genQuestion(catKey, level, prevKey);
    prevKey = target.key;
    let solved = 0;
    let wrongPops = 0;
    let hintsUsed = 0;
    let locked = false;
    const fmt = () => (target.fmt || String);

    shell = createGameShell({
      title: 'Bubble Pop', rounds: ROUNDS, accent: 'var(--pop)',
      onBack: () => { stopLoop(); ctx.go('hub'); },
      onHint: doHint,
      hintEnabled: true
    });
    root.appendChild(shell.root);

    // target card
    const targetCard = el('div', { class: 'target-card', html: targetHTML(target) });
    const field = el('div', { class: 'bubble-field' });
    shell.area.append(targetCard, field);

    // build bubbles
    const bubbles = [];
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const b = { value: 0, correct: false, x: 0, y: 0, vx: 0, speed: 0, size: 0, hidden: false, node: null, _pi: i };
      const node = el('button', { class: 'bubble', 'aria-label': 'bubble' });
      node.addEventListener('click', () => onPop(b));
      b.node = node;
      field.appendChild(node);
      bubbles.push(b);
    }
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
      bubbles.forEach((b, i) => {
        b.value = values[i];
        b.correct = (b.value === target.answer);
        b.hidden = false;
        paint(b);
      });
    }

    function paint(b) {
      b.node.textContent = fmt()(b.value);
      b.node.classList.remove('burst');
      b.node.style.visibility = b.hidden ? 'hidden' : 'visible';
      b.node.style.pointerEvents = b.hidden ? 'none' : 'auto';
      const palette = ['#FF7AC6', '#35D0BA', '#8FC7FF', '#C6A9F0', '#FFC93C', '#7FD8C3'];
      b.node.style.setProperty('--bub', palette[b._pi % palette.length]);
    }

    function resetPositions() {
      const W = field.clientWidth || 600, H = field.clientHeight || 500;
      bubbles.forEach((b, i) => {
        b.size = 74 + rand(16);
        b._pi = i;
        b.x = (i + 0.5) / BUBBLE_COUNT * W - b.size / 2 + (Math.random() * 24 - 12);
        b.y = (i / BUBBLE_COUNT) * (H - 40) + Math.random() * 30; // spread across the field
        b.speed = 0.6 + Math.random() * 0.5;                       // gentle upward drift
        b.phase = Math.random() * Math.PI * 2;
        place(b);
      });
    }

    function place(b) {
      const W = field.clientWidth || 600;
      const sway = Math.sin((b.y + b.phase * 80) / 90) * 14;
      const px = Math.max(6, Math.min(W - b.size - 6, b.x + sway));
      b.node.style.width = b.node.style.height = b.size + 'px';
      b.node.style.left = px + 'px';
      b.node.style.bottom = b.y + 'px';
      b.node.style.fontSize = Math.max(28, b.size * 0.42) + 'px';
    }

    function startLoop() {
      stopLoop();
      const stepFrame = () => {
        if (!document.hidden) {
          const H = field.clientHeight || 500;
          for (const b of bubbles) {
            b.y += b.speed;
            if (b.y > H + b.size) respawn(b);
            place(b);
          }
        }
        loopId = requestAnimationFrame(stepFrame);
      };
      loopId = requestAnimationFrame(stepFrame);
    }
    function stopLoop() { if (loopId) cancelAnimationFrame(loopId); loopId = null; }

    function respawn(b) {
      b.y = -b.size - Math.random() * 60;
      b.x = Math.random() * ((field.clientWidth || 600) - b.size - 12) + 6;
      if (!b.correct) {
        // fresh distractor value, keeping exactly one correct on the board
        const onBoard = new Set(bubbles.map(x => x.value));
        const pool = target.distractors.filter(v => v !== target.answer && !onBoard.has(v));
        b.value = pool.length ? pool[rand(pool.length)] : Math.max(1, target.answer + (rand(11) - 5));
      }
      b.hidden = false;
      paint(b);
    }

    function onPop(b) {
      if (locked || b.hidden) return;
      if (b.correct) {
        locked = true;
        sfx.pop();
        const r = b.node.getBoundingClientRect();
        sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
        b.node.classList.add('burst');
        solved++;
        shell.setProgress(solved);
        setTimeout(() => {
          if (solved >= ROUNDS) return finish();
          target = genQuestion(catKey, level, prevKey);
          prevKey = target.key;
          targetCard.innerHTML = targetHTML(target);
          layoutValues();
          locked = false;
        }, 260);
      } else {
        wrongPops++;
        sfx.oops();
        wobble(b.node);
        b.node.classList.add('dim');
        setTimeout(() => b.node.classList.remove('dim'), 420);
        const left = shell.dimHeart();
        if (wrongPops === 2 || left === 0) shell.react(guideLine('oops'), { voice: false, hold: 2200 });
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

    function finish() {
      stopLoop();
      shell.cleanup();
      const stars = starsFor(wrongPops, hintsUsed);
      recordBest('bubblepop', catKey, stars);
      ctx.go('results', { game: 'bubblepop', gameName: 'Bubble Pop', stars, level, replay: () => ctx.go('bubblepop') });
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
