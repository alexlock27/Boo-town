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
export const GROWTH_MILESTONES = [
  { idx: 0, count: 5,  key: 'wildflowers', name: 'Wildflowers',         zone: 'meadow', x: 0.28 },
  { idx: 1, count: 10, key: 'fairylights', name: 'Fairy lights',        zone: 'meadow', x: 0.58 },
  { idx: 2, count: 15, key: 'fountain',    name: 'A little fountain',   zone: 'meadow', x: 0.46 },
  { idx: 3, count: 20, key: 'paving',      name: 'Pretty paving',       zone: 'meadow', x: 0.72 },
  { idx: 4, count: 25, key: 'banner',      name: 'Celebration bunting', zone: 'meadow', x: 0.40 }
];
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
  return { done: g.done || [], pending: g.pending || [], site: g.site || null };
}

// Advance the growth machine. Call on hub open, town open, and after a box
// ceremony. Spawns queued sites and completes builds whose 24h have passed
// (completion is time-based, never attendance-based). Returns what changed:
// { spawned: [milestone...], readyToReveal: milestone|null }.
export function tickGrowth() {
  const s = getState();
  if (!s) return { spawned: [], readyToReveal: null };
  const owned = uniqueBoosOwned(s);
  const g = growthState(s);
  const spawned = [];
  // queue every crossed milestone not yet handled (they build one at a time)
  for (const m of GROWTH_MILESTONES) {
    if (owned < m.count) continue;
    if (g.done.includes(m.idx) || g.pending.includes(m.idx) || (g.site && g.site.idx === m.idx)) continue;
    g.pending.push(m.idx);
    spawned.push(m);
  }
  // start the next site if the builders are free
  if (!g.site && g.pending.length) {
    g.site = { idx: g.pending.shift(), startedAt: nowMs() };
  }
  const readyToReveal = (g.site && nowMs() - g.site.startedAt >= BUILD_MS)
    ? GROWTH_MILESTONES[g.site.idx] : null;
  mutate(st => { st.townGrowth = { done: g.done, pending: g.pending, site: g.site }; });
  return { spawned, readyToReveal };
}

// The town calls this when it plays the reveal ceremony: the finished upgrade
// joins `done`, the Journal gets its stamp, and the next queued site starts.
export function completeReveal(idx) {
  mutate(st => {
    const g = st.townGrowth || { done: [], pending: [], site: null };
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
