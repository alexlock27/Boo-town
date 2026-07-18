// js/games/blocks.js — Boo Blocks, the redesign (RUN9 C2).
// A pure SCORE-CHASE block puzzle: pieces flow freely from a fair bag into a three-slot
// tray (no question needed to receive them). Drag pieces onto an 8×8 board; fill a whole
// line — any direction — and it POPS. Simultaneous multi-line clears multiply; back-to-back
// clears build a cascade streak; clearing the whole board fires an all-clear firework.
// Learning is the POWER-UP economy: the chunky Boo Boost button (3 uses/round) poses one
// Smart-Mix question; a correct answer awards a special piece (Line Blaster → Sparkle Bomb →
// Single Square, rotating). Stars come from score bands (tuned by self-play simulation).

import { el, clear, starsRow, wobble, sparkleAt, backControl, REDUCED, suppressContextMenu, confetti } from '../ui.js';
import { getState, mutate, recordResult } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { autoQuestion } from '../questions.js';
import { noteQuest } from '../quests.js';
import { runIntro, introSeen } from '../intro.js';

const N = 8;                 // 8×8 board (RUN9 C2)
const TRAY = 3;              // three-slot tray
const PIECE_BUDGET = 60;     // a generous piece budget; a round also ends when no move fits
const BOOST_USES = 3;        // Boo Boost uses per round (C2)
const LIFT = 70;             // px the dragged piece floats ABOVE the fingertip so the hand never hides it
const SPIN_MS = 220;         // snappy quarter-turn animation length
const rand = (n) => (Math.random() * n) | 0;

// ---- scoring (named so the balance is tunable / simulatable) ----
const CELL_POINTS = 1;                       // per cell placed
const LINE_POINTS = 10;                       // base per cleared line
const ALL_CLEAR_BONUS = 100;                  // clearing the whole board
const SPECIAL_CELL_POINTS = 2;                // per cell a power-up clears
// Star score bands (RUN9 C2), tuned by simulating 400 greedy self-play rounds — see
// tests/sim-blocks.mjs and the PROGRESS.md report. 1★ is always earned for playing.
const THREE_STAR_SCORE = 320, TWO_STAR_SCORE = 150;

// RUN10 P10: the piece bag deliberately tightens as the score rises.
export const BAG_TIERS = [
  { at: 0, awkward: 0.25 },
  { at: 250, awkward: 0.45 },
  { at: 600, awkward: 0.62 }
];
const FRIENDLY_KEYS = ['single', 'domino', 'tetO'];
const AWKWARD_KEYS = ['tetS', 'tetS', 'tetT', 'corner', 'tetI'];
export function awkwardChance(score) {
  let tier = BAG_TIERS[0];
  for (const candidate of BAG_TIERS) if (score >= candidate.at) tier = candidate;
  return tier.awkward;
}

// Special power-up pieces, awarded by Boo Boost in this rotating order (C2).
const SPECIAL_ORDER = ['lineblast', 'bomb', 'single'];
const SPECIAL_NAME = { lineblast: 'Line Blaster', bomb: 'Sparkle Bomb', single: 'Single Square' };

// The Blocks intro (RUN9 C2): teaches the score chase and the Boost.
const BLOCKS_INTRO = [
  { text: 'Drop blocks to fill lines. Complete a line and it POPS for points!', demo: blocksDemoLine },
  { text: 'Clear lines back-to-back for a streak — clear it ALL for a firework!' },
  { text: 'When it gets squeezy, Boo Boost wins a rescue piece!', demo: blocksSqueezeDemo }
];

// A little self-completing demo line for intro step 1: fills cell by cell, then pops.
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

// Deterministic miniature of the mid-round squeeze and its rescue loop.
function blocksSqueezeDemo(area) {
  const demo = el('div', { class: 'blk-squeeze-demo' });
  const grid = el('div', { class: 'blk-demo-grid' });
  const cells = [];
  for (let i = 0; i < 25; i++) {
    const cell = el('i', { class: 'blk-demo-square' });
    cells.push(cell);
    grid.appendChild(cell);
  }
  const boost = el('div', { class: 'blk-demo-boost', text: '⚡ Boo Boost' });
  const question = el('div', { class: 'blk-demo-question', text: '3 + 2 = 5  ✓' });
  demo.append(grid, boost, question);
  area.appendChild(demo);
  let timers = [], alive = true;
  const later = (fn, ms) => timers.push(setTimeout(() => alive && fn(), ms));
  function run() {
    cells.forEach(c => c.className = 'blk-demo-square');
    boost.classList.remove('squeeze');
    question.classList.remove('show');
    cells.slice(0, 18).forEach((cell, i) => later(() => cell.classList.add('on'), i * 35));
    later(() => boost.classList.add('squeeze'), 720);
    later(() => question.classList.add('show'), 1250);
    later(() => {
      cells.slice(10, 15).forEach(cell => cell.classList.add('beam'));
      cells.slice(10, 15).forEach(cell => cell.classList.remove('on'));
    }, 1950);
    later(run, 3200);
  }
  run();
  return () => { alive = false; timers.forEach(clearTimeout); };
}

