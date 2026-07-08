// js/games/blocks.js — Boo Blocks (spec RUN2 C4).
// A 9x9 block puzzle where learning dispenses the pieces. Answer a question to
// dispense the next polyomino into a three-slot tray; drag pieces onto the board;
// full rows/columns clear. Round ends after 12 placed pieces or no legal move.

import { el, clear, starsRow, wobble, sparkleAt, backControl, REDUCED } from '../ui.js';
import { getState, recordResult } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { makeQuestion, autoQuestion, BLOCK_CATEGORIES } from '../questions.js';
import { createTrickyCollector, choiceMiss } from '../trickypile.js';
import { noteQuest } from '../quests.js';
import { arcadeHasPicker, filterArcadeCategories } from '../content.js';
import { pickForMeButton } from '../picker.js';
import { runIntro, introSeen } from '../intro.js';

const AUTO = '__auto__';   // Light-tier arcade: no picker, Smart-Mix-driven questions (C9)

const N = 9;                 // 9x9 board
const END_PIECES = 12;       // round ends after 12 placed pieces
const TRAY = 3;              // three-slot tray
const LIFT = 70;             // px the dragged piece floats ABOVE the fingertip (C1) so the hand never hides it
const rand = (n) => (Math.random() * n) | 0;

// The Blocks-specific first-play intro (C1). Step 2 completes a demo line as it shows.
const BLOCKS_INTRO = [
  { text: 'Answer my question and you win a piece!' },
  { text: 'Drag pieces anywhere they fit. Fill a whole line, any direction, and it POPS!', demo: blocksDemoLine },
  { text: 'No spinning needed, every piece fits as it is. The board never fills to the top, just keep popping lines!' }
];

// A little self-completing demo line for intro step 2: fills cell by cell, then pops.
function blocksDemoLine(area) {
  const row = el('div', { class: 'blk-demo-row' });
  const dcells = [];
  for (let i = 0; i < 5; i++) { const c = el('div', { class: 'blk-demo-cell' }); row.appendChild(c); dcells.push(c); }
  area.appendChild(row);
  let timers = [], alive = true;
  function run() {
    if (!alive) return;
    dcells.forEach(c => c.classList.remove('on', 'pop'));
    let i = 0;
    const fill = () => {
      if (!alive) return;
      if (i < 5) { dcells[i].classList.add('on'); i++; timers.push(setTimeout(fill, 240)); }
      else timers.push(setTimeout(() => { if (!alive) return; dcells.forEach(c => { c.classList.remove('on'); c.classList.add('pop'); }); timers.push(setTimeout(run, 950)); }, 380));
    };
    fill();
  }
  run();
  return () => { alive = false; timers.forEach(clearTimeout); };
}

// Fair bag of piece shapes (cells as [row, col] offsets). No rotation (block-blast style).
const SHAPES = {
  single:   [[0,0]],
  domino:   [[0,0],[0,1]],
  tromI:    [[0,0],[0,1],[0,2]],
  tromL:    [[0,0],[1,0],[1,1]],
  corner:   [[0,0],[0,1],[1,0]],
  tetI:     [[0,0],[0,1],[0,2],[0,3]],
  tetL:     [[0,0],[1,0],[2,0],[2,1]],
  tetS:     [[0,1],[0,2],[1,0],[1,1]],
  tetT:     [[0,0],[0,1],[0,2],[1,1]],
  tetO:     [[0,0],[0,1],[1,0],[1,1]],
  block23:  [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]]
};
const BAG_KEYS = Object.keys(SHAPES);
const FIVE_LINE = [[0,0],[0,1],[0,2],[0,3],[0,4]];   // bonus for three-in-a-row correct
const PIECE_COLORS = ['#FF7AC6', '#35D0BA', '#8FC7FF', '#C6A9F0', '#FFC93C', '#7FD8C3'];

