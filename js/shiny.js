// js/shiny.js — shiny Boos + the Star Chest (RUN4 C8): the odds, the mercy rule
// and the chest boundary maths live here; rendering hooks live in art/ceremony.
// Total stars gain a second visible purpose: every 50 stars, a golden chest.

import { getState, mutate } from './state.js';
import { BY_TYPE_RARITY, BY_ID } from '../data/catalogue.js';

// Named constants (C8).
export const SHINY_ODDS = 1 / 15;      // 1 in 15 per Boo drop
export const SHINY_MERCY = 25;         // hidden: guaranteed shiny within every 25 Boo drops
export const CHEST_EVERY = 50;         // a Star Chest every 50 total stars
export const CHEST_SHINY_MULT = 3;     // chest Boos roll shiny at triple odds

// Roll shininess for one Boo drop (call ONLY for Boo drops). Tracks the hidden
// mercy counter; a natural or mercy shiny resets it. Returns true if shiny.
export function rollShiny({ mult = 1 } = {}) {
  const s = getState();
  if (!s) return false;
  const drops = (s.shinyDrops || 0) + 1;
  const forced = typeof window !== 'undefined' && window.__forceShiny != null ? !!window.__forceShiny : null;
  const natural = forced != null ? forced : Math.random() < SHINY_ODDS * mult;
  const mercy = !natural && forced == null && drops >= SHINY_MERCY;
  const shiny = natural || mercy;
  mutate(st => { st.shinyDrops = shiny ? 0 : drops; });
  if (forced != null && typeof window !== 'undefined') window.__forceShiny = null;
  return shiny;
}

// Record a shiny copy of an item (per-copy tracking within the owned stack).
export function addShinyCopy(itemId) {
  mutate(st => { st.shinies = st.shinies || {}; st.shinies[itemId] = (st.shinies[itemId] || 0) + 1; });
}
export function shinyCountOf(itemId) { const s = getState(); return (s && s.shinies && s.shinies[itemId]) || 0; }
export function totalShinies() { const s = getState(); return Object.values((s && s.shinies) || {}).reduce((a, b) => a + b, 0); }

// ---- the Star Chest -----------------------------------------------------------
// Boundaries are measured from the migration anchor (no back-pay, C8): one chest
// per CHEST_EVERY stars earned past the anchor, plus the one welcome chest for
// migrated saves. The mini progress track ties to the visible star total.
export function chestState() {
  const s = getState();
  if (!s) return { ready: false, welcome: false, progress: 0, toNext: CHEST_EVERY };
  const chest = s.chest || { anchor: 0, opened: 0, welcome: false };
  const earned = Math.max(0, Math.floor((s.stars.total - chest.anchor) / CHEST_EVERY));
  const ready = chest.welcome || earned > chest.opened;
  const into = Math.max(0, (s.stars.total - chest.anchor) - chest.opened * CHEST_EVERY);
  return {
    ready,
    welcome: chest.welcome,
    progress: Math.min(into, CHEST_EVERY),
    toNext: Math.max(0, CHEST_EVERY - into),
    earned, opened: chest.opened
  };
}

// Open the chest: guarantees one Boo of Rare or better (at triple shiny odds)
// plus one accessory. Normal boxes are unchanged — this is pure bonus on top.
export function openChest() {
  const s = getState();
  const st8 = chestState();
  if (!st8.ready) return null;
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const boosByRar = BY_TYPE_RARITY.boo || {};
  // respect seasonal gating like normal boxes
  const inSeason = (it) => { if (!it.season) return true; const m = (typeof window !== 'undefined' && window.__bootownMonth != null) ? +window.__bootownMonth : (new Date().getMonth() + 1); const se = m >= 6 && m <= 8 ? 'summer' : m === 10 ? 'spooky' : (m === 12 || m === 1) ? 'winter' : null; return it.season === se; };
  const rarity = weighted([['rare', 70], ['ultra', 27], ['secret', 3]]);
  let pool = (boosByRar[rarity] || []).filter(inSeason);
  if (!pool.length) pool = (boosByRar.rare || []).filter(inSeason);
  const boo = pick(pool);
  const shiny = rollShiny({ mult: CHEST_SHINY_MULT });
  const accPool = [...((BY_TYPE_RARITY.accessory || {}).common || []), ...((BY_TYPE_RARITY.accessory || {}).rare || []), ...((BY_TYPE_RARITY.accessory || {}).ultra || [])];
  const acc = pick(accPool);
  mutate(stx => {
    if (stx.chest.welcome) stx.chest.welcome = false;
    else stx.chest.opened += 1;
    stx.inventory[boo.id] = (stx.inventory[boo.id] || 0) + 1;
    stx.inventory[acc.id] = (stx.inventory[acc.id] || 0) + 1;
    stx.opened += 1;
  });
  if (shiny) addShinyCopy(boo.id);
  const dupBoo = (getState().inventory[boo.id] || 0) > 1;
  return { boo, acc, shiny, dupBoo };
}
function weighted(pairs) {
  const total = pairs.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of pairs) { if ((r -= w) < 0) return k; }
  return pairs[0][0];
}