// Fair bag of piece shapes (cells as [row, col] offsets). Pieces spin a quarter-turn.
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
const PIECE_COLORS = ['#FF7AC6', '#35D0BA', '#8FC7FF', '#C6A9F0', '#FFC93C', '#7FD8C3'];

function normShape(cells) {
  const minR = Math.min(...cells.map(c => c[0])), minC = Math.min(...cells.map(c => c[1]));
  return cells.map(([r, c]) => [r - minR, c - minC]);
}
function rotateCells(cells) {
  const maxR = Math.max(...cells.map(c => c[0])) + 1;
  return normShape(cells.map(([r, c]) => [c, maxR - 1 - r]));
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen blocks' });
  container.appendChild(root);
  let shell = null;
  const rz = params && params.resume;
  // The redesign is a pure puzzle — no category/level. Any resume just starts a round.
  if (rz) play();
  else startCard();
  if (!introSeen('blocks')) runIntro('blocks', { steps: BLOCKS_INTRO });

  function bestScore() { return (getState().seen && getState().seen.blocksBestScore) || 0; }

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    const best = bestScore();
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 104 }) }),
      el('h2', { text: 'Boo Blocks' }),
      el('p', { class: 'sc-intro', text: 'Fill lines, pop them, chase a big score!' }),
      el('div', { class: 'blk-best-card' }, [
        el('span', { class: 'blk-best-star', text: '⭐' }),
        el('span', { text: best > 0 ? `Your best score: ${best}` : 'Play to set your first best score!' })
      ]),
      el('button', { class: 'btn big', text: '▶ Play', onclick: () => { sfx.tap(); play(); } })
    ]);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: `Three stars: score ${THREE_STAR_SCORE}+. Two stars: ${TWO_STAR_SCORE}+.` })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
  }

  function play() {
    clear(root);
    music.play('game');

    const board = Array.from({ length: N }, () => Array(N).fill(0));
    let tray = [null, null, null];
    const recentKeys = [];
    let score = 0, lines = 0, placed = 0, cascade = 0, ended = false;
    let boostsLeft = BOOST_USES, boostAwardIdx = 0, boostRetryUsed = false, boostOpen = false;
    let hintsUsed = 0;
    let selected = -1, spinNext = -1;
    let squeezeActive = false, squeezeTaught = false, previousFill = 0;
    const best0 = bestScore();

    shell = createGameShell({
      title: 'Boo Blocks', accent: 'var(--zing)', hideHearts: true, hideProgress: true,
      onBack: () => ctx.go('hub'), onHint: doHint, hintEnabled: true,
      onHelp: () => runIntro('blocks', { steps: BLOCKS_INTRO })
    });
    root.appendChild(shell.root);

    // ---- layout ----
    const scoreEl = el('div', { class: 'blk-score' }, [
      el('span', { class: 'blk-score-num', text: '0' }),
      el('span', { class: 'blk-score-lbl', text: 'score' })
    ]);
    const bestEl = el('div', { class: 'blk-bestchip', text: best0 > 0 ? `best ${best0}` : '' });
    const cascadeEl = el('div', { class: 'blk-cascade' });
    const boostBtn = el('button', { class: 'btn blk-boost', onclick: () => openBoost() });
    const boostLbl = () => `⚡ Boo Boost · ${boostsLeft} left`;
    const refreshBoost = () => { boostBtn.textContent = boostLbl(); boostBtn.disabled = boostsLeft <= 0 || boostOpen; };
    boostBtn.textContent = boostLbl();

    const boardEl = el('div', { class: 'blk-board' });
    const cells = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const cell = el('div', { class: 'blk-cell', dataset: { r: String(r), c: String(c) } });
      cell.addEventListener('click', () => onCellTap(r, c));
      cell.addEventListener('pointerenter', () => { if (selected >= 0) hoverPreview(r, c); });
      boardEl.appendChild(cell); cells.push(cell);
    }
    const trayEl = el('div', { class: 'blk-tray' });
    const side = el('div', { class: 'blk-side' }, [
      el('div', { class: 'blk-scorewrap' }, [scoreEl, bestEl, cascadeEl]),
      boostBtn, trayEl
    ]);
    const play2 = el('div', { class: 'blk-play' }, [boardEl, side]);
    shell.area.appendChild(play2);

    fillTray();
    renderTray();
    renderBoard();

    if (typeof window !== 'undefined') window.__blocks = {
      board: () => board.map(r => r.slice()),
      tray: () => tray.map(p => (p ? { cells: p.cells, special: p.special || null, orient: p.orient || null } : null)),
      fits: (cellsArr, r, c) => fits({ cells: cellsArr }, r, c),
      place: (slot, r, c) => tryPlace(slot, r, c),
      score: () => score,
      lines: () => lines,
      cascade: () => cascade,
      placed: () => placed,
      ended: () => ended,
      stats: () => ({ score, lines, placed, cascade, boostsLeft, hintsUsed }),
      // rig a known piece into a slot (deterministic QA)
      rig: (slot, cellsArr, opts) => { tray[slot] = Object.assign({ key: 'test', cells: normShape(cellsArr), color: '#FF7AC6' }, opts || {}); renderTray(); },
      rigSpecial: (slot, special) => { tray[slot] = makeSpecial(special); renderTray(); },
      fillRowExceptLast: (r) => { for (let c = 0; c < N - 1; c++) board[r][c] = '#FF7AC6'; renderBoard(); },
      fillBoardExcept: (skip) => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) board[r][c] = (skip && skip.some(([rr, cc]) => rr === r && cc === c)) ? 0 : '#8FC7FF'; renderBoard(); },
      clearBoard: () => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) board[r][c] = 0; renderBoard(); },
      resetForTest: () => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) board[r][c] = 0; score = 0; lines = 0; cascade = 0; placed = 0; renderBoard(); updateScore(); renderCascade(); },
      select: (i) => selectPiece(i),
      rotate: () => rotateSelected(),
      rotateSlot: (i) => { selected = i; rotateSelected(); },
      selectedSlot: () => selected,
      anchorFor: (slot, cx, cy) => { selected = slot; cacheGeom(); return anchorAt(cx, cy); },
      // Boost QA hooks
      boost: () => openBoost(),
      boostOpen: () => boostOpen,
      boostAnswer: (i) => { const nodes = root.querySelectorAll('.blk-boost-opt'); if (nodes[i]) onBoostAnswer(i, nodes[i]); },
      boostQuestion: () => boostQuestion,
      boostsLeft: () => boostsLeft,
      nextSpecial: () => SPECIAL_ORDER[boostAwardIdx % SPECIAL_ORDER.length],
      fill: () => board.flat().filter(Boolean).length / (N * N),
      squeeze: () => squeezeActive,
      forceFill: (count) => {
        let left = Math.max(0, Math.min(N * N, count));
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) board[r][c] = left-- > 0 ? '#8FC7FF' : 0;
        renderBoard();
      },
      drawSamples: (count, forcedScore = score) => {
        const before = score;
        score = forcedScore;
        const out = Array.from({ length: count }, () => drawKey());
        score = before;
        return out;
      },
      bagTiers: () => BAG_TIERS.map(x => ({ ...x })),
      LIFT, N
    };

    // ---- the bag / tray ----
    function drawKey() {
      const source = Math.random() < awkwardChance(score) ? AWKWARD_KEYS : FRIENDLY_KEYS;
      let key = source[rand(source.length)];
      if (recentKeys.length >= 2 && recentKeys.at(-1) === key && recentKeys.at(-2) === key) {
        const alternatives = source.filter(candidate => candidate !== key);
        key = alternatives[rand(alternatives.length)] || (key === 'single' ? 'domino' : 'single');
      }
      recentKeys.push(key);
      if (recentKeys.length > 2) recentKeys.shift();
      return key;
    }
    function newPiece() {
      const key = drawKey();
      return { key, cells: normShape(SHAPES[key]), color: PIECE_COLORS[rand(PIECE_COLORS.length)] };
    }
    // Classic flow: keep the tray topped up; when all three are gone, deal three fresh
    // pieces at once (planning tension, no questions required).
    function fillTray() {
      if (tray.every(t => !t)) for (let i = 0; i < TRAY; i++) tray[i] = newPiece();
    }
    function makeSpecial(special) {
      return { key: 'sp_' + special, cells: [[0, 0]], color: '#FFD166', special, orient: 'row' };
    }

    function renderTray() {
      clear(trayEl);
      tray.forEach((p, i) => {
        const slot = el('div', { class: 'blk-slot' + (selected === i ? ' sel' : '') + (p ? '' : ' empty') + (p && p.special ? ' special' : '') });
        if (p) {
          const piece = el('div', { class: 'blk-piece' + (spinNext === i && !REDUCED ? ' blk-spin' : ''), html: pieceSVG(p) });
          if (spinNext === i && !REDUCED) piece.style.setProperty('--spin-ms', SPIN_MS + 'ms');
          slot.appendChild(piece);
          if (p.special) slot.appendChild(el('span', { class: 'blk-sp-name', text: SPECIAL_NAME[p.special] }));
          slot.addEventListener('click', () => selectPiece(i));
          makePieceDraggable(slot, i);
          if (selected === i && canRotate(p)) {
            const badge = el('button', { class: 'blk-rotate no-callout', 'aria-label': 'Spin this piece',
              html: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M5 12a7 7 0 1 1 2 4.9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M4 8v4h4" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' });
            badge.addEventListener('pointerdown', e => e.stopPropagation());
            badge.addEventListener('click', e => { e.stopPropagation(); rotateSelected(); });
            suppressContextMenu(badge);
            slot.appendChild(badge);
          }
        }
        trayEl.appendChild(slot);
      });
      spinNext = -1;
      updateHintAvailability();
    }
    function canRotate(p) { return p && (p.special === 'lineblast' || (!p.special && p.cells.length > 1)); }
    function selectPiece(i) {
      if (!tray[i]) return;
      if (selected === i) { rotateSelected(); return; }
      sfx.tap(); selected = i; renderTray(); clearPreview();
    }
    function rotateSelected() {
      const p = tray[selected]; if (!p) return;
      sfx.tap();
      if (p.special === 'lineblast') p.orient = p.orient === 'row' ? 'col' : 'row';
      else if (!p.special) p.cells = rotateCells(p.cells);
      spinNext = selected;
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
      for (let r = 0; r < N; r++) {
        let cnt = 0; for (let c = 0; c < N; c++) if (board[r][c]) cnt++;
        if (cnt === N - 1) for (let c = 0; c < N; c++) cells[r * N + c].classList.add(board[r][c] ? 'blk-near' : 'blk-gap');
      }
      for (let c = 0; c < N; c++) {
        let cnt = 0; for (let r = 0; r < N; r++) if (board[r][c]) cnt++;
        if (cnt === N - 1) for (let r = 0; r < N; r++) cells[r * N + c].classList.add(board[r][c] ? 'blk-near' : 'blk-gap');
      }
      updatePressure();
    }
    function updatePressure() {
      const fill = board.flat().filter(Boolean).length / (N * N);
      if (!squeezeActive && previousFill < 0.70 && fill >= 0.70) {
        squeezeActive = true;
        if (!squeezeTaught) {
          squeezeTaught = true;
          const line = guideLine('L_BLOCKS_SQUEEZE') || 'Squeezy! Want a quick question for a Line Blaster?';
          shell.react(line, { voice: true, hold: 3200 });
        }
      } else if (squeezeActive && fill < 0.62) {
        squeezeActive = false;
      }
      previousFill = fill;
      boostBtn.classList.toggle('squeeze', squeezeActive);
    }
    function fits(p, r, c) {
      if (p.special === 'lineblast' || p.special === 'bomb') return r >= 0 && r < N && c >= 0 && c < N;   // blasts drop on any cell
      return p.cells.every(([dr, dc]) => { const rr = r + dr, cc = c + dc; return rr >= 0 && rr < N && cc >= 0 && cc < N && !board[rr][cc]; });
    }
    function hoverPreview(r, c) {
      clearPreview();
      const p = tray[selected]; if (!p) return;
      if (p.special === 'lineblast') {
        const ok = true;
        if (p.orient === 'row') { for (let cc = 0; cc < N; cc++) cells[r * N + cc].classList.add('ghost'); }
        else { for (let rr = 0; rr < N; rr++) cells[rr * N + c].classList.add('ghost'); }
        return;
      }
      if (p.special === 'bomb') {
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N) cells[rr * N + cc].classList.add('ghost'); }
        return;
      }
      const ok = fits(p, r, c);
      p.cells.forEach(([dr, dc]) => { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N) cells[rr * N + cc].classList.add(ok ? 'ghost' : 'invalid'); });
    }
    function clearPreview() { cells.forEach(c => c.classList.remove('ghost', 'invalid')); }

    function onCellTap(r, c) { if (selected < 0) return; tryPlace(selected, r, c); }

    function tryPlace(slotIdx, r, c) {
      const p = tray[slotIdx]; if (!p) return false;
      if (!fits(p, r, c)) { sfx.oops(); return false; }
      if (p.special === 'lineblast') return placeLineBlast(slotIdx, r, c);
      if (p.special === 'bomb') return placeBomb(slotIdx, r, c);
      // normal (incl. Single Square) placement
      sfx.pop();
      p.cells.forEach(([dr, dc]) => { board[r + dr][c + dc] = p.color; });
      score += p.cells.length * CELL_POINTS;
      tray[slotIdx] = null; selected = -1;
      placed++;
      clearPreview(); renderBoard();
      clearLines();
      afterPlace();
      return true;
    }
    function placeLineBlast(slotIdx, r, c) {
      const cellsToClear = [];
      const orient = tray[slotIdx].orient;
      if (orient === 'row') { for (let cc = 0; cc < N; cc++) if (board[r][cc]) cellsToClear.push([r, cc]); }
      else { for (let rr = 0; rr < N; rr++) if (board[rr][c]) cellsToClear.push([rr, c]); }
      consumeSpecial(slotIdx);
      fireBeam(orient, r, c);
      lines += 1; noteBlast(cellsToClear, '⚡ ZAP!');
      afterPlace();
      return true;
    }
    function placeBomb(slotIdx, r, c) {
      const cellsToClear = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < N && cc >= 0 && cc < N && board[rr][cc]) cellsToClear.push([rr, cc]); }
      consumeSpecial(slotIdx);
      fireBomb(r, c);
      noteBlast(cellsToClear, '💥 BOOM!');
      afterPlace();
      return true;
    }
    function consumeSpecial(slotIdx) { tray[slotIdx] = null; selected = -1; placed++; clearPreview(); }
    function noteBlast(cellList, label) {
      sfx.star();
      let delay = 0; const STEP = REDUCED ? 0 : 24;
      cellList.forEach(([r, c]) => { sparkleCell(r, c, delay); delay += STEP; board[r][c] = 0; });
      score += cellList.length * SPECIAL_CELL_POINTS;
      updateScore();
      lineFlourish(0, label);
      setTimeout(() => { renderBoard(); checkAllClear(); }, REDUCED ? 40 : Math.max(200, delay + 100));
      shell.react(label, { voice: false, hold: 1300 });
    }
    function fireBeam(orient, r, c) {
      const beam = el('div', { class: `blk-beam ${orient}` });
      if (orient === 'row') beam.style.top = `${(r + .5) * 12.5}%`;
      else beam.style.left = `${(c + .5) * 12.5}%`;
      boardEl.appendChild(beam);
      setTimeout(() => beam.remove(), REDUCED ? 120 : 280);
    }
    function fireBomb(r, c) {
      const burst = el('div', { class: 'blk-kapow', text: 'KA-POP!' });
      burst.style.left = `${(c + .5) * 12.5}%`;
      burst.style.top = `${(r + .5) * 12.5}%`;
      boardEl.appendChild(burst);
      boardEl.classList.add(REDUCED ? 'blast-flash' : 'blast-shake');
      setTimeout(() => {
        burst.remove();
        boardEl.classList.remove('blast-shake', 'blast-flash');
      }, REDUCED ? 180 : 360);
    }

    function afterPlace() {
      fillTray();
      renderTray();
      updateScore();
      if (checkEnd()) return;
    }

    function clearLines() {
      const fullRows = [], fullCols = [];
      for (let r = 0; r < N; r++) if (board[r].every(v => v)) fullRows.push(r);
      for (let c = 0; c < N; c++) { let f = true; for (let r = 0; r < N; r++) if (!board[r][c]) { f = false; break; } if (f) fullCols.push(c); }
      const total = fullRows.length + fullCols.length;
      if (!total) { cascade = 0; renderCascade(); return; }
      lines += total;
      cascade++;   // back-to-back clears build the streak
      // score: base per line, multiplied by simultaneous count and the cascade streak
      const cascadeMult = 1 + 0.5 * (cascade - 1);
      // simultaneous multiply (total×total) then the back-to-back cascade streak
      score += Math.round(LINE_POINTS * total * total * cascadeMult);
      updateScore();
      // escalating sparkle sweep along each cleared line
      let delay = 0; const STEP = REDUCED ? 0 : (cascade > 2 ? 18 : 30);
      fullRows.forEach(r => { for (let c = 0; c < N; c++) { sparkleCell(r, c, delay); delay += STEP; } });
      fullCols.forEach(c => { for (let r = 0; r < N; r++) { sparkleCell(r, c, delay); delay += STEP; } });
      sfx.star();
      lineFlourish(total, cascade > 1 ? `Streak ×${cascade}! ` + (total > 1 ? `+${total} lines` : '+line') : (total > 1 ? `+${total} lines!` : '+line!'));
      shell.react(cascade > 1 ? `Streak ×${cascade}! 🌟` : (total > 1 ? 'DOUBLE clear! 🌟' : 'Line clear! ✨'), { voice: false, hold: 1500 });
      renderCascade();
      fullRows.forEach(r => { for (let c = 0; c < N; c++) board[r][c] = 0; });
      fullCols.forEach(c => { for (let r = 0; r < N; r++) board[r][c] = 0; });
      setTimeout(() => { renderBoard(); checkAllClear(); }, REDUCED ? 60 : Math.max(240, delay + 120));
    }
    function checkAllClear() {
      let empty = true;
      for (let r = 0; r < N && empty; r++) for (let c = 0; c < N; c++) if (board[r][c]) { empty = false; break; }
      if (!empty) return;
      score += ALL_CLEAR_BONUS; updateScore();
      shell.react('ALL CLEAR! 🎆', { voice: true, hold: 2200 });
      lineFlourish(0, `ALL CLEAR! +${ALL_CLEAR_BONUS}`);
      if (!REDUCED) { const b = boardEl.getBoundingClientRect(); confetti({ count: 60, power: 1.1, origin: { x: b.left + b.width / 2, y: b.top + b.height / 2 } }); }
      sfx.fanfare && sfx.fanfare();
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
    function lineFlourish(count, label) {
      const br = boardEl.getBoundingClientRect();
      const f = el('div', { class: 'blk-flourish', text: label || (count > 1 ? `+${count} lines!` : '+line!') });
      f.style.left = (br.left + br.width / 2) + 'px';
      f.style.top = (br.top + br.height / 2) + 'px';
      document.body.appendChild(f);
      setTimeout(() => f.remove(), 1100);
    }
    function updateScore() {
      scoreEl.querySelector('.blk-score-num').textContent = String(score);
      if (score > best0) bestEl.textContent = `NEW BEST ${score}! ⭐`;
    }
    function renderCascade() {
      cascadeEl.textContent = cascade > 1 ? `🔥 Streak ×${cascade}` : '';
      cascadeEl.classList.toggle('hot', cascade > 2);
    }

    // ---- Boo Boost: the learning power-up economy (C2) ----
    let boostQuestion = null, boostOverlay = null;
    function openBoost() {
      if (boostOpen || boostsLeft <= 0 || ended) return;
      boostOpen = true; refreshBoost();
      boostRetryUsed = false;
      boostQuestion = autoQuestion(null, 3);   // Smart-Mix, ledger-driven difficulty
      renderBoostModal();
    }
    function renderBoostModal() {
      if (boostOverlay) boostOverlay.remove();
      const next = SPECIAL_ORDER[boostAwardIdx % SPECIAL_ORDER.length];
      const card = el('div', { class: 'blk-boost-card card' }, [
        el('div', { class: 'blk-boost-head', text: `⚡ Boo Boost — win a ${SPECIAL_NAME[next]}!` }),
        el('div', { class: 'blk-boost-prompt', text: boostQuestion.prompt })
      ]);
      const opts = el('div', { class: 'blk-boost-opts' });
      boostQuestion.options.forEach((o, i) => opts.appendChild(el('button', { class: 'btn blk-boost-opt', text: o, onclick: () => onBoostAnswer(i, opts.children[i]) })));
      card.appendChild(opts);
      card.appendChild(el('button', { class: 'btn soft blk-boost-skip', text: 'Not now', onclick: () => closeBoost(false) }));
      boostOverlay = el('div', { class: 'blk-boost-overlay tray-card' }, [card]);
      root.appendChild(boostOverlay);
      if (boostQuestion.speak) speakMaybe(boostQuestion.speak);
    }
    function onBoostAnswer(i, node) {
      if (!boostQuestion) return;
      if (i === boostQuestion.correct) {
        sfx.correct(); recordResult(boostQuestion.key, true);   // logs to the ledger like any answer (C2)
        node.classList.add('right');
        awardSpecial();
        boostsLeft--;                                            // consumed only on a correct answer
        setTimeout(() => closeBoost(true), 420);
      } else {
        sfx.oops(); recordResult(boostQuestion.key, false);
        wobble(node); node.classList.add('wrongflash');
        setTimeout(() => node.classList.remove('wrongflash'), 420);
        if (!boostRetryUsed) { boostRetryUsed = true; shell.react(guideLine('oops'), { voice: false, hold: 1600 }); }
        else { shell.react('No worries — your Boost is safe!', { voice: false, hold: 1600 }); closeBoost(false); }   // not consumed
      }
    }
    function awardSpecial() {
      const special = SPECIAL_ORDER[boostAwardIdx % SPECIAL_ORDER.length];
      boostAwardIdx++;
      // drop the special into the first free slot, or replace slot 0 if the tray is full
      let idx = tray.findIndex(t => !t);
      if (idx < 0) idx = 0;
      tray[idx] = makeSpecial(special);
      renderTray();
      sfx.fanfare();
      shell.react(`You won a ${SPECIAL_NAME[special]}! ✨`, { voice: false, hold: 1800 });
    }
    function closeBoost(won) {
      boostOpen = false; boostQuestion = null;
      if (boostOverlay) {
        const old = boostOverlay;
        old.classList.add('away');
        setTimeout(() => old.remove(), REDUCED ? 0 : 200);
        boostOverlay = null;
      }
      refreshBoost();
    }

    // ---- hint / no-move / end ----
    function anyLegal() {
      for (const p of tray) if (p) {
        if (p.special === 'lineblast' || p.special === 'bomb') return { p, r: 0, c: 0 };  // blasts always place
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (fits(p, r, c)) return { p, r, c };
      }
      return null;
    }
    function updateHintAvailability() { shell.enableHint(hintsUsed < 3 && tray.some(Boolean)); }
    function doHint() {
      if (hintsUsed >= 3) return;
      const spot = anyLegal();
      if (!spot) { shell.react("Hmm, that board is snug! Try a Boost ⚡", { voice: false }); return; }
      hintsUsed++;
      const idx = tray.indexOf(spot.p); selected = idx; renderTray();
      if (!spot.p.special) spot.p.cells.forEach(([dr, dc]) => cells[(spot.r + dr) * N + (spot.c + dc)].classList.add('hint'));
      shell.react('Try here! 👇', { voice: false, hold: 2200 });
      setTimeout(() => cells.forEach(c => c.classList.remove('hint')), 2200);
      updateHintAvailability();
    }
    function checkEnd() {
      if (ended) return false;
      if (placed >= PIECE_BUDGET) { finish('Great building — budget done!'); return true; }
      // stuck: pieces remain but none fit AND no Boost left to rescue with a blast
      if (tray.some(Boolean) && !anyLegal() && boostsLeft <= 0) {
        shell.react("Board's full, brilliant building!", { voice: true, hold: 2600 });
        setTimeout(() => finish("Board's full, brilliant building!"), 1400); return true;
      }
      return false;
    }
    function finish() {
      if (ended) return; ended = true;
      shell.cleanup();
      const stars = starsForBlocks(score);
      if (lines > 0) noteQuest('linesCleared', { count: lines });
      const beat = score > best0;
      if (score > (getState().seen.blocksBestScore || 0)) mutate(s => { s.seen.blocksBestScore = score; });
      const go = () => ctx.go('results', { game: 'blocks', gameName: 'Boo Blocks', stars, level: null, cat: null, mix: true, replay: () => ctx.go('blocks'), score });
      if (beat && !REDUCED) {
        const ov = el('div', { class: 'blk-boost-overlay' }, [el('div', { class: 'blk-best-burst card' }, [el('div', { class: 'bbb-star', text: '⭐' }), el('h2', { text: 'New best score!' }), el('p', { text: String(score) })])]);
        root.appendChild(ov); confetti({ count: 70, power: 1.1 });
        setTimeout(go, 1700);
      } else go();
    }

    // ---- drag a tray piece onto the board ----
    let cellGeom = null;
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
          moved = true; selected = i; cacheGeom();
          slot.classList.add('sel', 'dragging');
          const pv = slot.querySelector('.blk-piece'); if (pv) pv.style.opacity = '0.2';
          ghost = el('div', { class: 'blk-ghost', html: pieceSVG(tray[i]) }); document.body.appendChild(ghost);
        }
        if (moved && ghost) {
          ghost.style.left = e.clientX + 'px';
          ghost.style.top = (e.clientY - LIFT) + 'px';
          const a = anchorAt(e.clientX, e.clientY);
          clearPreview(); if (a) hoverPreview(a.r, a.c);
        }
      });
      slot.addEventListener('pointerup', e => {
        if (!dragging) return; dragging = false;
        slot.classList.remove('dragging');
        if (!moved) { if (ghost) { ghost.remove(); ghost = null; } return; }
        const a = anchorAt(e.clientX, e.clientY);
        if (a && tray[i] && fits(tray[i], a.r, a.c)) { if (ghost) { ghost.remove(); ghost = null; } tryPlace(i, a.r, a.c); }
        else { clearPreview(); glideBack(ghost, slot); ghost = null; }
      });
      slot.addEventListener('pointercancel', () => { dragging = false; if (ghost) { ghost.remove(); ghost = null; } clearPreview(); renderTray(); });
    }
    function glideBack(ghost, slot) {
      if (!ghost) { selected = -1; renderTray(); return; }
      sfx.oops();
      if (REDUCED) { ghost.remove(); selected = -1; renderTray(); return; }
      const sr = slot.getBoundingClientRect();
      ghost.style.transition = 'left 260ms ease, top 260ms ease, opacity 260ms ease';
      requestAnimationFrame(() => { ghost.style.left = (sr.left + sr.width / 2) + 'px'; ghost.style.top = (sr.top + sr.height / 2) + 'px'; ghost.style.opacity = '0.15'; });
      setTimeout(() => { ghost.remove(); selected = -1; renderTray(); }, 280);
    }
    function anchorAt(cx, cy) {
      const p = tray[selected]; if (!p) return null;
      if (!cellGeom) cacheGeom();
      const tx = cx, ty = cy - LIFT;
      // blasts anchor on the single nearest cell
      const maxR = p.special ? 1 : Math.max(...p.cells.map(x => x[0])) + 1;
      const maxC = p.special ? 1 : Math.max(...p.cells.map(x => x[1])) + 1;
      let best = null, bestD = Infinity;
      for (let r = 0; r <= N - maxR; r++) for (let c = 0; c <= N - maxC; c++) {
        const tl = cellGeom.centres[r * N + c], brc = cellGeom.centres[(r + maxR - 1) * N + (c + maxC - 1)];
        const px = (tl.x + brc.x) / 2, py = (tl.y + brc.y) / 2;
        const d = Math.hypot(px - tx, py - ty);
        if (d < bestD) { bestD = d; best = { r, c }; }
      }
      if (!best || bestD > cellGeom.cell * 1.3) return null;
      return best;
    }
  }

  return { unmount() { if (shell) shell.cleanup(); } };
}

