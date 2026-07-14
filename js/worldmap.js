// js/worldmap.js — Town 4.0: the world map (RUN10 P1).
// Opening the Town tab should feel like looking at home from a hilltop: one island,
// eight landmark badges, locked areas shown honestly (not hidden), and a threshold
// crossing detected here plays the unlock ceremony before you ever step into the area.

import { el, clear, confetti, REDUCED, backControl } from './ui.js';
import { getState, mutate } from './state.js';
import { AREAS, MAP_POS, AREA_UNLOCK_STARS } from './areas.js';
import { renderIslandMap } from './art.js';
import { guideLine, speakMaybe } from './guide.js';
import { stampJournal } from './quests.js';
import { sfx, music } from './sfx.js';

export function mount(container, params, ctx) {
  const root = el('div', { class: 'worldmap' });
  const back = backControl(() => ctx.go('hub'));
  const title = el('h2', { text: 'My Town' });
  const header = el('header', { class: 'town-header' }, [back, title, el('span', { class: 'icon-btn', style: { visibility: 'hidden' } })]);
  const stage = el('div', { class: 'map-stage' });
  const toast = el('div', { class: 'map-toast' });
  root.append(header, stage, toast);
  container.appendChild(root);
  music.play('calm');

  const island = el('div', { class: 'map-island', html: renderIslandMap({}) });
  stage.appendChild(island);

  const badgeEls = {};
  let justUnlocked = new Set();
  function render() {
    stage.querySelectorAll('.map-badge').forEach(n => n.remove());
    const s = getState();
    for (const a of AREAS) {
      const unlocked = a.unlocked(s);
      const pos = MAP_POS[a.key] || { x: 50, y: 50 };
      const threshold = AREA_UNLOCK_STARS[a.key] || 0;
      const badge = el('button', {
        class: 'map-badge' + (unlocked ? '' : ' locked'),
        style: { left: pos.x + '%', top: pos.y + '%' },
        'aria-label': a.name
      }, [
        el('div', { class: 'mb-dot', html: unlocked ? areaIcon(a.key) : '🔒' }),
        el('div', { class: 'mb-label', text: a.name }),
        unlocked ? null : el('div', { class: 'mb-chip', text: `${threshold}⭐` })
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
  requestAnimationFrame(maybeCelebrateUnlock);

  if (typeof window !== 'undefined') {
    window.__worldmap = {
      badges: () => AREAS.map(a => ({ key: a.key, locked: badgeEls[a.key].classList.contains('locked') })),
      tap: (key) => badgeEls[key] && badgeEls[key].click(),
      wobbling: (key) => badgeEls[key] && badgeEls[key].classList.contains('wobble'),
      toastText: () => toast.textContent,
      recheckUnlock: () => maybeCelebrateUnlock(),
      justUnlocked: () => [...justUnlocked]
    };
  }

  return { unmount() { if (typeof window !== 'undefined') delete window.__worldmap; } };
}

function areaIcon(key) {
  const icons = { meadow: '🌼', riverside: '🌉', hilltop: '⛰️', beach: '🏖️', funfair: '🎡', playground: '🛝', boohouse: '🏠', gallery: '🖼️' };
  return icons[key] || '📍';
}
