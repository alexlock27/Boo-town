// js/gallerymuseum.js — RUN10 P4: the Gallery, a self-curating museum of everything
// she's collected. Distinct from js/gallery.js (the Studio's own art gallery) — this is
// the world-map Gallery area, reached only from worldmap.js (not a town.js area scene).
// No build mode: nothing here is placed by hand, it curates itself from the save.

import { el, clear, backControl, REDUCED } from './ui.js';
import { getState } from './state.js';
import { renderItem, renderMuseumRoom, renderBoo } from './art.js';   // RUN18D D9
import { COLLECTIBLES } from '../data/catalogue.js';
import { ownedCustomItems, resolveItem } from './customs.js';
import { applyRarityFx } from './rarityfx.js';
import { CATALOG as TROPHY_CATALOG } from './trophies.js';
import { guideLine, speakMaybe } from './guide.js';
import { sfx, music } from './sfx.js';
import { bondLevel, renderBffPortrait } from './care.js';
import { getDisplayName } from './accessories.js';   // RUN18D D9: the plate says what she calls it

const EMPTY_THRESHOLD = 6;   // fewer than this owned → the seed room, not species wings
// RUN18D D9 — verbatim from the pack.
export const EMPTY_PLINTH_LINE = 'Waiting for a treasure…';
export const VISITOR_SPEED_PX_S = 26;   // the town's own wander rate
export const MAX_VISITORS = 1;          // "one Boo visitor", and the actor cap says so
const SPECIES_LABELS = {
  bloop: 'Bloops', pip: 'Pips', munch: 'Munches', twirl: 'Twirls', sunny: 'Sunnies', snug: 'Snugs',
  giraffe: 'Giraffes', puppy: 'Puppies', kitten: 'Kittens', penguin: 'Penguins', bunny: 'Bunnies'
};

