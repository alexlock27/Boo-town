// js/games/boopop.js — Boo Pop (RUN4 C7): a gentle match-and-pop puzzle.
// A 7x7 board of candy-style gems with big numerals. Swap two adjacent gems by
// drag or two taps; any adjacent pair satisfying the round's rule pops with a
// sparkle, gems fall, new ones drop in, cascades chain. Moves-based (20), no
// timer ever. Kindness engineering: every board has a valid pair; if cascades
// leave none, a cheerful free sparkle-shuffle rearranges; a soft glow hints
// after 6 idle seconds (free); the manual hint counts as a hint (caps at 2★).

import { el, clear, starsRow, wobble, sparkleAt, REDUCED, backControl } from '../ui.js';
import { getState, mutate } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { recordBest, pickForMeButton } from '../picker.js';
import { contentTier } from '../content.js';

// Named constants (C7 — all tunable).
export const N = 7;                 // 7x7 board
export const MOVES = 20;            // moves per round, no timer ever
export const POPS_3STAR = 12;       // 3★: 12+ pops, no manual hints
export const POPS_2STAR = 8;        // 2★: 8+ pops
export const IDLE_HINT_MS = 6000;   // free soft glow after 6 idle seconds
export const TWIN_COSY_AFTER = 3;   // Twin Pop is cosy after the 3rd lifetime round

const rand = (n) => (Math.random() * n) | 0;

// ---- the level rules ---------------------------------------------------------
// Fraction Friends equivalence families (exactly per C7).
const FRACTION_FAMILIES = [['1/2', '2/4', '3/6'], ['1/4', '2/8'], ['3/4', '6/8']];
const FRACTION_CLASS = {};
FRACTION_FAMILIES.forEach((fam, i) => fam.forEach(f => { FRACTION_CLASS[f] = i; }));

