// js/town.js — the town: her reward space (spec §9.3).
// 6x4 plot grid on a grassy hillside. Inventory drawer of owned-but-unplaced items.
// Place by tap-select-then-tap-plot OR by dragging. Tap a placed item for Move / Put away.
// Boos idle-bounce on offset timers; tapping a Boo squeaks + pops a heart.
// Dance Stage makes Boos on the 8 surrounding plots bop.

import { el, clear } from './ui.js';
import { getState, mutate } from './state.js';
import { renderItem } from './art.js';
import { BY_ID } from '../data/catalogue.js';
import { guideLine } from './guide.js';
import { sfx, music } from './sfx.js';

const COLS = 6, ROWS = 4, PLOTS = COLS * ROWS;

export function mount(container, params, ctx) {
  const s = getState();
  music.play('calm');
  let holding = (params && params.place) || null; // item id being placed
  let placeMode = !!holding;

  const root = el('div', { class: 'town' });

  const back = el('button', { class: 'icon-btn back-btn', html: backArrow(), 'aria-label': 'Back', onclick: () => { sfx.tap(); ctx.go('hub'); } });
  const title = el('h2', { text: 'My Town' });
  const hint = el('span', { class: 'town-hint' });
  const header = el('header', { class: 'town-header' }, [back, title, hint]);

  const grid = el('div', { class: 'town-grid' });
  const drawer = el('div', { class: 'town-drawer' });
  const grass = el('div', { class: 'town-grass' }, [grid]);

  root.append(header, grass, drawer);
  container.appendChild(root);

  renderGrid();
  renderDrawer();
  updateHint();

  // If arriving from the ceremony holding an item, guide nudges.
  if (placeMode && params.from === 'ceremony') showGuideNudge();

  function placedByPlot() {
    const m = {};
    for (const t of getState().town) m[t.plot] = t.item;
    return m;
  }

  function unplacedCounts() {
    const st = getState();
    const placedCount = {};
    for (const t of st.town) placedCount[t.item] = (placedCount[t.item] || 0) + 1;
    const out = {};
    for (const [id, n] of Object.entries(st.inventory)) {
      const free = n - (placedCount[id] || 0);
      if (free > 0) out[id] = free;
    }
    // the item currently in hand (picked up / from ceremony) also shows as available
    return out;
  }

  function danceNeighbours() {
    const map = placedByPlot();
    const dancing = new Set();
    for (const [plotStr, id] of Object.entries(map)) {
      if (id === 'deco_stage') {
        const p = Number(plotStr), r = Math.floor(p / COLS), c = p % COLS;
        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) dancing.add(nr * COLS + nc);
        }
      }
    }
    return dancing;
  }

  function renderGrid() {
    clear(grid);
    grid.classList.toggle('place-mode', placeMode);
    const map = placedByPlot();
    const dancing = danceNeighbours();
    for (let p = 0; p < PLOTS; p++) {
      const cell = el('div', { class: 'plot', dataset: { plot: String(p) } });
      if (map[p]) {
        const item = BY_ID[map[p]];
        const wrap = el('div', { class: 'placed', dataset: { plot: String(p) } });
        wrap.innerHTML = renderItem(item, { size: 100 });
        const svg = wrap.firstChild;
        if (svg) {
          if (item.kind === 'boo' && !item.fx) {
            svg.classList.add(dancing.has(p) ? 'art-dance' : 'art-idle');
            svg.style.animationDelay = (p % 7) * 0.18 + 's';
          }
        }
        wrap.addEventListener('click', (e) => { e.stopPropagation(); onPlacedTap(p, item, wrap); });
        cell.appendChild(wrap);
      } else if (placeMode) {
        cell.classList.add('open');
      }
      cell.addEventListener('click', () => onPlotTap(p));
      grid.appendChild(cell);
    }
  }

  function renderDrawer() {
    clear(drawer);
    const free = unplacedCounts();
    const ids = Object.keys(free);
    if (!ids.length && !holding) {
      drawer.appendChild(el('div', { class: 'drawer-empty', text: 'Win games to collect Boos, then place them here! 🌱' }));
      return;
    }
    for (const id of ids) {
      const item = BY_ID[id];
      const chip = el('button', {
        class: 'drawer-item' + (holding === id ? ' holding' : ''), dataset: { item: id },
        onclick: () => selectHold(id)
      }, [
        el('div', { class: 'drawer-art', html: renderItem(item, { size: 64 }) }),
        free[id] > 1 ? el('span', { class: 'drawer-badge', text: 'x' + free[id] }) : null
      ]);
      makeDraggable(chip, id);
      drawer.appendChild(chip);
    }
  }

  function selectHold(id) {
    sfx.tap();
    holding = (holding === id) ? null : id;
    placeMode = !!holding;
    renderGrid(); renderDrawer(); updateHint();
  }

  function onPlotTap(p) {
    if (!holding) return;
    const map = placedByPlot();
    if (map[p]) return; // occupied
    place(p, holding);
  }

  function place(p, id) {
    sfx.pop();
    mutate(st => { st.town.push({ plot: p, item: id }); });
    holding = null; placeMode = false;
    renderGrid(); renderDrawer(); updateHint();
  }

  function onPlacedTap(p, item, wrap) {
    if (placeMode) return; // ignore while placing
    if (item.kind === 'boo') { squeak(wrap); }
    openMenu(p, item, wrap);
  }

  function squeak(wrap) {
    sfx.pop();
    const svg = wrap.firstChild;
    if (svg) { svg.classList.remove('squeak'); void svg.offsetWidth; svg.classList.add('squeak'); }
    const heart = el('div', { class: 'pop-heart', text: '❤' });
    wrap.appendChild(heart);
    setTimeout(() => heart.remove(), 900);
  }

  let openPopover = null;
  function openMenu(p, item, wrap) {
    closeMenu();
    const menu = el('div', { class: 'plot-menu' }, [
      el('button', { class: 'btn soft', text: 'Move', onclick: (e) => { e.stopPropagation(); pickUp(p, item); } }),
      el('button', { class: 'btn soft', text: 'Put away', onclick: (e) => { e.stopPropagation(); putAway(p); } })
    ]);
    wrap.appendChild(menu);
    openPopover = menu;
    setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);
  }
  function closeMenu() { if (openPopover) { openPopover.remove(); openPopover = null; } }

  function pickUp(p, item) {
    closeMenu();
    mutate(st => { st.town = st.town.filter(t => t.plot !== p); });
    holding = item.id; placeMode = true;
    renderGrid(); renderDrawer(); updateHint();
  }
  function putAway(p) {
    closeMenu();
    sfx.tap();
    mutate(st => { st.town = st.town.filter(t => t.plot !== p); });
    renderGrid(); renderDrawer(); updateHint();
  }

  function updateHint() {
    hint.textContent = holding ? 'Tap a spot to place it!' : 'Tap a Boo to move it or say hi';
  }

  function showGuideNudge() {
    hint.textContent = guideLine('townFirst');
  }

  // ---- drag support (pointer events) ----
  function makeDraggable(chip, id) {
    let dragging = false, ghost = null, startX = 0, startY = 0, moved = false;
    chip.addEventListener('pointerdown', e => {
      startX = e.clientX; startY = e.clientY; moved = false;
      dragging = true;
      chip.setPointerCapture(e.pointerId);
    });
    chip.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 10) {
        moved = true;
        holding = id; placeMode = true; renderGrid();
        ghost = el('div', { class: 'drag-ghost', html: renderItem(BY_ID[id], { size: 80 }) });
        document.body.appendChild(ghost);
      }
      if (moved && ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; highlightPlot(e.clientX, e.clientY); }
    });
    chip.addEventListener('pointerup', e => {
      if (!dragging) return;
      dragging = false;
      if (ghost) { ghost.remove(); ghost = null; }
      if (moved) {
        const p = plotUnder(e.clientX, e.clientY);
        clearPlotHighlight();
        const map = placedByPlot();
        if (p != null && !map[p]) place(p, id);
        else { renderGrid(); renderDrawer(); updateHint(); }
      }
      // a non-moved tap falls through to the click handler (selectHold)
    });
    chip.addEventListener('pointercancel', () => { dragging = false; if (ghost) { ghost.remove(); ghost = null; } });
  }
  function highlightPlot(x, y) {
    clearPlotHighlight();
    const p = plotUnder(x, y);
    if (p != null) { const c = grid.querySelector(`.plot[data-plot="${p}"]`); if (c && !c.querySelector('.placed')) c.classList.add('drop-hi'); }
  }
  function clearPlotHighlight() { grid.querySelectorAll('.drop-hi').forEach(c => c.classList.remove('drop-hi')); }
  function plotUnder(x, y) {
    for (const c of grid.querySelectorAll('.plot')) {
      const r = c.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return Number(c.dataset.plot);
    }
    return null;
  }

  return { unmount() { closeMenu(); } };
}

function backArrow() {
  return `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M15 5l-7 7 7 7" fill="none" stroke="var(--card)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
