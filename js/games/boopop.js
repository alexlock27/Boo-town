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
import { maybeIntro, replayIntro } from '../intro.js';
import { contentTier } from '../content.js';

// Named constants (RUN5 C2 — all tunable). Chunkier gems on a smaller board so the
// puzzle reads at a glance; thresholds retune for the smaller board, 3★ kept generous.
export const BOARD_STD = 6;         // 6x6 standard board
export const BOARD_TWIN = 5;        // 5x5 for Twin Pop (biggest, chunkiest gems)
export const MOVES = 20;            // moves per round, no timer ever
export const POPS_3STAR = 9;        // 3★: 9+ pops on the 6x6, no manual hints (was 12 on 7x7)
export const POPS_2STAR = 6;        // 2★: 6+ pops on the 6x6
export const POPS_3STAR_TWIN = 7;   // 3★ on the 5x5 Twin board
export const POPS_2STAR_TWIN = 4;   // 2★ on the 5x5 Twin board
export const IDLE_HINT_MS = 6000;   // free soft glow after 6 idle seconds
export const TWIN_COSY_AFTER = 3;   // Twin Pop is cosy after the 3rd lifetime round

const rand = (n) => (Math.random() * n) | 0;

// ---- colour + shape families (C2) -------------------------------------------
// Colour now MEANS something: gems that belong together share a hue AND a shape, so
// the board reads as a match puzzle at a glance and stays fair for colourblind eyes
// (any two families differ by shape too). Five families → five hues + five shapes.
export const GEM_SHAPES = ['round', 'square', 'teardrop', 'star', 'heart'];
export const GEM_HUES = ['#FF7AC6', '#35D0BA', '#8FC7FF', '#FFC93C', '#C6A9F0', '#F06292', '#4DD0E1', '#81C784', '#BA68C8', '#FFB74D'];
// family index (1-based) → shape + hue. Family 1..5 map 1:1 onto the five silhouettes;
// modes with more families (Make 20, Twin) keep distinct hues and cycle the shapes.
function famShape(fam) { return (fam - 1) % GEM_SHAPES.length; }
function famHue(fam) { return ((fam - 1) % GEM_HUES.length) + 1; }

const SHAPE_EL = {
  round:    (f) => `<circle cx="50" cy="53" r="42" fill="${f}" stroke="#2A1B4E" stroke-width="4"/>`,
  square:   (f) => `<rect x="11" y="13" width="78" height="78" rx="20" fill="${f}" stroke="#2A1B4E" stroke-width="4"/>`,
  teardrop: (f) => `<path d="M50 9C73 35 85 53 85 65a35 35 0 1 1-70 0C15 53 27 35 50 9Z" fill="${f}" stroke="#2A1B4E" stroke-width="4" stroke-linejoin="round"/>`,
  star:     (f) => `<path d="M50 8l10.5 25.5L88 36l-21 17.5 6.5 27L50 92l-23.5 12.5 6.5-27L12 36l27.5-2.5z" transform="translate(0 -4)" fill="${f}" stroke="#2A1B4E" stroke-width="4" stroke-linejoin="round"/>`,
  heart:    (f) => `<path d="M50 91C7 61 13 24 36 24c9 0 14 7 14 12 0-5 5-12 14-12 23 0 29 37-14 67z" fill="${f}" stroke="#2A1B4E" stroke-width="4" stroke-linejoin="round"/>`
};

// A gem is a little Boo face (two eyes + a grin) holding its numeral, on its family
// silhouette. The numeral stays the dominant, most-legible element.
function gemSVG(gem) {
  const shape = GEM_SHAPES[(gem.shape || 0) % GEM_SHAPES.length];
  const fill = GEM_HUES[((gem.hue || 1) - 1 + GEM_HUES.length) % GEM_HUES.length];
  const face =
    '<ellipse cx="37" cy="30" rx="7" ry="8" fill="#fff" stroke="#2A1B4E" stroke-width="2"/>' +
    '<ellipse cx="63" cy="30" rx="7" ry="8" fill="#fff" stroke="#2A1B4E" stroke-width="2"/>' +
    '<circle cx="38" cy="32" r="3" fill="#2A1B4E"/><circle cx="64" cy="32" r="3" fill="#2A1B4E"/>' +
    '<path d="M43 41q7 5 14 0" fill="none" stroke="#2A1B4E" stroke-width="2.4" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 100 100" class="bp-gem-svg" xmlns="http://www.w3.org/2000/svg">${SHAPE_EL[shape](fill)}${face}${labelSVG(gem)}</svg>`;
}
function labelSVG(gem) {
  const t = (s, y, size) => `<text x="50" y="${y}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="${size}" fill="#fff" stroke="#2A1B4E" stroke-width="1.1" paint-order="stroke">${s}</text>`;
  if (gem.frac) {
    const [num, den] = String(gem.v).split('/');
    return t(num, 58, 24) + '<line x1="36" y1="63" x2="64" y2="63" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>' + t(den, 88, 24);
  }
  if (gem.fact && String(gem.label).includes('×')) return t(gem.label.replace(/\s+/g, ''), 74, 21);
  return t(gem.label, 76, 40);
}

