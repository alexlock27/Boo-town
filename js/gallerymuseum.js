// js/gallerymuseum.js — RUN10 P4: the Gallery, a self-curating museum of everything
// she's collected. Distinct from js/gallery.js (the Studio's own art gallery) — this is
// the world-map Gallery area, reached only from worldmap.js (not a town.js area scene).
// No build mode: nothing here is placed by hand, it curates itself from the save.

import { el, clear, backControl, REDUCED } from './ui.js';
import { getState } from './state.js';
import { renderItem } from './art.js';
import { COLLECTIBLES } from '../data/catalogue.js';
import { ownedCustomItems, resolveItem } from './customs.js';
import { applyRarityFx } from './rarityfx.js';
import { CATALOG as TROPHY_CATALOG } from './trophies.js';
import { guideLine, speakMaybe } from './guide.js';
import { sfx, music } from './sfx.js';
import { bondLevel, renderBffPortrait } from './care.js';

const EMPTY_THRESHOLD = 6;   // fewer than this owned → the seed room, not species wings
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
    const p = el('button', {
      class: 'gm-plinth' + (gold ? ' gold' : ''), 'aria-label': item.name, dataset: { item: item.id },
      onclick: () => openCard(item)
    }, [el('div', { class: 'gm-pedestal' + (gold ? ' gold' : '') }), art]);
    // Shiny copies stand on a gold pedestal with the full rarity fx loop; everyone else
    // gets the calmer collection-grid version (30 owned Boos is a lot of DOM to animate).
    applyRarityFx(art, item, { context: gold ? 'full' : 'calm', shiny: gold });
    return p;
  }
  function seedPlinth() {
    return el('div', { class: 'gm-plinth seed' }, [el('div', { class: 'gm-pedestal' }), el('div', { class: 'gm-seed-q', text: '?' })]);
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
          el('div', { html: renderBffPortrait(id, 92) }),
          el('span', { text: item.name })
        ]));
      });
      wall.appendChild(shelf);
    }
    return wall;
  }

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
  }
  render();

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
      if (typeof window !== 'undefined') delete window.__gallery;
    }
  };
}
