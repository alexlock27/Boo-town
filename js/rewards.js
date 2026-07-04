// js/rewards.js — stars → meter → boxes → drops (spec §9.1, §9.2).
// Tunable pacing constants are named so they can be adjusted later.

import { mutate, getState } from './state.js';
import { BY_RARITY, RARITY_WEIGHTS } from '../data/catalogue.js';

export const METER_CAP = 6;          // meter holds 6 points
export const THREE_STAR_BONUS = 1;   // a perfect round banks 4 (3 + 1)
export const DUPLICATE_POINTS = 2;   // a duplicate converts to +2 meter points
export const PITY_THRESHOLD = 8;     // 8 straight Commons forces Rare or better
export const SECRET_MIN_OWNED = 10;  // Secret can only drop after owning 10+ items

// Convert a round's stars into meter points and bank any boxes.
// Returns { pointsAdded, boxesEarned, meter, boxes }.
export function bankStars(stars) {
  const points = stars + (stars >= 3 ? THREE_STAR_BONUS : 0);
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

function weightedPick(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [k, w] of Object.entries(weights)) {
    if ((r -= w) < 0) return k;
  }
  return Object.keys(weights)[0];
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

// Open one banked box: decrement boxes, roll a drop, apply it.
// Returns { item, rarity, duplicate, bonusPoints, extraBoxes, meter, boxes } or null if none.
export function openOneBox() {
  const s = getState();
  if (!s || s.boxes <= 0) return null;
  let result = null;
  mutate(st => {
    st.boxes -= 1;
    const rarity = rollRarity(st);
    const pool = BY_RARITY[rarity];
    const item = pool[(Math.random() * pool.length) | 0];

    // pity bookkeeping
    if (rarity === 'common') st.pity.commons += 1; else st.pity.commons = 0;

    const had = st.inventory[item.id] || 0;
    const duplicate = had > 0;
    st.inventory[item.id] = had + 1;
    st.opened += 1;

    let bonusPoints = 0, extraBoxes = 0;
    if (duplicate) {
      bonusPoints = DUPLICATE_POINTS;
      st.meter += DUPLICATE_POINTS;
      while (st.meter >= METER_CAP) { st.meter -= METER_CAP; st.boxes += 1; extraBoxes += 1; }
    }
    result = { item, rarity, duplicate, bonusPoints, extraBoxes, meter: st.meter, boxes: st.boxes };
  });
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