function normShape(cells) {
  const minR = Math.min(...cells.map(c => c[0])), minC = Math.min(...cells.map(c => c[1]));
  return cells.map(([r, c]) => [r - minR, c - minC]);
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen blocks' });
  container.appendChild(root);
  let shell = null;
  // Jump back in / level-up (RUN5 C0b).
  const rz = params && params.resume;
  if (rz) { rz.mix ? play(AUTO, 2) : play(rz.cat, rz.level); }
  else if (arcadeHasPicker()) startCard(); else play(AUTO, 2);   // Light tier auto-starts (C9)

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    let category = s.seen.blocksCat || 'tables';
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 104 }) }),
      el('h2', { text: 'Boo Blocks' }),
      el('p', { class: 'sc-intro', text: 'Win pieces, fill lines, pop them!' })
    ]);
    // two-step picker: category, then level
    const catRow = el('div', { class: 'chip-row center' });
    const catBtns = {};
    filterArcadeCategories(BLOCK_CATEGORIES).forEach(c => {
      const b = el('button', { class: 'acc-chip' + (category === c.key ? ' sel' : ''), text: c.name, onclick: () => { category = c.key; sfx.tap(); Object.values(catBtns).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); } });
      catBtns[c.key] = b; catRow.appendChild(b);
    });
    const levels = el('div', { class: 'level-row' });
    for (const lv of [1, 2, 3]) {
      levels.appendChild(el('button', { class: 'btn level-btn', style: { '--accent': 'var(--zing)' },
        onclick: () => { sfx.tap(); play(category, lv); } }, [
        el('span', { class: 'lv-num', text: 'Level ' + lv })
      ]));
    }
    // one-tap Smart-Mix front door (RUN4 C2), same control as the shared pickers
    const pfmRow = el('div', { class: 'picker-choices' }, [pickForMeButton(() => play(AUTO, 2))]);
    card.append(pfmRow, el('p', { class: 'sc-q', text: 'What shall we practise?' }), catRow, el('p', { class: 'sc-q', text: 'Pick a level' }), levels);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: 10+ right and 5 lines cleared, no hints.' })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));   // shared back (job 3)
  }

  function play(category, level) {
    clear(root);
    const s = getState();
    // persist last-played category
    getState().seen.blocksCat = category;

    const board = Array.from({ length: N }, () => Array(N).fill(0));
    let tray = [null, null, null];
    const bag = [];
    let correct = 0, wrong = 0, lines = 0, placed = 0, hintsUsed = 0, streak = 0;
    let question = null, reAsked = false, locked = false, selected = -1, waitingSpace = false;
    let ended = false;

    shell = createGameShell({
      title: 'Boo Blocks', rounds: END_PIECES, accent: 'var(--zing)',
      onBack: () => ctx.go('hub'), onHint: doHint, hintEnabled: true,
      onHelp: () => runIntro('blocks', { steps: BLOCKS_INTRO })   // "?" replays the intro (C1)
    });
    root.appendChild(shell.root);

    // ---- layout ----
    const qCard = el('div', { class: 'blk-question' });
    const boardEl = el('div', { class: 'blk-board' });
    const cells = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const cell = el('div', { class: 'blk-cell', dataset: { r: String(r), c: String(c) } });
      cell.addEventListener('click', () => onCellTap(r, c));
      cell.addEventListener('pointerenter', () => { if (selected >= 0) hoverPreview(r, c); });
      boardEl.appendChild(cell); cells.push(cell);
    }
    const trayEl = el('div', { class: 'blk-tray' });
    const play2 = el('div', { class: 'blk-play' }, [boardEl, el('div', { class: 'blk-side' }, [qCard, trayEl])]);
    shell.area.appendChild(play2);
    const collector = createTrickyCollector(shell.area);

    nextQuestion();
    renderTray();
    renderBoard();

    // First-ever open shows the guided intro (C1); the round waits behind it.
    if (!introSeen('blocks')) runIntro('blocks', { steps: BLOCKS_INTRO });

    // Test hook (invisible in play): lets headless QA drive a full round.
    if (typeof window !== 'undefined') window.__blocks = {
      board: () => board.map(r => r.slice()),
      tray: () => tray.map(p => (p ? p.cells : null)),
      fits: (cellsArr, r, c) => fits(cellsArr, r, c),
      place: (slot, r, c) => tryPlace(slot, r, c),
      answer: (i) => { const nodes = qCard.querySelectorAll('.blk-opt'); if (nodes[i]) onAnswer(i, nodes[i]); },
      question: () => question,
      waiting: () => waitingSpace,
      ended: () => ended,
      hearts: () => shell.heartsLeft(),
      stats: () => ({ correct, wrong, lines, placed, hintsUsed }),
      // RUN5 C1 QA hooks: rig a known piece, resolve the lifted-centre anchor,
      // and set up near-complete lines — all deterministic (no flaky mouse events).
      rig: (slot, cellsArr) => { tray[slot] = { key: 'test', cells: normShape(cellsArr), color: '#FF7AC6' }; renderTray(); },
      anchorFor: (slot, cx, cy) => { selected = slot; cacheGeom(); return anchorAt(cx, cy); },
      nearRig: (r) => { for (let c = 0; c < N - 1; c++) board[r][c] = '#FF7AC6'; renderBoard(); },
      fillRowExceptLast: (r) => { for (let c = 0; c < N - 1; c++) board[r][c] = '#FF7AC6'; renderBoard(); },
      LIFT
    };

    // ---- questions ----
    function nextQuestion() {
      question = category === AUTO ? autoQuestion(question && question.key, 3) : makeQuestion(category, level, question && question.key, 3);
      reAsked = false; locked = false;
      renderQuestion();
    }
    function renderQuestion() {
      clear(qCard);
      if (waitingSpace) {
        qCard.appendChild(el('div', { class: 'blk-wait', text: 'Place a block to earn the next! 🧩' }));
        return;
      }
      qCard.appendChild(el('div', { class: 'blk-prompt', text: question.prompt }));
      const opts = el('div', { class: 'blk-options' });
      question.options.forEach((o, i) => {
        opts.appendChild(el('button', { class: 'btn blk-opt', text: o, onclick: () => onAnswer(i, opts.children[i]) }));
      });
      qCard.appendChild(opts);
      if (question.speak) speakMaybe(question.speak);
      if (typeof window !== 'undefined') window.__booQuestion = question; // test hook (invisible)
    }
    function onAnswer(i, node) {
      if (locked || waitingSpace) return;
      if (i === question.correct) {
        locked = true; sfx.correct(); correct++; streak++;
        recordResult(question.key, true);
        node.classList.add('right');
        dispensePiece();
        if (streak > 0 && streak % 3 === 0) dispensePiece(FIVE_LINE, true); // bonus five-line
        setTimeout(() => { if (!ended) afterDispense(); }, 260);
      } else {
        wrong++; streak = 0; sfx.oops();
        recordResult(question.key, false);
        collector.add(choiceMiss({ id: question.key, game: 'blocks', prompt: question.prompt, options: question.options, answer: question.options[question.correct] }));
        wobble(node); node.classList.add('wrongflash');
        setTimeout(() => node.classList.remove('wrongflash'), 420);
        const left = shell.dimHeart();
        if (!reAsked) { reAsked = true; shell.react(guideLine('oops'), { voice: false, hold: 1800 }); }
        else { nextQuestion(); } // re-asked once, now swap
      }
    }
    function afterDispense() {
      if (tray.every(t => t)) { waitingSpace = true; renderQuestion(); }
      else nextQuestion();
    }

    function drawKey() {
      if (!bag.length) { bag.push(...BAG_KEYS); shuffle(bag); }
      return bag.pop();
    }
    function dispensePiece(forceCells, bonus) {
      const idx = tray.findIndex(t => !t);
      if (idx < 0) return; // full (shouldn't happen; guarded by waitingSpace)
      const key = forceCells ? 'five' : drawKey();
      const shapeCells = normShape(forceCells || SHAPES[key]);
      tray[idx] = { key, cells: shapeCells, color: bonus ? '#FFD166' : PIECE_COLORS[rand(PIECE_COLORS.length)], bonus: !!bonus };
      renderTray();
    }

    // ---- tray ----
    function renderTray() {
      clear(trayEl);
      tray.forEach((p, i) => {
        const slot = el('div', { class: 'blk-slot' + (selected === i ? ' sel' : '') + (p ? '' : ' empty') });
        if (p) {
          slot.appendChild(el('div', { class: 'blk-piece', html: pieceSVG(p) }));
          slot.addEventListener('click', () => selectPiece(i));
          makePieceDraggable(slot, i);
        }
        trayEl.appendChild(slot);
      });
      updateHintAvailability();
    }
    function selectPiece(i) {
      if (!tray[i]) return;
      sfx.tap();
      selected = (selected === i) ? -1 : i;
      renderTray(); clearPreview();
    }

    // ---- board ----
    function renderBoard() {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const cell = cells[r * N + c];
        cell.classList.toggle('filled', !!board[r][c]);
        cell.style.setProperty('--fill', board[r][c] ? board[r][c] : 'transparent');
        cell.classList.remove('valid', 'invalid', 'ghost', 'hint', 'blk-near', 'blk-gap');
      }
      // Near-complete shimmer (C1): a row or column one cell from clearing glows, so
      // the goal is visible in the board itself. Filled cells shimmer; the single gap pulses.
      for (let r = 0; r < N; r++) {
        let cnt = 0; for (let c = 0; c < N; c++) if (board[r][c]) cnt++;
        if (cnt === N - 1) for (let c = 0; c < N; c++) cells[r * N + c].classList.add(board[r][c] ? 'blk-near' : 'blk-gap');
      }
      for (let c = 0; c < N; c++) {
        let cnt = 0; for (let r = 0; r < N; r++) if (board[r][c]) cnt++;
        if (cnt === N - 1) for (let r = 0; r < N; r++) cells[r * N + c].classList.add(board[r][c] ? 'blk-near' : 'blk-gap');
      }
    }
    function fits(cells2, r, c) {
      return cells2.every(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr >= 0 && rr < N && cc >= 0 && cc < N && !board[rr][cc]; });
    }
    function hoverPreview(r, c) {
      clearPreview();
      const p = tray[selected]; if (!p) return;
      const ok = fits(p.cells, r, c);
      p.cells.forEach(([dr, dc]) => { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N) cells[rr * N + cc].classList.add(ok ? 'ghost' : 'invalid'); });
    }
    function clearPreview() { cells.forEach(c => c.classList.remove('ghost', 'invalid')); }

    function onCellTap(r, c) {
      if (selected < 0) return;
      tryPlace(selected, r, c);
    }
    function tryPlace(slotIdx, r, c) {
      const p = tray[slotIdx]; if (!p) return false;
      if (!fits(p.cells, r, c)) { sfx.oops(); return false; }
      sfx.pop();
      p.cells.forEach(([dr, dc]) => { board[r + dr][c + dc] = p.color; });
      const wasBonus = p.bonus;
      tray[slotIdx] = null; selected = -1;
      // Bonus five-lines are a free reward; only question-earned pieces count to the round limit.
      if (!wasBonus) { placed++; shell.setProgress(placed); }
      clearPreview(); renderBoard();
      clearLines();
      renderTray();
      if (waitingSpace) { waitingSpace = false; nextQuestion(); }
      checkEnd();
      return true;
    }

    function clearLines() {
      const fullRows = [], fullCols = [];
      for (let r = 0; r < N; r++) if (board[r].every(v => v)) fullRows.push(r);
      for (let c = 0; c < N; c++) { let f = true; for (let r = 0; r < N; r++) if (!board[r][c]) { f = false; break; } if (f) fullCols.push(c); }
      const total = fullRows.length + fullCols.length;
      if (!total) return;
      lines += total;
      // Harder celebration (C1): a wipe of sparkles ALONG each cleared line (staggered
      // so it reads as a sweep) plus a "+line!" flourish over the board.
      let delay = 0;
      const STEP = REDUCED ? 0 : 30;
      fullRows.forEach(r => { for (let c = 0; c < N; c++) { sparkleCell(r, c, delay); delay += STEP; } });
      fullCols.forEach(c => { for (let r = 0; r < N; r++) { sparkleCell(r, c, delay); delay += STEP; } });
      sfx.star();
      lineFlourish(total);
      shell.react(total > 1 ? 'DOUBLE clear! 🌟' : 'Line clear! ✨', { voice: false, hold: 1500 });
      fullRows.forEach(r => { for (let c = 0; c < N; c++) board[r][c] = 0; });
      fullCols.forEach(c => { for (let r = 0; r < N; r++) board[r][c] = 0; });
      setTimeout(renderBoard, REDUCED ? 60 : Math.max(240, delay + 120));
    }
    function sparkleCell(r, c, delay = 0) {
      const cell = cells[r * N + c];
      const paint = () => {
        const rr = cell.getBoundingClientRect();
        if (!REDUCED) sparkleAt(rr.left + rr.width / 2, rr.top + rr.height / 2);
        cell.classList.add('clearing'); setTimeout(() => cell.classList.remove('clearing'), 320);
      };
      if (delay > 0) setTimeout(paint, delay); else paint();
    }
    // A floating "+line!" (or "+2 lines!") flourish that pops over the board and fades.
    function lineFlourish(count) {
      const br = boardEl.getBoundingClientRect();
      const f = el('div', { class: 'blk-flourish', text: count > 1 ? `+${count} lines!` : '+line!' });
      f.style.left = (br.left + br.width / 2) + 'px';
      f.style.top = (br.top + br.height / 2) + 'px';
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 1100);
    }

    // ---- hint / no-move / end ----
    function anyLegal() {
      for (const p of tray) if (p) for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(p.cells, r, c)) return { p, r, c };
      return null;
    }
    function updateHintAvailability() {
      // hint only meaningful if there is a piece and a legal spot
      shell.enableHint(hintsUsed < 2 && tray.some(Boolean));
    }
    function doHint() {
      if (hintsUsed >= 2) return;
      const spot = anyLegal();
      if (!spot) { shell.react("Hmm, that board is snug!", { voice: false }); return; }
      hintsUsed++;
      const idx = tray.indexOf(spot.p); selected = idx; renderTray();
      spot.p.cells.forEach(([dr, dc]) => cells[(spot.r + dr) * N + (spot.c + dc)].classList.add('hint'));
      shell.react('Try here! 👇', { voice: false, hold: 2200 });
      setTimeout(() => cells.forEach(c => c.classList.remove('hint')), 2200);
      updateHintAvailability();
    }
    function checkEnd() {
      if (ended) return;
      if (placed >= END_PIECES) return finish();
      // stuck: tray has pieces but none can be placed anywhere
      if (tray.some(Boolean) && !anyLegal()) { shell.react("Board's full, brilliant building!", { voice: true, hold: 2600 }); setTimeout(finish, 1400); }
    }
    function finish() {
      if (ended) return; ended = true;
      shell.cleanup();
      const stars = starsForBlocks(correct, lines, hintsUsed);
      if (lines > 0) noteQuest('linesCleared', { count: lines });   // daily quest (RUN3 C4)
      ctx.go('results', { game: 'blocks', gameName: 'Boo Blocks', stars, level, cat: category === AUTO ? null : category, mix: category === AUTO, tricky: collector.items(), replay: () => ctx.go('blocks') });
    }

    // ---- drag a tray piece onto the board (C1 placement feel) ----
    // The piece renders LIFTED ~70px above the fingertip so the hand never hides it;
    // targeting is computed from the lifted piece's CENTRE, with a half-cell snap
    // tolerance; an invalid drop GLIDES the piece back to its tray slot (never vanishes).
    let cellGeom = null;  // cached per drag: { centres:[{x,y}], cell:size } — cells don't move mid-drag
    function cacheGeom() {
      const centres = cells.map(c => { const r = c.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      const cell = cells[0] ? cells[0].getBoundingClientRect().width : 24;
      cellGeom = { centres, cell };
    }
    function makePieceDraggable(slot, i) {
      let dragging = false, ghost = null, moved = false, sx = 0, sy = 0;
      slot.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; moved = false; dragging = true; slot.setPointerCapture(e.pointerId); });
      slot.addEventListener('pointermove', e => {
        if (!dragging) return;
        if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) {
          // Lift out of the slot WITHOUT rebuilding the tray — a renderTray() here
          // would detach this captured slot and silently break the drag.
          moved = true; selected = i; cacheGeom();
          slot.classList.add('sel', 'dragging');
          const pv = slot.querySelector('.blk-piece'); if (pv) pv.style.opacity = '0.2';
          ghost = el('div', { class: 'blk-ghost', html: pieceSVG(tray[i]) }); document.body.appendChild(ghost);
        }
        if (moved && ghost) {
          ghost.style.left = e.clientX + 'px';
          ghost.style.top = (e.clientY - LIFT) + 'px';   // float above the finger
          const a = anchorAt(e.clientX, e.clientY);
          clearPreview(); if (a) hoverPreview(a.r, a.c);
        }
      });
      slot.addEventListener('pointerup', e => {
        if (!dragging) return; dragging = false;
        slot.classList.remove('dragging');
        if (!moved) { if (ghost) { ghost.remove(); ghost = null; } return; }
        const a = anchorAt(e.clientX, e.clientY);
        if (a && fits(tray[i].cells, a.r, a.c)) {
          if (ghost) { ghost.remove(); ghost = null; }
          tryPlace(i, a.r, a.c);
        } else {
          clearPreview();
          glideBack(ghost, slot); ghost = null;   // invalid → glide back, keep the piece
        }
      });
      slot.addEventListener('pointercancel', () => { dragging = false; if (ghost) { ghost.remove(); ghost = null; } clearPreview(); renderTray(); });
    }
    // Animate the ghost back into its tray slot, then restore the tray (piece never lost).
    function glideBack(ghost, slot) {
      if (!ghost) { selected = -1; renderTray(); return; }
      sfx.oops();
      if (REDUCED) { ghost.remove(); selected = -1; renderTray(); return; }
      const sr = slot.getBoundingClientRect();
      ghost.style.transition = 'left 260ms ease, top 260ms ease, opacity 260ms ease';
      requestAnimationFrame(() => {
        ghost.style.left = (sr.left + sr.width / 2) + 'px';
        ghost.style.top = (sr.top + sr.height / 2) + 'px';
        ghost.style.opacity = '0.15';
      });
      setTimeout(() => { ghost.remove(); selected = -1; renderTray(); }, 280);
    }
    // Anchor from the LIFTED piece's CENTRE (cx, cy-LIFT): find the on-board placement
    // whose bounding-box centre is nearest, accepting within ~one cell (half-cell snap).
    function anchorAt(cx, cy) {
      const p = tray[selected]; if (!p) return null;
      if (!cellGeom) cacheGeom();
      const tx = cx, ty = cy - LIFT;
      const maxR = Math.max(...p.cells.map(x => x[0])) + 1, maxC = Math.max(...p.cells.map(x => x[1])) + 1;
      let best = null, bestD = Infinity;
      for (let r = 0; r <= N - maxR; r++) for (let c = 0; c <= N - maxC; c++) {
        const tl = cellGeom.centres[r * N + c], brc = cellGeom.centres[(r + maxR - 1) * N + (c + maxC - 1)];
        const px = (tl.x + brc.x) / 2, py = (tl.y + brc.y) / 2;
        const d = Math.hypot(px - tx, py - ty);
        if (d < bestD) { bestD = d; best = { r, c }; }
      }
      // Off the board (beyond ~one cell past the nearest slot) → no anchor (glide back).
      if (!best || bestD > cellGeom.cell * 1.3) return null;
      return best;
    }
  }

  return { unmount() { if (shell) shell.cleanup(); } };
}

export function starsForBlocks(correct, lines, hintsUsed) {
  if (hintsUsed === 0 && correct >= 10 && lines >= 5) return 3;
  if (correct >= 7 && lines >= 3) return 2;
  return 1;
}

function pieceSVG(p) {
  const maxC = Math.max(...p.cells.map(c => c[1])) + 1;
  const maxR = Math.max(...p.cells.map(c => c[0])) + 1;
  const u = 15, pad = 2;
  const w = maxC * u, h = maxR * u;
  const rects = p.cells.map(([r, c]) => `<rect x="${c * u + pad}" y="${r * u + pad}" width="${u - pad * 2}" height="${u - pad * 2}" rx="3" fill="${p.color}" stroke="#2A1B4E" stroke-width="2"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
