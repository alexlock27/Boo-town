// js/delights.js — daily delights (RUN4 C9): hide-and-seek Boo + Boo of the Day.
// No reminders, no streaks (rules 1 and 2): an unfound hider simply carries to
// tomorrow, and everything here is pure decoration or a tiny one-tap treat.

import { getState, mutate, todayKey } from './state.js';
import { BY_ID } from '../data/catalogue.js';
import { resolveItem } from './customs.js';
import { flattenTownItems } from './areas.js';
import { HIDE_POINTS } from '../data/sockets.js';

export const HIDE_REWARD = 2;   // meter points for spotting the hider (C9)

const isBooItem = (id) => id && (id.startsWith('boo_') || id.startsWith('custom:'));
// A guaranteed anchor when nothing hide-capable is placed anywhere yet (RUN10 P5) — the
// Meadow's own permanent oak, so hide-and-seek never has zero candidates on a fresh save.
export const MEADOW_OAK_FALLBACK = { zone: 'meadow', x: 0.15, item: 'deco_oak' };

// ---- hide-and-seek Boo (2.0, RUN10 P5) -------------------------------------------
// Once per local day one owned PLACED Boo hides at a specific hidePoint (data/sockets.js
// HIDE_POINTS) on a placed hide-capable item, spread across every area — not just the
// one she's currently looking at. Carries over if unfound; no new hider until found.
export function ensureHide() {
  const s = getState();
  if (!s) return null;
  const d = s.delights || {};
  const day = todayKey();
  const all = flattenTownItems(s);
  const boos = all.filter(t => isBooItem(t.item));
  const hideSpots = all.filter(t => HIDE_POINTS[t.item]);
  if (!boos.length) return currentHide();   // needs at least a Boo to hide
  const isFallback = (spot) => spot && spot.item === MEADOW_OAK_FALLBACK.item && spot.zone === MEADOW_OAK_FALLBACK.zone && spot.x === MEADOW_OAK_FALLBACK.x;
  const hiderStillPlaced = d.hideBoo && boos.some(t => t.item === d.hideBoo);
  const spotStillValid = d.hideSpot && (isFallback(d.hideSpot) || hideSpots.some(t => t.item === d.hideSpot.item && t.zone === d.hideSpot.zone && t.x === d.hideSpot.x));
  if (d.hideDay && !d.hideFound && hiderStillPlaced && spotStillValid) {
    return currentHide();   // unfound simply carries to tomorrow (rule 1)
  }
  if (d.hideDay === day && d.hideFound) return null;   // found today — see you tomorrow
  // pick a fresh hider + a hide-capable spot to peek from
  const boo = boos[(Math.random() * boos.length) | 0];
  const spot = hideSpots.length ? hideSpots[(Math.random() * hideSpots.length) | 0] : MEADOW_OAK_FALLBACK;
  mutate(st => {
    st.delights = st.delights || {};
    st.delights.hideDay = day;
    st.delights.hideFound = false;
    st.delights.hideBoo = boo.item;
    st.delights.hideSpot = { zone: spot.zone, x: spot.x, item: spot.item };
  });
  return currentHide();
}
export function currentHide() {
  const s = getState();
  const d = (s && s.delights) || {};
  if (!d.hideDay || d.hideFound || !d.hideBoo || !d.hideSpot) return null;
  return { boo: d.hideBoo, spot: d.hideSpot };
}
// Returns true when this tap found the hider (the caller pays the meter + giggle).
export function foundHide() {
  const s = getState();
  const d = (s && s.delights) || {};
  if (!d.hideDay || d.hideFound) return false;
  mutate(st => { st.delights.hideFound = true; st.delights.hideDay = todayKey(); });
  return true;
}

// ---- Boo of the Day --------------------------------------------------------------
// Deterministic per local day (rotates at local midnight), needs no stored state.
// Copes gracefully with zero owned accessories (she just wears nothing).
function dayHash(str) { let h = 0; for (const c of str) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return Math.abs(h); }
export function booOfTheDay() {
  const s = getState();
  if (!s) return null;
  const owned = Object.keys(s.inventory || {}).filter(id => (s.inventory[id] || 0) > 0 && id.startsWith('boo_') && BY_ID[id]);
  const customs = (s.customs || []).filter(c => c.won).map(c => 'custom:' + c.id);
  const all = [...owned, ...customs];
  if (!all.length) return null;
  const day = todayKey();
  const id = all[dayHash(day) % all.length];
  const accs = Object.keys(s.inventory || {}).filter(a => (s.inventory[a] || 0) > 0 && a.startsWith('acc_'));
  const acc = accs.length ? accs[dayHash(day + id) % accs.length] : null;
  const item = resolveItem(id);
  return item ? { id, item, acc, accArt: acc && BY_ID[acc] ? BY_ID[acc].art : null } : null;
}
