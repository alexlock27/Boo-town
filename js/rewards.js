// js/rewards.js — stars → meter → boxes → drops (spec §9.1, §9.2).
// Tunable pacing constants are named so they can be adjusted later.

import { mutate, getState } from './state.js';
import { BY_TYPE_RARITY, BY_ID, RARITY_WEIGHTS } from '../data/catalogue.js';
import { rollShiny, addShinyCopy } from './shiny.js';

export const METER_CAP = 6;          // meter holds 6 points
export const THREE_STAR_BONUS = 1;   // a perfect round banks 4 (3 + 1)
export const DUPLICATE_POINTS = 2;   // a duplicate converts to +2 meter points
export const PITY_THRESHOLD = 8;     // 8 straight Commons forces Rare or better
export const SECRET_MIN_OWNED = 10;  // Secret can only drop after owning 10+ items

// Type-first roll (RUN2 C2): Boo 70%, decoration 15%, accessory 15%.
// Accessories never drop until at least 3 Boos are owned.
export const TYPE_WEIGHTS = { boo: 70, deco: 15, accessory: 15 };
export const ACCESSORY_MIN_BOOS = 3;
export const CUSTOM_SLICE = 0.10;    // sealed customs claim a 10% type slice while any remain unwon (RUN3 C6)

// Convert a round's stars into meter points and bank any boxes.
// Returns { pointsAdded, boxesEarned, meter, boxes }.
export function bankStars(stars) {
  return addMeterPoints(stars + (stars >= 3 ? THREE_STAR_BONUS : 0));
}

// Add raw meter points (e.g. Tricky Pile rescues +1 each, Golden bonus), banking boxes on overflow.
export function addMeterPoints(points) {
  let boxesEarned = 0, meter, boxes;
  mutate(s => {
    s.meter += points;
    while (s.meter >= METER_CAP) { s.meter -= METER_CAP; s.boxes += 1; boxesEarned += 1; }
    meter = s.meter; boxes = s.boxes;
  });
  return { pointsAdded: points, boxesEarned, meter, boxes };
}

function totalOwned(s) {
  return Object.values(s.inventory).reduce((a, b) => a + b, 0);
}
function boosOwned(s) {
  return Object.keys(s.inventory).filter(id => s.inventory[id] > 0 && BY_ID[id] && BY_ID[id].kind === 'boo').length;
}

function weightedPick(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(weights)) {
    if ((r -= w) < 0) return k;
  }
  return Object.keys(weights)[0];
}

// Pick the item type first, then rarity within that type.
function rollType(s) {
  const w = { boo: TYPE_WEIGHTS.boo, deco: TYPE_WEIGHTS.deco,
              accessory: boosOwned(s) >= ACCESSORY_MIN_BOOS ? TYPE_WEIGHTS.accessory : 0 };
  return weightedPick(w);
}

function rollRarity(s) {
  let rarity;
  if (s.pity.commons >= PITY_THRESHOLD) {
    rarity = weightedPick({ rare: RARITY_WEIGHTS.rare, ultra: RARITY_WEIGHTS.ultra, secret: RARITY_WEIGHTS.secret });
  } else {
    rarity = weightedPick(RARITY_WEIGHTS);
  }
  if (rarity === 'secret' && totalOwned(s) < SECRET_MIN_OWNED) rarity = 'ultra';
  return rarity;
}

// ---- seasonal gating (EXPANSION_1 §4) ----
// Seasonal items only drop during their window (device date). Core items drop all year.
export function currentMonth() {
  if (typeof window !== 'undefined' && window.__bootownMonth != null) return window.__bootownMonth | 0;
  try { return new Date().getMonth() + 1; } catch { return 1; }
}
export function seasonOf(month) {
  if (month >= 6 && month <= 8) return 'summer';
  if (month === 10) return 'spooky';
  if (month === 12 || month === 1) return 'winter';
  return null;
}
export function inSeason(item) { return !item.season || item.season === seasonOf(currentMonth()); }

// Pick an item of a given type + rolled rarity; fall back within the type if a rarity
// has no (in-season) items of that type (e.g. decorations/accessories have no Secret).
function pickItem(type, rarity) {
  const byRar = BY_TYPE_RARITY[type] || {};
  let pool = (byRar[rarity] || []).filter(inSeason);
  if (!pool.length) {
    // step down to the nearest available in-season rarity of this type
    const order = ['secret', 'ultra', 'rare', 'common'];
    for (const r of order) { const p = (byRar[r] || []).filter(inSeason); if (p.length) { pool = p; rarity = r; break; } }
  }
  return { item: pool[(Math.random() * pool.length) | 0], rarity };
}

// Open one banked box: decrement boxes, roll a drop, apply it.
// Returns { item, rarity, duplicate, bonusPoints, extraBoxes, meter, boxes } or null if none.
export function openOneBox() {
  const s = getState();
  if (!s || s.boxes <= 0) return null;
  let result = null;
  mutate(st => {
    st.boxes -= 1;

    // Sealed customs claim a 10% slice while any remain unwon (RUN3 C6).
    const unwon = (st.customs || []).filter(c => c.sealed && !c.won);
    const forced = typeof window !== 'undefined' && window.__forceCustomDrop;   // test-only
    let item, rarity, isCustom = false;
    if (unwon.length && (forced || Math.random() < CUSTOM_SLICE)) {
      if (forced && typeof window !== 'undefined') window.__forceCustomDrop = false;
      const c = unwon[Math.floor(Math.random() * unwon.length)];
      c.won = true; c.wonAt = Date.now();
      item = { id: 'custom:' + c.id, kind: 'boo', name: c.name, custom: c.parts, rarity: 'custom', blurb: 'A Boo you built yourself!' };
      rarity = 'custom'; isCustom = true;
      st.pity.commons = 0;   // a custom is not a common
    } else {
      const type = rollType(st);
      const rolled = rollRarity(st);
      const picked = pickItem(type, rolled);
      item = picked.item; rarity = picked.rarity;
      if (rarity === 'common') st.pity.commons += 1; else st.pity.commons = 0;
    }

    const had = st.inventory[item.id] || 0;
    const duplicate = had > 0;
    st.inventory[item.id] = had + 1;
    st.opened += 1;

    // Shiny roll (RUN4 C8): any Boo drop can arrive shiny (1 in 15, with the
    // hidden 25-drop mercy). Per-copy: tracked in st.shinies alongside the stack.
    var shiny = false;
    if (item.kind === 'boo') shiny = rollShiny();

    let bonusPoints = 0, extraBoxes = 0;
    if (duplicate) {
      bonusPoints = DUPLICATE_POINTS;
      st.meter += DUPLICATE_POINTS;
      while (st.meter >= METER_CAP) { st.meter -= METER_CAP; st.boxes += 1; extraBoxes += 1; }
    }
    result = { item, rarity, duplicate, isCustom, shiny, bonusPoints, extraBoxes, meter: st.meter, boxes: st.boxes };
  });
  if (result && result.shiny) addShinyCopy(result.item.id);
  return result;
}

export function meterState() {
  const s = getState();
  return { meter: s ? s.meter : 0, cap: METER_CAP, boxes: s ? s.boxes : 0 };
}

// Grant a specific item directly (used for the onboarding free box in M2).
export function grantItem(id) {
  mutate(s => { s.inventory[id] = (s.inventory[id] || 0) + 1; s.opened += 1; });
}
