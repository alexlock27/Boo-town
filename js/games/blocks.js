// js/games/blocks.js — Boo Blocks (spec RUN2 C4).
// A 9x9 block puzzle where learning dispenses the pieces. Answer a question to
// dispense the next polyomino into a three-slot tray; drag pieces onto the board;
// full rows/columns clear. Round ends after 12 placed pieces or no legal move.

import { el, clear, starsRow, wobble, sparkleAt, backControl } from '../ui.js';
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

const AUTO = '__auto__';   // Light-tier arcade: no picker, Smart-Mix-driven questions (C9)

const N = 9;                 // 9x9 board
const END_PIECES = 12;       // round ends after 12 placed pieces
const TRAY = 3;              // three-slot tray
const rand = (n) => (Math.random() * n) | 0;

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
  if (arcadeHasPicker()) startCard(); else play(AUTO, 2);   // Light tier auto-starts (C9)

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    let category = s.seen.blocksCat || 'tables';
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 104 }) }),
      el('h2', { text: 'Boo Blocks' }),
      el('p', { class: 'sc-intro', text: 'Answer to earn blocks, then build! Clear rows and columns.' })
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
      onBack: () => ctx.go('hub'), onHint: doHint, hintEnabled: true
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
      stats: () => ({ correct, wrong, lines, placed, hintsUsed })
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
        cell.classList.remove('valid', 'invalid', 'ghost', 'hint');
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
      const br = boardEl.getBoundingClientRect();
      fullRows.forEach(r => { for (let c = 0; c < N; c++) sparkleCell(r, c); });
      fullCols.forEach(c => { for (let r = 0; r < N; r++) sparkleCell(r, c); });
      sfx.star();
      shell.react(total > 1 ? 'DOUBLE clear! 🌟' : 'Line clear! ✨', { voice: false, hold: 1500 });
      fullRows.forEach(r => { for (let c = 0; c < N; c++) board[r][c] = 0; });
      fullCols.forEach(c => { for (let r = 0; r < N; r++) board[r][c] = 0; });
      setTimeout(renderBoard, 180);
    }
    function sparkleCell(r, c) {
      const cell = cells[r * N + c]; const rr = cell.getBoundingClientRect();
      sparkleAt(rr.left + rr.width / 2, rr.top + rr.height / 2);
      cell.classList.add('clearing'); setTimeout(() => cell.classList.remove('clearing'), 300);
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

    // ---- drag a tray piece onto the board ----
    function makePieceDraggable(slot, i) {
      let dragging = false, ghost = null, moved = false, sx = 0, sy = 0;
      slot.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; moved = false; dragging = true; slot.setPointerCapture(e.pointerId); });
      slot.addEventListener('pointermove', e => {
        if (!dragging) return;
        if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) { moved = true; selected = i; renderTray(); ghost = el('div', { class: 'blk-ghost', html: pieceSVG(tray[i]) }); document.body.appendChild(ghost); }
        if (moved && ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; const a = anchorAt(e.clientX, e.clientY); clearPreview(); if (a) hoverPreview(a.r, a.c); }
      });
      slot.addEventListener('pointerup', e => {
        if (!dragging) return; dragging = false;
        if (ghost) { ghost.remove(); ghost = null; }
        if (moved) { const a = anchorAt(e.clientX, e.clientY); if (a) tryPlace(i, a.r, a.c); else clearPreview(); }
      });
      slot.addEventListener('pointercancel', () => { dragging = false; if (ghost) { ghost.remove(); ghost = null; } });
    }
    // The drop anchor is the top-left cell of the piece, offset so the piece sits under the finger.
    function anchorAt(cx, cy) {
      const p = tray[selected]; if (!p) return null;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const rr = cells[r * N + c].getBoundingClientRect();
        if (cx >= rr.left && cx <= rr.right && cy >= rr.top && cy <= rr.bottom) return { r, c };
      }
      return null;
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
