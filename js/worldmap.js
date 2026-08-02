// js/worldmap.js — Town 4.0: the world map (RUN10 P1).
// Opening the Town tab should feel like looking at home from a hilltop: one island,
// eight landmark badges, locked areas shown honestly (not hidden), and a threshold
// crossing detected here plays the unlock ceremony before you ever step into the area.

import { el, clear, confetti, REDUCED, backControl } from './ui.js';
import { getState, mutate, todayKey } from './state.js';
import { AREAS, MAP_POS, AREA_UNLOCK_STARS } from './areas.js';

// RUN20 W4: how many nodes each badge's flourish needs. Capped at three by the pack; most want
// one or two, and the CSS drives all of them off one shared 6s loop.
const FLOURISH_NODES = { meadow: 2, riverside: 2, hilltop: 1, beach: 1, funfair: 2, playground: 1, boohouse: 1, gallery: 1 };
import { renderIslandMap, renderAreaGlyph, renderItem } from './art.js';
import { BY_ID } from '../data/catalogue.js';
import { guideLine, speakMaybe } from './guide.js';
import { stampJournal } from './quests.js';
import { sfx, music } from './sfx.js';
import { ensureHide, currentHide } from './delights.js';

export function mount(container, params, ctx) {
  const root = el('div', { class: 'worldmap' });
  const back = backControl(() => ctx.go('hub'));
  const title = el('h2', { text: 'My Town' });
  function exportTown() {
    sfx.tap();
    try {
      // RUN21A-11: an honest Town Postcard — the LOOK of her town and nothing else.
      // The old "Town Code" base64'd the ENTIRE save (name, age, learning ledger) to the
      // clipboard with "share it with a friend". The postcard carries only: placements,
      // paths, applied room dressings, and each placed Boo's worn accessories + shininess.
      // (The read-only visit screen that consumes this is RUN21F F6.)
      const s = getState();
      const areas = JSON.parse(JSON.stringify((s.town && s.town.areas) || {}));
      const dressings = JSON.parse(JSON.stringify(s.dressings || {}));
      const booIds = [...new Set(
        Object.values(areas)
          .flatMap(a => ((a && a.items) || []).map(t => t.item))
          .filter(id => (id || '').startsWith('boo_') || (id || '').startsWith('custom:'))
      )];
      const roster = booIds.map(id => ({
        id,
        acc: Object.values((s.equips || {})[id] || {}).filter(Boolean),
        shiny: !!((s.shinies || {})[id])
      }));
      const postcard = { format: 'BOO_TOWN_POSTCARD', version: 1, createdAt: Date.now(), areas, dressings, roster };
      const code = 'BTPC1.' + btoa(encodeURIComponent(JSON.stringify(postcard)));
      if (navigator.clipboard) navigator.clipboard.writeText(code);
      toast.textContent = 'Postcard copied! A grown-up can paste it in another Boo Town to visit.';
      toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
    } catch(e) {}
  }
  const exportBtn = el('button', { class: 'icon-btn', text: '💌', 'aria-label': 'Share a Town Postcard', onclick: exportTown });
  const header = el('header', { class: 'town-header' }, [back, title, exportBtn]);
  const stage = el('div', { class: 'map-stage' });
  const toast = el('div', { class: 'map-toast' });
  root.append(header, stage, toast);
  container.appendChild(root);
  music.play('calm');

  const island = el('div', { class: 'map-island', html: renderIslandMap({}) });
  stage.appendChild(island);
  // (RUN11 Q1: the birthday party entry point is retired — see archive/birthdayparty.js.)

  // RUN11: one of HER OWN Boos ambles across the island, so the map is somewhere lived in
  // rather than a diagram. Pure scenery — it is not a button, it never blocks a badge tap,
  // and it is silently absent before she owns a Boo. Transform-only, stilled by reduced
  // motion, and it rotates by local day so it is a small daily "who's out today?".
  function addIslandWanderer() {
    const s = getState();
    const owned = Object.keys(s.inventory || {}).filter(id => id.startsWith('boo_') && s.inventory[id] > 0 && BY_ID[id]);
    if (!owned.length) return;
    const day = todayKey();
    let h = 0; for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const who = owned[h % owned.length];
    const strollY = 46 + (h % 5) * 6;   // a different lane each day, always over the grass
    const boo = el('div', {
      class: 'map-wanderer', 'aria-hidden': 'true',
      style: { top: strollY + '%' },
      html: renderItem(BY_ID[who], { size: 40 })
    });
    stage.appendChild(boo);
  }

  const badgeEls = {};
  let justUnlocked = new Set();
  function render() {
    stage.querySelectorAll('.map-badge').forEach(n => n.remove());
    const s = getState();
    ensureHide();   // idempotent: keeps the daily hider (and its area) current even before entering town
    const hide = currentHide();
    for (const a of AREAS) {
      const unlocked = a.unlocked(s);
      const pos = MAP_POS[a.key] || { x: 50, y: 50 };
      const threshold = AREA_UNLOCK_STARS[a.key] || 0;
      const hiding = unlocked && hide && hide.spot && hide.spot.zone === a.key;
      const badge = el('button', {
        class: 'map-badge' + (unlocked ? '' : ' locked'),
        style: { left: pos.x + '%', top: pos.y + '%' },
        'aria-label': a.name + (hiding ? ' — someone is hiding here' : '')
      }, [
        el('div', { class: 'mb-dot', html: unlocked ? areaIcon(a.key) : '🔒' }),
        el('div', { class: 'mb-label', text: a.name }),
        unlocked ? null : el('div', { class: 'mb-chip', text: `${threshold}⭐` }),
        // hide-and-seek 2.0 (RUN10 P5): a tiny peek chip so the hunt spans the world
        // without turning into a chore — only the area actually hiding someone gets one.
        hiding ? el('div', { class: 'mb-hide-chip', text: '👀' }) : null,
        // RUN20 W4: one tiny LIVE flourish per unlocked badge, on a shared 6s loop with
        // per-area content — grass sways, the river ripples, a leaf drifts, a wave laps, a
        // fair light twinkles, a ball rolls, a window glows, a spotlight breathes. At most
        // three nodes per badge, transform-only, and static under reduced motion.
        unlocked ? el('div', { class: 'mb-flourish f-' + a.key, 'aria-hidden': 'true' },
          Array.from({ length: FLOURISH_NODES[a.key] || 1 }, () => el('i'))) : null
      ]);
      badge.addEventListener('click', () => {
        if (unlocked) enterArea(a.key);
        else lockedTap(badge, a, threshold, s);
      });
      badgeEls[a.key] = badge;
      stage.appendChild(badge);
    }
  }

  function lockedTap(badge, a, threshold, s) {
    sfx.tap();
    badge.classList.remove('wobble'); void badge.offsetWidth; badge.classList.add('wobble');
    const n = Math.max(0, threshold - (s.stars.total || 0));
    const line = guideLine('L_MAP_LOCKED').replace(/\{n\}/g, String(n));
    toast.textContent = line;
    toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
    speakMaybe(line);
  }

  function enterArea(key) {
    sfx.tap();
    // The Gallery is its own dedicated screen (RUN10 P4), not a town.js area scene.
    if (key === 'gallery') { ctx.go('gallerymuseum'); return; }
    ctx.go('town', { area: key, enterPan: justUnlocked.has(key) });
  }

  // Unlock moment (P1): a threshold crossing detected on map open plays the existing
  // zone-unlock ceremony, panning INTO that area once she steps through.
  function maybeCelebrateUnlock() {
    const s = getState();
    const seen = (s.seen && s.seen.areasUnlocked) || [];
    // Only star-gated areas ever play the "just discovered" ceremony — always-open areas
    // (meadow/funfair/playground/boohouse/gallery, unlock threshold 0) are available from
    // the start and would otherwise wrongly "unlock" the very first time the map opens.
    const fresh = AREAS.filter(a => (AREA_UNLOCK_STARS[a.key] || 0) > 0 && a.unlocked(s) && !seen.includes(a.key)).map(a => a.key);
    if (!fresh.length) return;
    fresh.forEach(k => { stampJournal('zone_' + k); justUnlocked.add(k); });
    mutate(st => { st.seen = st.seen || {}; st.seen.areasUnlocked = [...seen, ...fresh]; });
    const key = fresh[0];
    const a = AREAS.find(x => x.key === key);
    setTimeout(() => {
      sfx.fanfare();
      if (!REDUCED) confetti({ count: 110, power: 1.1 });
      const line = guideLine('zoneUnlock');
      toast.textContent = `✨ ${a.name} is open! ✨`;
      toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
      speakMaybe(line);
      const badge = badgeEls[key];
      if (badge) { badge.classList.remove('wobble'); void badge.offsetWidth; badge.classList.add('wobble'); }
    }, REDUCED ? 0 : 400);
  }

  render();
  addIslandWanderer();
  requestAnimationFrame(maybeCelebrateUnlock);

  if (typeof window !== 'undefined') {
    window.__worldmap = {
      badges: () => AREAS.map(a => ({ key: a.key, locked: badgeEls[a.key].classList.contains('locked') })),
      tap: (key) => badgeEls[key] && badgeEls[key].click(),
      wobbling: (key) => badgeEls[key] && badgeEls[key].classList.contains('wobble'),
      toastText: () => toast.textContent,
      recheckUnlock: () => maybeCelebrateUnlock(),
      justUnlocked: () => [...justUnlocked],
      // RUN10 P5 QA hook: which area (if any) shows the hide-and-seek 👀 chip
      hidingArea: () => { const h = currentHide(); return h && h.spot ? h.spot.zone : null; },
      hideChipShown: (key) => !!(badgeEls[key] && badgeEls[key].querySelector('.mb-hide-chip'))
    };
  }

  return { unmount() { if (typeof window !== 'undefined') delete window.__worldmap; } };
}

// RUN11: house-style sticker glyphs, not emoji. Emoji-as-art is forbidden in game scenes
// (CLAUDE.md art contract) and made the map read as a menu of chips rather than a place.
function areaIcon(key) { return renderAreaGlyph(key, { size: 44 }); }
