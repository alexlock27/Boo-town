// js/delights.js — daily delights (RUN4 C9): hide-and-seek Boo + Boo of the Day.
// No reminders, no streaks (rules 1 and 2): an unfound hider simply carries to
// tomorrow, and everything here is pure decoration or a tiny one-tap treat.

import { getState, mutate, todayKey } from './state.js';
import { BY_ID } from '../data/catalogue.js';
import { resolveItem } from './customs.js';

export const HIDE_REWARD = 2;   // meter points for spotting the hider (C9)

const isBooItem = (id) => id && (id.startsWith('boo_') || id.startsWith('custom:'));

// ---- hide-and-seek Boo ---------------------------------------------------------
// Once per local day one owned PLACED Boo hides behind town scenery. Carries over
// if unfound; no new hider until yesterday's is found.
export function ensureHide() {
  const s = getState();
  if (!s) return null;
  const d = s.delights || {};
  const day = todayKey();
  const boos = (s.town || []).filter(t => isBooItem(t.item));
  const scenery = (s.town || []).filter(t => !isBooItem(t.item));
  if (!boos.length || !scenery.length) return currentHide();   // needs a Boo and something to hide behind
  const hiderStillPlaced = d.hideBoo && boos.some(t => t.item === d.hideBoo);
  const spotStillPlaced = d.hideSpot && scenery.some(t => t.item === d.hideSpot.item && t.zone === d.hideSpot.zone);
  if (d.hideDay && !d.hideFound && hiderStillPlaced && spotStillPlaced) {
    return currentHide();   // unfound simply carries to tomorrow (rule 1)
  }
  if (d.hideDay === day && d.hideFound) return null;   // found today — see you tomorrow
  // pick a fresh hider + a scenery spot to peek from
  const boo = boos[(Math.random() * boos.length) | 0];
  const spot = scenery[(Math.random() * scenery.length) | 0];
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
  return item ? { id, item, acc } : null;
}