export function mount(container, params, ctx) {
  const s = getState();
  music.play('calm');

  const root = el('div', { class: 'gallerymuseum' });
  const back = backControl(() => ctx.go('worldmap'));
  const title = el('h2', { text: 'The Gallery' });
  const header = el('header', { class: 'town-header' }, [back, title, el('span', { class: 'icon-btn', style: { visibility: 'hidden' } })]);
  const stage = el('div', { class: 'gm-stage' });
  const hint = el('div', { class: 'town-hint-bar' });
  root.append(header, stage, hint);
  container.appendChild(root);

  // ---- what's owned, grouped by species (a small banner between each group) ----
  const owned = COLLECTIBLES.filter(it => (s.inventory[it.id] || 0) > 0);
  const customs = ownedCustomItems();
  const allOwned = [...owned, ...customs];

  function speciesLabel(sp) { return SPECIES_LABELS[sp] || (sp ? sp[0].toUpperCase() + sp.slice(1) + 's' : 'Mystery Boos'); }
  function speciesGroups() {
    const boos = owned.filter(it => it.kind === 'boo');
    const order = [];
    for (const it of boos) if (!order.includes(it.species)) order.push(it.species);
    const groups = order.map(sp => ({ key: sp, label: speciesLabel(sp), items: boos.filter(it => it.species === sp) }));
    if (customs.length) groups.push({ key: 'custom', label: 'Your Own Creations', items: customs });
    const decor = owned.filter(it => it.kind !== 'boo');
    if (decor.length) groups.push({ key: 'decor', label: 'Decorations & Keepsakes', items: decor });
    return groups;
  }
  const isShiny = (item) => ((s.shinies && s.shinies[item.id]) || 0) > 0;

  function openCard(item) { sfx.tap(); ctx.go('collection', { openItem: item.id, from: 'gallerymuseum' }); }

  function plinth(item, gold) {
    const art = el('div', { class: 'gm-art', html: renderItem(item, { size: 84, cls: item.fx ? '' : 'art-idle' }) });
    // RUN18D D9: an engraved-style plate, ink on brass. A museum labels what is on the
    // plinth; this one made her tap a figure to find out what it was called.
    const name = (item.kind === 'boo' ? getDisplayName(item.id) : null) || item.name;
    const plate = el('div', { class: 'gm-plate', text: name });
    const p = el('button', {
      class: 'gm-plinth' + (gold ? ' gold' : ''), 'aria-label': name, dataset: { item: item.id },
      onclick: () => openCard(item)
    }, [el('div', { class: 'gm-pedestal' + (gold ? ' gold' : '') }), art, plate]);
    // Shiny copies stand on a gold pedestal with the full rarity fx loop; everyone else
    // gets the calmer collection-grid version (30 owned Boos is a lot of DOM to animate).
    applyRarityFx(art, item, { context: gold ? 'full' : 'calm', shiny: gold });
    return p;
  }
  // RUN18D D9 — an empty plinth SAYS it is waiting, in ink a child can read, instead of a
  // grey "?" at 50% opacity on a dark wall.
  function seedPlinth() {
    return el('div', { class: 'gm-plinth seed' }, [
      el('div', { class: 'gm-pedestal' }),
      el('div', { class: 'gm-seed-q', text: '?' }),
      el('div', { class: 'gm-plate empty', text: EMPTY_PLINTH_LINE })
    ]);
  }

  // Walls above hang earned trophies + best-friend framed portraits (RUN10 P12).
  function renderWall() {
    const earned = TROPHY_CATALOG.filter(c => s.trophies && s.trophies[c.key]);
    const bonds = (s.care && s.care.bonds) || {};
    const framed = Object.keys(bonds).filter(id => bondLevel(id, s) >= 5);
    if (!earned.length && !framed.length) return null;
    const wall = el('div', { class: 'gm-wall' });
    earned.forEach(c => wall.appendChild(el('div', { class: 'gm-trophy', dataset: { key: c.key }, title: c.label, text: c.icon })));
    if (framed.length) {
      const shelf = el('div', { class: 'gm-portrait-shelf' }, [
        el('strong', { class: 'gm-wall-label', text: 'Best Friends' })
      ]);
      framed.forEach(id => {
        const item = resolveItem(id);
        if (item) shelf.appendChild(el('div', { class: 'gm-portrait', dataset: { boo: id }, title: item.name }, [
          el('div', { class: 'gm-frame', style: { width: '92px', height: '92px', border: '6px solid #FFC93C', borderRadius: '12px', background: '#FFF1B8', boxShadow: '0 4px 8px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }, html: renderBffPortrait(id, 76) }),
          el('span', { text: item.name })
        ]));
      });
      wall.appendChild(shelf);
    }
    return wall;
  }

  // RUN18D D9: declared ABOVE render(), because mount() calls render() which dresses the
  // room — a `let` below it is in its temporal dead zone at that moment.
  let roomEl = null, visitor = null, visitorRaf = null, visitorX = 0, visitorDir = 1, visitorPause = 0;

  function render() {
    clear(stage);
    const wall = renderWall();
    if (wall) stage.appendChild(wall);
    if (allOwned.length < EMPTY_THRESHOLD) {
      const seedWrap = el('div', { class: 'gm-seed-room' });
      allOwned.forEach(item => seedWrap.appendChild(plinth(item, isShiny(item))));
      for (let i = allOwned.length; i < EMPTY_THRESHOLD; i++) seedWrap.appendChild(seedPlinth());
      stage.appendChild(seedWrap);
      const line = guideLine('L_GALLERY_SEED');
      hint.textContent = line;
      speakMaybe(line);
      dressRoom();
      return;
    }
    const wings = el('div', { class: 'gm-wings' });
    for (const g of speciesGroups()) {
      wings.appendChild(el('div', { class: 'gm-wing' }, [
        el('div', { class: 'gm-banner', text: g.label }),
        el('div', { class: 'gm-grid' }, g.items.map(it => plinth(it, isShiny(it))))
      ]));
    }
    stage.appendChild(wings);
    hint.textContent = '';
    dressRoom();
  }
  render();

  // ---- RUN18D D9: the room itself, and the one visitor in it ------------------------
  // The backdrop is sized to the SCROLLED width, so the spotlights line up with the
  // plinths wherever she has dragged to, and it is inserted behind everything.
  function dressRoom() {
    if (roomEl) roomEl.remove();
    const w = Math.max(stage.scrollWidth, stage.clientWidth);
    const h = stage.clientHeight || 380;
    // one cone per plinth COLUMN rather than per plinth: 30 beams is a disco, not a museum
    const seen = new Set(), spots = [];
    for (const n of stage.querySelectorAll('.gm-plinth')) {
      const r = n.getBoundingClientRect(), s0 = stage.getBoundingClientRect();
      const x = Math.round((r.left - s0.left + stage.scrollLeft + r.width / 2) / 60) * 60;
      if (seen.has(x)) continue;
      seen.add(x); spots.push(x);
    }
    roomEl = el('div', { class: 'gm-room-wrap', html: renderMuseumRoom(w, h, spots.slice(0, 14)) });
    roomEl.style.width = w + 'px';
    stage.insertBefore(roomEl, stage.firstChild);
    startVisitor(w, h);
  }
  function startVisitor(w, h) {
    if (visitorRaf) cancelAnimationFrame(visitorRaf);
    if (visitor) visitor.remove();
    visitor = el('div', { class: 'gm-visitor', 'aria-hidden': 'true',
      html: renderBoo({ species: 'bloop', colors: { body: 'lilac' } }, { size: 56, cls: 'art-idle' }) });
    visitorX = Math.min(120, w * 0.1);
    stage.insertBefore(visitor, stage.firstChild.nextSibling);
    visitor.style.top = Math.round((h || 380) * 0.66) + 'px';
    if (REDUCED) { visitor.style.transform = `translateX(${visitorX}px)`; return; }
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(now - last, 60) / 1000; last = now;
      if (visitorPause > 0) visitorPause -= dt;
      else {
        visitorX += visitorDir * VISITOR_SPEED_PX_S * dt;
        if (visitorX < 40) { visitorX = 40; visitorDir = 1; visitorPause = 1.4; }
        if (visitorX > w - 80) { visitorX = w - 80; visitorDir = -1; visitorPause = 1.4; }
      }
      visitor.style.transform = `translateX(${visitorX.toFixed(1)}px) scaleX(${visitorDir})`;
      visitorRaf = requestAnimationFrame(step);
    };
    visitorRaf = requestAnimationFrame(step);
  }

  // ---- horizontal camera scroll: a look-around, not a build space — plain drag + momentum ----
  let vel = 0, lastX = 0, lastT = 0, dragging = false, sx = 0, sScroll = 0, momRaf = null;
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.gm-plinth')) return;
    if (momRaf) { cancelAnimationFrame(momRaf); momRaf = null; }
    dragging = true; sx = e.clientX; sScroll = stage.scrollLeft; vel = 0; lastX = e.clientX; lastT = performance.now();
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener('pointermove', e => {
    if (!dragging) return;
    stage.scrollLeft = sScroll - (e.clientX - sx);
    const now = performance.now(); const dt = now - lastT;
    if (dt > 0) vel = (e.clientX - lastX) / dt;
    lastX = e.clientX; lastT = now;
  });
  const endDrag = () => {
    if (!dragging) return; dragging = false;
    let v = vel * 16;
    if (Math.abs(v) < 0.5 || REDUCED) return;
    (function mom() { stage.scrollLeft -= v; v *= 0.92; if (Math.abs(v) > 0.4) momRaf = requestAnimationFrame(mom); })();
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', () => { dragging = false; });

  if (typeof window !== 'undefined') {
    window.__gallery = {
      ownedCount: () => allOwned.length,
      emptyState: () => allOwned.length < EMPTY_THRESHOLD,
      wingLabels: () => [...stage.querySelectorAll('.gm-banner')].map(n => n.textContent),
      wingCounts: () => [...stage.querySelectorAll('.gm-wing')].map(w => w.querySelectorAll('.gm-plinth').length),
      plinthCount: () => stage.querySelectorAll('.gm-plinth').length,
      goldCount: () => stage.querySelectorAll('.gm-plinth.gold').length,
      trophyCount: () => stage.querySelectorAll('.gm-trophy').length,
      portraitCount: () => stage.querySelectorAll('.gm-portrait').length,
      seedCount: () => stage.querySelectorAll('.gm-plinth.seed').length,
      hintText: () => hint.textContent,
      // RUN18D D9 QA
      roomPresent: () => !!stage.querySelector('.gm-room'),
      coneCount: () => stage.querySelectorAll('.gm-cone').length,
      plateTexts: () => [...stage.querySelectorAll('.gm-plate')].map(n => n.textContent),
      visitorX: () => { const v = stage.querySelector('.gm-visitor'); if (!v) return null; const m = /translateX\(([-\d.]+)px\)/.exec(v.style.transform || ''); return m ? +m[1] : 0; },
      visitorCount: () => stage.querySelectorAll('.gm-visitor').length,
      tap: (id) => { const n = stage.querySelector(`.gm-plinth[data-item="${id}"]`); if (n) n.click(); },
      scrollTo: (px) => { stage.scrollLeft = px; },
      scrollLeft: () => stage.scrollLeft,
      scrollWidth: () => stage.scrollWidth,
      // The shiny loop (.rfx-shiny-sweep) is common to every gold-pedestal figure
      // regardless of rarity; .rfx-shimmer/.rfx-motes only exist for ultra-rarity items.
      goldFxAnimated: (id) => {
        const n = stage.querySelector(`.gm-plinth[data-item="${id}"] .rfx-shiny-sweep`);
        return n ? getComputedStyle(n).animationName !== 'none' : false;
      }
    };
  }

  return {
    unmount() {
      if (momRaf) cancelAnimationFrame(momRaf);
      if (visitorRaf) cancelAnimationFrame(visitorRaf);
      if (typeof window !== 'undefined') delete window.__gallery;
    }
  };
}
