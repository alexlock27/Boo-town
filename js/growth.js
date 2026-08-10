// js/growth.js — town growth milestones + the Boo Builders (RUN4 C6).
// The town upgrades itself as her Boo family grows. Milestone upgrades are
// placed by the town (scenery layers — they never consume plots she is using).
// Crossing a milestone spawns a construction site; the Builders finish 24 real
// hours later whether or not she visits (rule 1: nothing requires attendance),
// and the next town open plays the reveal. Multiple milestones queue one at a time.

import { getState, mutate } from './state.js';
import { COLLECTIBLES } from '../data/catalogue.js';
import { stampJournal } from './quests.js';

// Named constants (C6). Boo counts include catalogue Boos and won customs.
// The Meadow's original five. `basis:'boos'` (the default) counts unique Boos owned — the
// measure C6 authored. RUN21E-15 leaves every one of these untouched.
export const GROWTH_MILESTONES = [
  { idx: 0, count: 5,  key: 'wildflowers', name: 'Wildflowers',         zone: 'meadow', x: 0.28 },
  { idx: 1, count: 10, key: 'fairylights', name: 'Fairy lights',        zone: 'meadow', x: 0.58 },
  { idx: 2, count: 15, key: 'fountain',    name: 'A little fountain',   zone: 'meadow', x: 0.46 },
  { idx: 3, count: 20, key: 'paving',      name: 'Pretty paving',       zone: 'meadow', x: 0.72 },
  { idx: 4, count: 25, key: 'banner',      name: 'Celebration bunting', zone: 'meadow', x: 0.40 },

  // ---- RUN21E-15: a growth track for every other area ------------------------------------
  // Three per area, on THAT AREA'S OWN ITEM COUNT (5 / 12 / 20) — `basis:'area'`. The Meadow's
  // five keep counting Boos; these count what she has put down in the place they decorate, so
  // an area grows because she made it grow. All backdrop-layer, none of them consume a plot.
  { idx: 5,  count: 5,  key: 'steppingstones', name: 'Stepping Stones',   zone: 'riverside', x: 0.34, basis: 'area', track: 0 },
  { idx: 6,  count: 12, key: 'heron',          name: 'Heron Statue',      zone: 'riverside', x: 0.62, basis: 'area', track: 1 },
  { idx: 7,  count: 20, key: 'bridgelanterns', name: 'Bridge Lanterns',   zone: 'riverside', x: 0.50, basis: 'area', track: 2, night: true },

  { idx: 8,  count: 5,  key: 'cairn',          name: 'A Little Cairn',    zone: 'hilltop',   x: 0.26, basis: 'area', track: 0 },
  { idx: 9,  count: 12, key: 'crestflag',      name: 'A Flag on the Crest', zone: 'hilltop', x: 0.58, basis: 'area', track: 1 },
  { idx: 10, count: 20, key: 'beacon',         name: 'The Hill Beacon',   zone: 'hilltop',   x: 0.82, basis: 'area', track: 2, night: true },

  { idx: 11, count: 5,  key: 'parasols',       name: 'A Parasol Row',     zone: 'beach',     x: 0.36, basis: 'area', track: 0 },
  { idx: 12, count: 12, key: 'rockpool',       name: 'A Rockpool',        zone: 'beach',     x: 0.64, basis: 'area', track: 1 },
  { idx: 13, count: 20, key: 'lighthouse',     name: 'The Far Lighthouse', zone: 'beach',    x: 0.88, basis: 'area', track: 2, night: true },

  { idx: 14, count: 5,  key: 'hopscotch',      name: 'Painted Hopscotch Refresh', zone: 'playground', x: 0.30, basis: 'area', track: 0 },
  { idx: 15, count: 12, key: 'scoreboard',     name: 'A Scoreboard',      zone: 'playground', x: 0.62, basis: 'area', track: 1 },
  { idx: 16, count: 20, key: 'pgbunting',      name: 'Celebration Bunting', zone: 'playground', x: 0.46, basis: 'area', track: 2 },

  { idx: 17, count: 5,  key: 'photobooth',     name: 'A Photo Booth',     zone: 'funfair',   x: 0.30, basis: 'area', track: 0 },
  { idx: 18, count: 12, key: 'fairlights',     name: 'Extra Fair Lights', zone: 'funfair',   x: 0.58, basis: 'area', track: 1, night: true },
  { idx: 19, count: 20, key: 'fairarch',       name: 'The Fair Arch',     zone: 'funfair',   x: 0.14, basis: 'area', track: 2 }
];
// The five areas that gained a track, and how many milestones each has — so the world map can
// ask "is this track finished?" without knowing anything about the table's shape.
export const TRACK_AREAS = ['riverside', 'hilltop', 'beach', 'playground', 'funfair'];
export const TRACK_LENGTH = 3;
// The authored reveal headline for the new tracks. The area names and several milestone names
// carry their own article, so it is stripped where the sentence already supplies one — writing
// it literally ships "finished the A Little Cairn!".
const bare = (s) => String(s || '').replace(/^(The|A|An)\s+/i, '');
export function builderHeadline(m) { return `The Boo Builders finished the ${bare(m.name)}!`; }
export function grownHeadline(areaName) { return `Look how the ${bare(areaName)} has grown!`; }
export const BUILD_MS = 24 * 60 * 60 * 1000;   // the Builders take 24 real hours

// Test hook mirrors requests.js: window.__bootownNow overrides the clock.
export function nowMs() {
  if (typeof window !== 'undefined' && window.__bootownNow != null) return +window.__bootownNow;
  return Date.now();
}

