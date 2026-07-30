// js/cameo.js — personality cameos (RUN19 Z5 "wire the nouns").
//
// Boo Town has had stable per-Boo temperaments since RUN10 P5 (data/personalities.js, hashed
// from each Boo's own id) and they have only ever mattered inside the town. Z5 makes two of
// them show up in the GAMES: a MUSICAL Boo claps along on the Boo Beat stage rail, and a
// SPORTY one jogs the far parallax layer in Boo Dash.
//
// Pure presentation. No mechanics, no reward, no score. If she owns no Boo of that
// temperament there is NO cameo and NO placeholder — an empty perch would be worse than
// nothing, and a stand-in Boo would be a lie about who lives in her town.
//
// Both games ask this one module rather than reimplementing the pick, so "the first owned
// MUSICAL Boo by catalogue order" means the same thing in both places.

import { getState } from './state.js';
import { COLLECTIBLES } from '../data/catalogue.js';
import { resolveItem } from './customs.js';
import { personalityOf } from '../data/personalities.js';

// The first owned Boo of a temperament, in CATALOGUE order (the pack's tie-break — it is
// stable across sessions, unlike inventory-key order, so the same Boo keeps the job).
export function cameoBoo(personality) {
  const s = getState();
  if (!s || !s.inventory) return null;
  for (const item of COLLECTIBLES) {
    if (item.kind !== 'boo') continue;
    if (!(s.inventory[item.id] > 0)) continue;
    if (personalityOf(item.id) !== personality) continue;
    return resolveItem(item.id) || item;
  }
  return null;
}
export const musicalCameo = () => cameoBoo('musical');
export const sportyCameo = () => cameoBoo('sporty');
