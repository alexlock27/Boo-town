// js/wishlife.js — the wish behaviour CLASSES (RUN20 W1).
//
// data/wishlife.js says which class each of the sixty wishes gets and with what parameters;
// this file is the machinery those classes share. Sixty behaviours implemented sixty times
// would be sixty bugs, so there are nine implementations and one table.
//
// Everything here obeys the same three rules:
//   · transform-only animation, with a reduced-motion path that renders a STATIC pose and
//     keeps the tap verb (a wish you can still poke is not "off", it is calm);
//   · caps: one sound per item per SOUND_GAP_MS, one wish sound per area per
//     AREA_SOUND_GAP_MS with tap-triggered beating ambient, and each spoken line at its cap;
//   · flyers and roamers count toward the existing per-area actor cap — a full cap parks a
//     new roamer with idle blinks rather than despawning it or throwing.
//
// The town owns the DOM and the actor loop; this module owns the decisions.

import { lifeFor, classOf, SKY_BAND, SKY_DRIFT_X, SKY_DRIFT_MS, SOUND_GAP_MS, AREA_SOUND_GAP_MS, isOutdoorOnly } from '../data/wishlife.js';

export const wordOfWishId = (id) => (typeof id === 'string' && id.startsWith('wish_')) ? id.slice(5) : null;
export const isWish = (id) => !!wordOfWishId(id);
export const wishClass = (id) => { const w = wordOfWishId(id); return w ? classOf(w) : null; };
export const wishLife = (id) => { const w = wordOfWishId(id); return w ? lifeFor(w) : null; };
export const wishNeedsSky = (id) => { const w = wordOfWishId(id); return !!w && isOutdoorOnly(w); };

// ---- the sound budget ------------------------------------------------------------------
// One limiter for the whole area, plus a per-item one. Tap-triggered sounds beat ambient ones,
// because a sound she asked for by touching something must never be swallowed by a bee.
export function createSoundBudget(now = () => performance.now()) {
  let lastArea = -Infinity;
  const lastItem = new Map();
  return {
    // `key` identifies the item; `tapped` marks a sound the child asked for.
    allow(key, { tapped = false } = {}) {
      const t = now();
      if (t - (lastItem.get(key) || -Infinity) < SOUND_GAP_MS) return false;
      if (!tapped && t - lastArea < AREA_SOUND_GAP_MS) return false;
      lastArea = t; lastItem.set(key, t);
      return true;
    },
    reset() { lastArea = -Infinity; lastItem.clear(); }
  };
}

// ---- a line cap ------------------------------------------------------------------------
// "capped once per session" / "once per visit" / "once per day", in one place. Module-level
// session state, like js/ack.js and js/encouragement.js — nothing about how often a wish has
// spoken is ever written to the save.
const saidSession = new Set();
let visitToken = 0;
const saidVisit = new Set();
export function newVisit() { visitToken++; saidVisit.clear(); }
export function resetWishLines() { saidSession.clear(); saidVisit.clear(); visitToken = 0; }
export function maydaySay(key, scope = 'session') {
  const bag = scope === 'visit' ? saidVisit : saidSession;
  const k = scope === 'visit' ? `${visitToken}:${key}` : key;
  if (bag.has(k)) return false;
  bag.add(k);
  return true;
}

// ---- SKY -------------------------------------------------------------------------------
// A sky item is anchored in the band by FRACTION of viewport height, not by a ground row, and
// drifts ±SKY_DRIFT_X over SKY_DRIFT_MS. Deterministic per placement so it does not jump
// between renders: two suns at different x sit at different heights and stay there.
export function skyYFor(placement) {
  const seed = Math.abs(Math.round((Number(placement && placement.x) || 0) * 1000));
  const t = (seed % 100) / 100;
  return SKY_BAND.top + t * (SKY_BAND.bottom - SKY_BAND.top);
}
export function skyDriftX(placement, nowMs, reduced) {
  if (reduced) return 0;
  const life = wishLife(placement && placement.item) || {};
  const period = life.fullLoop ? (life.period || SKY_DRIFT_MS) : SKY_DRIFT_MS;
  const phase = (Math.abs(Math.round((Number(placement && placement.x) || 0) * 1000)) % 100) / 100;
  const a = ((nowMs / period) + phase) % 1;
  return life.fullLoop ? a : Math.sin(a * Math.PI * 2) * SKY_DRIFT_X;
}

// ---- which day band are we in ------------------------------------------------------------
export function bandOfHour(h) {
  if (h >= 6 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'dusk';
  return 'night';
}
// Some wishes only do their thing in certain bands (the moon glows, the owl hoots, a torch's
// cone is only visible when there is something for it to light).
export function bandAllows(id, hour) {
  const life = wishLife(id);
  if (!life || !life.bands) return true;
  return life.bands.includes(bandOfHour(hour));
}

// ---- the actor cap -----------------------------------------------------------------------
// A flyer or roamer placed when the per-area cap is full does NOT despawn and does NOT throw —
// it stands still and blinks until a slot frees. Losing a thing she wished for would be the
// worst possible failure mode here.
export function actorSlotFor(liveCount, cap) { return liveCount < cap ? 'live' : 'parked'; }

// ---- FOOD --------------------------------------------------------------------------------
// A tap sends the NEAREST Boo over for a chomp; a chef-costumed Boo gets priority and says so.
// Returns the chosen Boo id, or null when there is nobody in the area — the caller then does
// the small hop and Twiggy's once-per-session whisper rather than nothing at all.
export function chooseDiner(boos, itemX, chefOf) {
  if (!boos || !boos.length) return null;
  const chefs = boos.filter(b => chefOf && chefOf(b.id));
  const pool = chefs.length ? chefs : boos;
  let best = null, bestD = Infinity;
  for (const b of pool) {
    const d = Math.abs((Number(b.x) || 0) - (Number(itemX) || 0));
    if (d < bestD) { bestD = d; best = b; }
  }
  return best ? { id: best.id, chef: chefs.length > 0 } : null;
}

// ---- the ladder's "tall thing" ------------------------------------------------------------
// "tall" = tree, palm, castle, wishwell, slide, or an indoor wall (W1 addendum). With none in
// the area the ladder still has a verb — a Boo climbs two rungs, wobbles and hops off — because
// a tap that does nothing is the exact defect this whole run exists to remove.
export function tallestNear(items, x, indoors) {
  const TALL = ['deco_tree', 'deco_palm', 'deco_oak', 'deco_pine', 'wish_tree', 'wish_palm', 'wish_castle', 'deco_wishwell', 'deco_slide', 'wish_slide'];
  const near = (items || []).filter(t => TALL.includes(t.item));
  if (!near.length) return indoors ? { item: 'wall', x } : null;
  near.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x));
  return near[0];
}

// ---- the crown ----------------------------------------------------------------------------
// {booId: dayStamp} in delights; renders above any worn hat (comically stacked is correct);
// expires at local midnight; a second crown-tap the same day re-crowns a DIFFERENT Boo and the
// first uncrowns with a tiny huff.
export function crownPick(boos, currentlyCrowned) {
  if (!boos || !boos.length) return null;
  const others = boos.filter(b => b.id !== currentlyCrowned);
  const pool = others.length ? others : boos;
  return pool[0].id;
}