const LEVELS = {
  twin: {
    key: 'twin', name: 'Twin Pop', rank: 0, tier: 'light',
    gen: () => { const v = 1 + rand(9); return { v, label: String(v), hue: v }; },
    match: (a, b) => a.v === b.v
  },
  make10: {
    key: 'make10', name: 'Make 10', rank: 1, tier: 'light',
    gen: () => { const v = 1 + rand(9); return { v, label: String(v), hue: v }; },
    match: (a, b) => a.v + b.v === 10
  },
  make20: {
    key: 'make20', name: 'Make 20', rank: 2, tier: 'medium',
    gen: () => { const v = 1 + rand(19); return { v, label: String(v), hue: v % 10 }; },
    match: (a, b) => a.v + b.v === 20
  },
  fractions: {
    key: 'fractions', name: 'Fraction Friends', rank: 3, tier: 'full',
    gen: () => {
      const fam = FRACTION_FAMILIES[rand(FRACTION_FAMILIES.length)];
      const f = fam[rand(fam.length)];
      return { v: f, label: f, hue: FRACTION_CLASS[f] * 3 + 1, frac: true };
    },
    match: (a, b) => FRACTION_CLASS[a.v] === FRACTION_CLASS[b.v]
  },
  facts: {
    key: 'facts', name: 'Fact Pairs', rank: 3, tier: 'full',
    gen: () => {
      // half fact gems ("3 × 4"), half answer gems (12); small friendly facts
      if (rand(2)) {
        const t = 2 + rand(11), f = 1 + rand(12);
        return { v: 'q' + (t * f), label: `${t} × ${f}`, ans: t * f, hue: (t + f) % 10, fact: true };
      }
      const t = 2 + rand(11), f = 1 + rand(12);
      return { v: 'a' + (t * f), label: String(t * f), ans: t * f, hue: (t * f) % 10 };
    },
    match: (a, b) => !!(a.fact !== b.fact && a.ans === b.ans)
  }
};
const LEVEL_ORDER = ['twin', 'make10', 'make20', 'fractions', 'facts'];
function levelsForTier() {
  const t = contentTier();
  return LEVEL_ORDER.filter(k => t === 'full' || (t === 'medium' ? LEVELS[k].tier !== 'full' : LEVELS[k].tier === 'light'));
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen boopop' });
  container.appendChild(root);
  let shell = null, cleanupFns = [];

  startCard();

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 100 }) }),
      el('h2', { text: 'Boo Pop' }),
      el('p', { class: 'sc-intro', text: 'Swap two gems so a matching pair touches — pop! Gems fall, new ones drop in.' })
    ]);
    // one-tap Smart-Mix front door (RUN4 C2/C7): picks a level for her
    const avail = levelsForTier();
    const pfmRow = el('div', { class: 'picker-choices' }, [pickForMeButton(() => play(avail[rand(avail.length)]))]);
    const levels = el('div', { class: 'level-row' });
    for (const k of avail) {
      levels.appendChild(el('button', { class: 'btn level-btn', style: { '--accent': 'var(--pop)' }, onclick: () => { sfx.tap(); play(k); } }, [
        el('span', { class: 'lv-num', text: LEVELS[k].name })
      ]));
    }
    card.append(pfmRow, el('p', { class: 'sc-q', text: 'Pick a level' }), levels);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: `Three stars: ${POPS_3STAR} or more pops, no hints. (The glow that appears on its own is free!)` })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
  }

  function play(levelKey) {
    clear(root);
    const rule = LEVELS[levelKey];
    let moves = MOVES, pops = 0, hintsUsed = 0, busy = false, sel = null, ended = false;
    let idleTimer = null, glowPair = null;
    let board = [];   // board[r][c] = { gem, node }

    shell = createGameShell({
      title: rule.name, rounds: MOVES, accent: 'var(--pop)',
      onBack: () => ctx.go('hub'),
      onHint: manualHint
    });
    root.appendChild(shell.root);
    shell.setProgress(0);

    const grid = el('div', { class: 'bp-board', style: { '--n': N } });
    const hud = el('div', { class: 'bp-hud' }, [
      el('span', { class: 'bp-pops', text: '0 pops' }),
      el('span', { class: 'bp-moves', text: `${MOVES} moves` })
    ]);
    shell.area.append(hud, grid);

    // ---- board engine ------------------------------------------------------
    const at = (r, c) => (r >= 0 && r < N && c >= 0 && c < N) ? board[r][c] : null;
    const neighbours = (r, c) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([rr, cc]) => rr >= 0 && rr < N && cc >= 0 && cc < N);

    function anyAdjacentMatch() {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const g = at(r, c); if (!g) continue;
        if (c + 1 < N && at(r, c + 1) && rule.match(g.gem, at(r, c + 1).gem)) return [[r, c], [r, c + 1]];
        if (r + 1 < N && at(r + 1, c) && rule.match(g.gem, at(r + 1, c).gem)) return [[r, c], [r + 1, c]];
      }
      return null;
    }
    // a valid MOVE: some swap of adjacent cells creates at least one match
    function findValidMove() {
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        for (const [rr, cc] of [[r, c + 1], [r + 1, c]]) {
          if (rr >= N || cc >= N) continue;
          swapGems(r, c, rr, cc);
          const m = anyAdjacentMatch();
          swapGems(r, c, rr, cc);
          if (m) return { from: [r, c], to: [rr, cc] };
        }
      }
      return null;
    }
    function swapGems(r1, c1, r2, c2) {
      const a = board[r1][c1], b = board[r2][c2];
      board[r1][c1] = b; board[r2][c2] = a;
    }
    function freshGem() { return rule.gen(); }

    // Build a board with NO instant matches but AT LEAST one valid move.
    function buildBoard() {
      for (let guard = 0; guard < 60; guard++) {
        board = [];
        for (let r = 0; r < N; r++) {
          board.push([]);
          for (let c = 0; c < N; c++) {
            let gem, tries = 0;
            do { gem = freshGem(); tries++; } while (tries < 40 && wouldMatchAt(r, c, gem));
            board[r].push({ gem, node: null });
          }
        }
        if (!anyAdjacentMatch() && findValidMove()) return;
      }
      // last resort: shuffle whatever we have into legality
      sparkleShuffle(false);
    }
    function wouldMatchAt(r, c, gem) {
      const left = c > 0 ? board[r][c - 1] : null;
      const up = r > 0 ? board[r - 1] && board[r - 1][c] : null;
      return (left && rule.match(gem, left.gem)) || (up && rule.match(gem, up.gem));
    }

    // Rearrange the EXISTING gems until legal (no instant match, has a move).
    function sparkleShuffle(announce = true) {
      const gems = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) gems.push(board[r][c].gem);
      for (let guard = 0; guard < 120; guard++) {
        for (let i = gems.length - 1; i > 0; i--) { const j = rand(i + 1); [gems[i], gems[j]] = [gems[j], gems[i]]; }
        let k = 0;
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) board[r][c].gem = gems[k++];
        if (!anyAdjacentMatch() && findValidMove()) break;
      }
      renderBoard(true);
      if (announce) {
        shell.react('✨ Sparkle-shuffle! Fresh pairs for you — on the house!', { voice: false, hold: 2400 });
        sfx.star();
      }
    }

    // ---- rendering ---------------------------------------------------------
    function gemNode(g, r, c) {
      const n = el('button', {
        class: `bp-gem hue-${g.hue}${g.frac ? ' frac' : ''}${g.fact ? ' fact' : ''}`,
        dataset: { r, c }, 'aria-label': g.label
      }, [el('span', { class: 'bp-label', text: g.label })]);
      n.addEventListener('pointerdown', (e) => onGemDown(e, n));
      return n;
    }
    function renderBoard(dropIn = false) {
      clear(grid);
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const cell = board[r][c];
        cell.node = gemNode(cell.gem, r, c);
        if (dropIn && !REDUCED) { cell.node.classList.add('drop-in'); cell.node.style.animationDelay = (r * 40 + c * 12) + 'ms'; }
        grid.appendChild(cell.node);
      }
    }

    // ---- input: two taps or a drag ----------------------------------------
    let dragFrom = null, dragStart = null;
    function onGemDown(e, node) {
      if (busy || ended) return;
      restartIdle();
      const r = +node.dataset.r, c = +node.dataset.c;
      dragFrom = { r, c, node }; dragStart = { x: e.clientX, y: e.clientY };
      node.setPointerCapture(e.pointerId);
      const move = (ev) => {
        if (!dragFrom) return;
        const dx = ev.clientX - dragStart.x, dy = ev.clientY - dragStart.y;
        if (Math.hypot(dx, dy) > 26) {
          const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? [0, 1] : [0, -1]) : (dy > 0 ? [1, 0] : [-1, 0]);
          const target = { r: r + dir[0], c: c + dir[1] };
          endDrag();
          if (target.r >= 0 && target.r < N && target.c >= 0 && target.c < N) trySwap({ r, c }, target);
        }
      };
      const up = () => {
        if (dragFrom) { tapSelect(r, c, node); }
        endDrag();
      };
      function endDrag() {
        dragFrom = null;
        node.removeEventListener('pointermove', move);
        node.removeEventListener('pointerup', up);
        node.removeEventListener('pointercancel', endDrag);
      }
      node.addEventListener('pointermove', move);
      node.addEventListener('pointerup', up);
      node.addEventListener('pointercancel', endDrag);
    }
    function tapSelect(r, c, node) {
      sfx.tap();
      if (!sel) { sel = { r, c, node }; node.classList.add('sel'); return; }
      if (sel.r === r && sel.c === c) { node.classList.remove('sel'); sel = null; return; }
      const isAdj = Math.abs(sel.r - r) + Math.abs(sel.c - c) === 1;
      const prev = sel; prev.node.classList.remove('sel'); sel = null;
      if (isAdj) trySwap({ r: prev.r, c: prev.c }, { r, c });
      else { sel = { r, c, node }; node.classList.add('sel'); }
    }

    async function trySwap(a, b) {
      if (busy || ended) return;
      busy = true;
      clearGlow();
      const na = board[a.r][a.c].node, nb = board[b.r][b.c].node;
      await animateSwap(na, nb, a, b);
      swapGems(a.r, a.c, b.r, b.c);
      if (!anyAdjacentMatch()) {
        // gentle no: swap straight back, no move lost, nothing harsh
        swapGems(a.r, a.c, b.r, b.c);
        await animateSwap(na, nb, b, a);
        wobble(na); sfx.oops();
        busy = false; restartIdle();
        return;
      }
      moves--; shell.advance(); updateHud();
      renderBoard();
      await resolveCascades();
      busy = false;
      if (moves <= 0) return finish();
      ensureMovable();
      restartIdle();
    }
    function animateSwap(na, nb, a, b) {
      if (REDUCED) return Promise.resolve();
      const dx = (b.c - a.c) * (na.offsetWidth + 6), dy = (b.r - a.r) * (na.offsetHeight + 6);
      na.style.transform = `translate(${dx}px, ${dy}px)`;
      nb.style.transform = `translate(${-dx}px, ${-dy}px)`;
      na.classList.add('swapping'); nb.classList.add('swapping');
      return new Promise(r => setTimeout(r, 230));
    }

    // pop every matching adjacent pair, apply gravity, refill, repeat (cascade!)
    async function resolveCascades() {
      let chain = 0;
      for (;;) {
        const popSet = new Set();
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          if (c + 1 < N && rule.match(board[r][c].gem, board[r][c + 1].gem)) { popSet.add(r + ':' + c); popSet.add(r + ':' + (c + 1)); }
          if (r + 1 < N && rule.match(board[r][c].gem, board[r + 1][c].gem)) { popSet.add(r + ':' + c); popSet.add((r + 1) + ':' + c); }
        }
        if (!popSet.size) break;
        chain++;
        pops += Math.ceil(popSet.size / 2);
        updateHud();
        sfx.pop();
        if (chain > 1) sfx.star();
        // sparkle + shrink the popped gems
        for (const key of popSet) {
          const [r, c] = key.split(':').map(Number);
          const node = board[r][c].node;
          if (node) {
            node.classList.add('popping');
            if (!REDUCED) { const rect = node.getBoundingClientRect(); sparkleAt(rect.left + rect.width / 2, rect.top + rect.height / 2); }
          }
        }
        if (!REDUCED) await new Promise(r => setTimeout(r, 320));
        // gravity: surviving gems fall, new gems drop in at the top
        for (let c = 0; c < N; c++) {
          const keep = [];
          for (let r = N - 1; r >= 0; r--) if (!popSet.has(r + ':' + c)) keep.push(board[r][c].gem);
          for (let r = N - 1; r >= 0; r--) {
            board[r][c].gem = keep[N - 1 - r] !== undefined ? keep[N - 1 - r] : freshGem();
          }
        }
        renderBoard(true);
        if (!REDUCED) await new Promise(r => setTimeout(r, 340));
      }
      if (chain >= 2) shell.react(`${chain}-chain cascade! ✨`, { voice: false, hold: 1600 });
    }

    function ensureMovable() {
      if (!findValidMove()) sparkleShuffle(true);
    }

    // ---- hints -------------------------------------------------------------
    function restartIdle() {
      if (idleTimer) clearTimeout(idleTimer);
      if (ended) return;
      idleTimer = setTimeout(() => { softGlow(); }, IDLE_HINT_MS);
    }
    function softGlow() {   // free — appears on its own after 6 idle seconds
      const mv = findValidMove();
      if (!mv) return;
      glowPair = mv;
      board[mv.from[0]][mv.from[1]].node.classList.add('glow');
      board[mv.to[0]][mv.to[1]].node.classList.add('glow');
    }
    function clearGlow() {
      if (idleTimer) clearTimeout(idleTimer);
      grid.querySelectorAll('.glow, .hinted').forEach(n => n.classList.remove('glow', 'hinted'));
      glowPair = null;
    }
    function manualHint() {   // instant, counts as a hint (caps the round at 2★)
      if (busy || ended) return;
      const mv = findValidMove();
      if (!mv) return;
      hintsUsed++;
      shell.react(guideLine('hintOffer') ? 'These two! Swap them together!' : 'These two!', { voice: false, hold: 2000 });
      board[mv.from[0]][mv.from[1]].node.classList.add('hinted');
      board[mv.to[0]][mv.to[1]].node.classList.add('hinted');
    }

    function updateHud() {
      hud.querySelector('.bp-pops').textContent = `${pops} pop${pops === 1 ? '' : 's'}`;
      hud.querySelector('.bp-moves').textContent = `${moves} move${moves === 1 ? '' : 's'}`;
    }

    function finish() {
      if (ended) return; ended = true;
      if (idleTimer) clearTimeout(idleTimer);
      const stars = (pops >= POPS_3STAR && hintsUsed === 0) ? 3 : (pops >= POPS_2STAR ? 2 : 1);
      recordBest('boopop', rule.key, stars);
      // Twin Pop is the tutorial, not the sport: after the 3rd lifetime Twin Pop
      // round it always counts as a cosy round for the meter (C7).
      let extraCosy = false;
      if (rule.key === 'twin') {
        const n = ((getState().seen.twinPopRounds || 0) + 1);
        mutate(st => { st.seen.twinPopRounds = n; });
        extraCosy = n > TWIN_COSY_AFTER;
      }
      shell.cleanup();
      ctx.go('results', { game: 'boopop', gameName: rule.name, stars, level: rule.rank, cat: rule.key, extraCosy, replay: () => ctx.go('boopop') });
    }

    // ---- boot --------------------------------------------------------------
    buildBoard();
    renderBoard(true);
    updateHud();
    restartIdle();
    shell.react(guideLine('gameIntroPop'), { hold: 3600 });

    // invisible test hook
    if (typeof window !== 'undefined') window.__boopop = {
      state: () => ({ moves, pops, hintsUsed, level: rule.key, busy, ended }),
      grid: () => board.map(row => row.map(cell => cell.gem.label)),
      match: (a, b) => rule.match(a, b),
      findMove: () => findValidMove(),
      swap: (r1, c1, r2, c2) => trySwap({ r: r1, c: c1 }, { r: r2, c: c2 }),
      setTwinGrid: (vals) => {   // test-only: install an exact twin board
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const v = vals[r][c];
          board[r][c].gem = { v, label: String(v), hue: v };
        }
        renderBoard();
        return !findValidMove();
      },
      checkMovable: () => {   // runs the kindness net; reports what happened
        const had = !!findValidMove();
        ensureMovable();
        return { had, movableNow: !!findValidMove() };
      },
      glowShown: () => !!grid.querySelector('.glow'),
      finish: () => { moves = 0; finish(); }
    };
  }

  return { unmount() { if (shell) shell.cleanup(); } };
}