// ---- the level rules ---------------------------------------------------------
// Fraction Friends equivalence families (exactly per C7).
const FRACTION_FAMILIES = [['1/2', '2/4', '3/6'], ['1/4', '2/8'], ['3/4', '6/8']];
const FRACTION_CLASS = {};
FRACTION_FAMILIES.forEach((fam, i) => fam.forEach(f => { FRACTION_CLASS[f] = i; }));

// `rule` is the always-visible chip in the round HUD; `intro` is the guide's
// first-round line — a first-time player must never have to GUESS why pairs pop.
const LEVELS = {
  twin: {
    key: 'twin', name: 'Twin Pop', rank: 0, tier: 'light',
    rule: 'Pop the twins — two of the same!',
    intro: 'Put two of the SAME gem side by side — POP! Swap gems to make it happen!',
    // Identical number = identical gem (trivially readable): appearance is a pure
    // function of the number, so twins always look exactly alike.
    gen: () => { const v = 1 + rand(9); return { v, label: String(v), hue: famHue(v), shape: famShape(v) }; },
    match: (a, b) => a.v === b.v
  },
  make10: {
    key: 'make10', name: 'Make 10', rank: 1, tier: 'light',
    rule: 'Pop the friends that make 10!',
    intro: 'Matching colours are friends that make 10 — like 7 and 3. Put them side by side — POP!',
    // Complement families: {1,9}{2,8}{3,7}{4,6}{5}. The two friends that make 10
    // share a colour AND a shape, so colour teaches the bond.
    gen: () => { const v = 1 + rand(9); const fam = Math.min(v, 10 - v); return { v, label: String(v), hue: famHue(fam), shape: famShape(fam) }; },
    match: (a, b) => a.v + b.v === 10
  },
  make20: {
    key: 'make20', name: 'Make 20', rank: 2, tier: 'medium',
    rule: 'Pop the friends that make 20!',
    intro: 'Matching colours are friends that make 20 — like 12 and 8. Put them side by side — POP!',
    // Complement to 20 families: {1,19}…{10,10}. Family colouring by complement.
    gen: () => { const v = 1 + rand(19); const fam = Math.min(v, 20 - v); return { v, label: String(v), hue: famHue(fam), shape: famShape(fam) }; },
    match: (a, b) => a.v + b.v === 20
  },
  fractions: {
    key: 'fractions', name: 'Fraction Friends', rank: 3, tier: 'full',
    rule: 'Pop fractions worth the same!',
    intro: 'Matching colours are worth the same — like 1/2 and 2/4. Pop them side by side!',
    // Colour by EQUIVALENCE family (C2): equal fractions now share a colour + shape.
    gen: () => {
      const cls = rand(FRACTION_FAMILIES.length);
      const fam = FRACTION_FAMILIES[cls];
      const f = fam[rand(fam.length)];
      return { v: f, label: f, hue: famHue(cls + 1), shape: famShape(cls + 1), frac: true };
    },
    match: (a, b) => FRACTION_CLASS[a.v] === FRACTION_CLASS[b.v]
  },
  facts: {
    key: 'facts', name: 'Fact Pairs', rank: 3, tier: 'full',
    rule: 'Pop a times fact with its answer!',
    intro: 'A fact and its answer wear the same colour — like 3 × 4 and 12. Pop them side by side!',
    // Colour the fact gem and its answer gem alike (C2): both keyed on the answer.
    gen: () => {
      const t = 2 + rand(11), f = 1 + rand(12), ans = t * f;
      const fam = (ans % GEM_HUES.length) + 1;
      if (rand(2)) return { v: 'q' + ans, label: `${t} × ${f}`, ans, hue: famHue(fam), shape: famShape(fam), fact: true };
      return { v: 'a' + ans, label: String(ans), ans, hue: famHue(fam), shape: famShape(fam) };
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

  // Jump back in (RUN5 C0b): boopop's "mode" is its level key (make10, twin, …).
  const rz = params && params.resume;
  if (rz && rz.cat && LEVELS[rz.cat]) play(rz.cat);
  else startCard();
  maybeIntro('boopop');   // first-ever open: the guided intro (RUN5 C5)

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
    // Chunkier gems on a smaller board (C2): Twin Pop is 5x5, everything else 6x6.
    const N = rule.key === 'twin' ? BOARD_TWIN : BOARD_STD;
    const POPS3 = N === BOARD_TWIN ? POPS_3STAR_TWIN : POPS_3STAR;
    const POPS2 = N === BOARD_TWIN ? POPS_2STAR_TWIN : POPS_2STAR;
    let moves = MOVES, pops = 0, hintsUsed = 0, busy = false, sel = null, ended = false;
    let idleTimer = null, glowPair = null;
    let board = [];   // board[r][c] = { gem, node }
    let shakeUsed = false;   // shake-to-shuffle: once per round (RUN9 C7)

    // Shake-to-shuffle (RUN9 C7): a firm, debounced device shake triggers the existing
    // sparkle-shuffle once per round with a cheer. Drag players lose nothing (the automatic
    // no-moves shuffle still exists). Absent-safe: no devicemotion → nothing happens.
    const SHAKE_THRESH = 24, SHAKE_DEBOUNCE = 1400;
    let lastShakeAt = -SHAKE_DEBOUNCE;   // allow the very first shake (performance.now() can be < the debounce early on)
    const shakeHandler = (e) => {
      if (ended || busy || shakeUsed) return;
      const a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
      const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
      const nowMs = performance.now();
      if (mag > SHAKE_THRESH && nowMs - lastShakeAt > SHAKE_DEBOUNCE) {
        lastShakeAt = nowMs; shakeUsed = true;
        sparkleShuffle(false);   // shuffle silently, then show the shake cheer (not the auto-shuffle line)
        sfx.star();
        shell.react('Shake it up! 🎉', { voice: false, hold: 1800 });
      }
    };
    if (!REDUCED && typeof window !== 'undefined') { window.addEventListener('devicemotion', shakeHandler); cleanupFns.push(() => window.removeEventListener('devicemotion', shakeHandler)); }

    shell = createGameShell({
      title: rule.name, rounds: MOVES, accent: 'var(--pop)',
      onHelp: () => replayIntro('boopop'),
      onBack: () => ctx.go('hub'),
      onHint: manualHint
    });
    root.appendChild(shell.root);
    shell.setProgress(0);

    const grid = el('div', { class: 'bp-board' });
    grid.style.setProperty('--n', N);   // el() drops custom props; set the column count directly
    // The rule chip is BIG and sits above the board (C2), embodying that matching
    // colours are the friends that pop — a first-time player never has to guess.
    const ruleChip = el('div', { class: 'bp-rule', text: rule.rule });
    const hud = el('div', { class: 'bp-hud' }, [
      el('span', { class: 'bp-pops', text: '0 pops' }),
      el('span', { class: 'bp-moves', text: `${MOVES} moves` })
    ]);
    shell.area.append(ruleChip, hud, grid);

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
        class: `bp-gem${g.frac ? ' frac' : ''}${g.fact ? ' fact' : ''}`,
        dataset: { r, c, hue: g.hue, shape: g.shape }, 'aria-label': g.label,
        html: gemSVG(g)   // family silhouette + Boo face + numeral (C2)
      });
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
        // gentle no: swap straight back, no move lost. BOTH gems bounce back with a
        // soft wobble (C2) so a wrong guess feels mechanical, not punishing.
        swapGems(a.r, a.c, b.r, b.c);
        await animateSwap(na, nb, b, a);
        na.classList.add('bounce'); nb.classList.add('bounce');
        wobble(na); wobble(nb); sfx.oops();
        setTimeout(() => { na.classList.remove('bounce'); nb.classList.remove('bounce'); }, 420);
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
      shell.react('These two! Swap them together!', { voice: false, hold: 2000 });
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
      const stars = (pops >= POPS3 && hintsUsed === 0) ? 3 : (pops >= POPS2 ? 2 : 1);
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
    shell.react(rule.intro, { hold: 4600 });   // the LEVEL'S rule, not a generic line

    // invisible test hook
    if (typeof window !== 'undefined') window.__boopop = {
      state: () => ({ moves, pops, hintsUsed, level: rule.key, busy, ended }),
      // shake-to-shuffle (RUN9 C7) QA hooks
      shake: (mag = 30) => shakeHandler({ accelerationIncludingGravity: { x: mag, y: 0, z: 0 } }),
      shakeUsed: () => shakeUsed,
      grid0: () => board.map(row => row.map(cell => cell.gem.label)).join('|'),
      grid: () => board.map(row => row.map(cell => cell.gem.label)),
      gems: () => board.map(row => row.map(cell => ({ label: cell.gem.label, v: cell.gem.v, hue: cell.gem.hue, shape: cell.gem.shape }))),  // C2 family/shape checks
      n: () => N,
      thresholds: () => ({ three: POPS3, two: POPS2 }),
      match: (a, b) => rule.match(a, b),
      findMove: () => findValidMove(),
      swap: (r1, c1, r2, c2) => trySwap({ r: r1, c: c1 }, { r: r2, c: c2 }),
      setTwinGrid: (vals) => {   // test-only: install an exact twin board
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const v = vals[r][c];
          board[r][c].gem = { v, label: String(v), hue: famHue(v), shape: famShape(v) };
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

  return { unmount() { if (shell) shell.cleanup(); cleanupFns.forEach(f => { try { f(); } catch {} }); cleanupFns = []; } };
}