export function starsForBlocks(score) {
  if (score >= THREE_STAR_SCORE) return 3;
  if (score >= TWO_STAR_SCORE) return 2;
  return 1;
}

function pieceSVG(p) {
  if (p.special === 'lineblast') {
    const horiz = p.orient !== 'col';
    const arrow = horiz
      ? '<path d="M3 15h24M22 10l6 5-6 5" fill="none" stroke="#2A1B4E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
      : '<path d="M15 3v24M10 22l5 6 5-6" fill="none" stroke="#2A1B4E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    return `<svg viewBox="0 0 30 30" width="34" height="34"><rect x="2" y="2" width="26" height="26" rx="7" fill="#FFD166" stroke="#2A1B4E" stroke-width="2.4"/>${arrow}</svg>`;
  }
  if (p.special === 'bomb') {
    return `<svg viewBox="0 0 30 30" width="34" height="34"><rect x="2" y="2" width="26" height="26" rx="7" fill="#FF7AC6" stroke="#2A1B4E" stroke-width="2.4"/><circle cx="15" cy="16" r="7" fill="#FFD166" stroke="#2A1B4E" stroke-width="2"/><path d="M15 9l1.6 3.4 3.4-.4-2.3 2.6 1 3.4-3.7-2-3.7 2 1-3.4-2.3-2.6 3.4.4z" fill="#FF7AC6"/></svg>`;
  }
  const maxC = Math.max(...p.cells.map(c => c[1])) + 1;
  const maxR = Math.max(...p.cells.map(c => c[0])) + 1;
  const u = 15, pad = 2;
  const w = maxC * u, h = maxR * u;
  const rects = p.cells.map(([r, c]) => `<rect x="${c * u + pad}" y="${r * u + pad}" width="${u - pad * 2}" height="${u - pad * 2}" rx="3" fill="${p.color}" stroke="#2A1B4E" stroke-width="2"/>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