export function uniqueBoosOwned(s = getState()) {
  if (!s) return 0;
  const cat = COLLECTIBLES.filter(it => it.kind === 'boo' && (s.inventory[it.id] || 0) > 0).length;
  const customs = (s.customs || []).filter(c => c.won).length;
  return cat + customs;
}

function growthState(s) {
  const g = s.townGrowth || {};
  // `catchup` is ADDITIVE with a safe default (RUN21E-15), mirroring funfairState's own field.
  return { done: g.done || [], pending: g.pending || [], site: g.site || null, catchup: g.catchup || [] };
}
// How many things she has put down in an area. RUN21E-15's tracks count this instead of Boos.
export function areaItemCount(s, zone) {
  const a = s && s.town && s.town.areas && s.town.areas[zone];
  return (a && Array.isArray(a.items)) ? a.items.length : 0;
}
// The measure a milestone is judged by.
function reachedCount(s, m) {
  return m.basis === 'area' ? areaItemCount(s, m.zone) : uniqueBoosOwned(s);
}

// Advance the growth machine. Call on hub open, town open, and after a box
// ceremony. Spawns queued sites and completes builds whose 24h have passed
// (completion is time-based, never attendance-based). Returns what changed:
// { spawned: [milestone...], readyToReveal: milestone|null }.
export function tickGrowth() {
  const s = getState();
  if (!s) return { spawned: [], readyToReveal: null, catchup: [] };
  const g = growthState(s);
  const spawned = [];
  // queue every crossed milestone not yet handled (they build one at a time)
  for (const m of GROWTH_MILESTONES) {
    if (reachedCount(s, m) < m.count) continue;
    if (g.done.includes(m.idx) || g.pending.includes(m.idx) || (g.site && g.site.idx === m.idx)
        || g.catchup.includes(m.idx)) continue;
    g.pending.push(m.idx);
    spawned.push(m);
  }
  // RUN21E-15 — THE MULTI-CROSS RULE (RUN21A item 16, ported from the funfair machine, which
  // is the only place it existed). When SEVERAL milestones of ONE AREA cross at once — which a
  // rich save does the first time it loads after this ships, and which a Builders queue would
  // otherwise dribble out one 24-hour build at a time — they complete immediately and wait for
  // that area's own mount to celebrate together, in ONE combined reveal. Single crossings keep
  // the ordinary 24-hour Builders flow, because watching them build is the point of it.
  const byZone = {};
  for (const m of spawned) { if (m.basis === 'area') (byZone[m.zone] = byZone[m.zone] || []).push(m); }
  for (const zone of Object.keys(byZone)) {
    if (byZone[zone].length < 2) continue;
    for (const m of byZone[zone]) {
      const at = g.pending.indexOf(m.idx);
      if (at >= 0) g.pending.splice(at, 1);
      if (!g.done.includes(m.idx)) g.done.push(m.idx);
      if (!g.catchup.includes(m.idx)) g.catchup.push(m.idx);
    }
  }
  // start the next site if the builders are free
  if (!g.site && g.pending.length) {
    g.site = { idx: g.pending.shift(), startedAt: nowMs() };
  }
  const readyToReveal = (g.site && nowMs() - g.site.startedAt >= BUILD_MS)
    ? GROWTH_MILESTONES[g.site.idx] : null;
  mutate(st => { st.townGrowth = { done: g.done, pending: g.pending, site: g.site, catchup: g.catchup }; });
  return { spawned, readyToReveal, catchup: g.catchup.map(i => GROWTH_MILESTONES[i]).filter(Boolean) };
}
// The milestones waiting to be celebrated together in `zone` (RUN21E-15).
export function catchupFor(zone) {
  const g = growthState(getState() || {});
  return g.catchup.map(i => GROWTH_MILESTONES[i]).filter(m => m && m.zone === zone);
}
// …and clearing them once that celebration has played.
export function completeCatchup(zone) {
  mutate(st => {
    const g = st.townGrowth || { done: [], pending: [], site: null, catchup: [] };
    g.catchup = (g.catchup || []).filter(i => !GROWTH_MILESTONES[i] || GROWTH_MILESTONES[i].zone !== zone);
    st.townGrowth = g;
  });
}
// Is this area's whole three-milestone track finished? (The world map draws a ribbon.)
export function trackComplete(zone, s = getState()) {
  const g = growthState(s || {});
  const track = GROWTH_MILESTONES.filter(m => m.basis === 'area' && m.zone === zone);
  return track.length > 0 && track.every(m => g.done.includes(m.idx));
}

// The town calls this when it plays the reveal ceremony: the finished upgrade
// joins `done`, the Journal gets its stamp, and the next queued site starts.
export function completeReveal(idx) {
  mutate(st => {
    const g = st.townGrowth || { done: [], pending: [], site: null, catchup: [] };
    if (g.site && g.site.idx === idx) g.site = null;
    if (!g.done.includes(idx)) g.done.push(idx);
    if (!g.site && g.pending.length) g.site = { idx: g.pending.shift(), startedAt: nowMs() };
    st.townGrowth = g;
  });
  stampJournal('growth_' + GROWTH_MILESTONES[idx].key);
}

// What the town should draw right now.
export function growthView() {
  const s = getState();
  const g = growthState(s || {});
  return {
    upgrades: GROWTH_MILESTONES.filter(m => g.done.includes(m.idx)),
    site: g.site ? GROWTH_MILESTONES[g.site.idx] : null
  };
}
// Everything finished in one area — what that area's scene should be drawing (RUN21E-15).
export function upgradesIn(zone, s = getState()) {
  const g = growthState(s || {});
  return GROWTH_MILESTONES.filter(m => m.zone === zone && g.done.includes(m.idx));
}
