// js/comfort.js — the reward rebalance brain (RUN4 C3): comfort levels, the Brave
// bonus and cosy rounds. Design principle (RUN4, permanent): total stars NEVER
// shrink — every honest round credits its full stars. Challenge is encouraged by
// paying a bonus on top (Brave), never by taking anything away; the cosy cap only
// trims BOX METER points on rounds that are both mastered and comfortably easy,
// and it stays silent apart from an upward nudge from the guide.

import { getState, mutate, todayKey, isMastered } from './state.js';
import { THREE_STAR_BONUS } from './rewards.js';

// Named constants (C3: every number is tunable).
export const COMFORT_3STAR_ROUNDS = 2;   // 3-star rounds at a level to call it comfy
export const BRAVE_BONUS = 1;            // extra meter point for a round above comfort
export const COSY_CAP = 2;               // max meter points for a cosy round
export const MASTERED_ROUND_FRAC = 0.8;  // >=80% of round items mastered = a mastered round
export const DEFAULT_COMFORT_RANK = 1;   // comfort defaults to Starter / Level 1

// Level ordering: Starter ('S'/'starter') < 1 < 2 < 3 …
export function levelRank(l) {
  if (l === 'S' || l === 'starter') return 0;
  const n = +l;
  return Number.isFinite(n) ? n : 0;
}
export function rankName(r) { return r <= 0 ? 'Starter' : 'Level ' + r; }

// Comfort level for a game category: the highest level rank with two or more
// lifetime 3-star rounds, else the default (Starter or Level 1).
export function comfortRank(game, cat) {
  const s = getState();
  const counts = (s && s.threeStars) || {};
  let best = DEFAULT_COMFORT_RANK;
  const prefix = `${game}:${cat}:`;
  for (const k of Object.keys(counts)) {
    if (!k.startsWith(prefix)) continue;
    const rank = +k.slice(prefix.length);
    if (Number.isFinite(rank) && counts[k] >= COMFORT_3STAR_ROUNDS && rank > best) best = rank;
  }
  return best;
}

// The friendliest Brave target for quest copy: one above the lowest comfort of
// anything she has 3-starred (default: one above Starter/Level 1).
export function braveTargetRank() {
  const s = getState();
  const counts = (s && s.threeStars) || {};
  const cats = new Set(Object.keys(counts).map(k => k.split(':').slice(0, 2).join(':')));
  let min = DEFAULT_COMFORT_RANK;
  for (const c of cats) {
    const i = c.indexOf(':');
    min = Math.min(min, comfortRank(c.slice(0, i), c.slice(i + 1)));
  }
  return min + 1;
}

// One Brave bonus per category per local day (C3). Returns true if newly claimed.
function claimBrave(game, cat) {
  const s = getState();
  const day = todayKey();
  const key = `${game}:${cat}`;
  if (s.brave && s.brave.day === day && s.brave.cats && s.brave.cats[key]) return false;
  mutate(st => {
    if (!st.brave || st.brave.day !== day) st.brave = { day, cats: {} };
    st.brave.cats[key] = true;
  });
  return true;
}

// A mastered round: >=80% of its (ledger-tracked) items are mastered.
export function isMasteredRound(roundKeys) {
  if (!roundKeys || !roundKeys.length) return false;
  const m = roundKeys.filter(k => isMastered(k)).length;
  return m / roundKeys.length >= MASTERED_ROUND_FRAC;
}

// The one meter formula (C3). Base points = stars (+ the existing 3-star bonus);
// a round above the category's comfort pays +BRAVE_BONUS (first per category per
// day); mastered rounds at/below comfort contribute at most COSY_CAP (a cosy
// round). Smart Mix / Pick for me / category-less rounds are always exempt from
// the cosy cap (the Golden Round is exempt upstream via meterOverride). extraCosy
// lets a game declare its own cosy condition (Boo Pop's Twin Pop tutorial, C7).
export function meterPointsFor({ game, cat, level, mix = false, stars = 1, roundKeys = [], extraCosy = false }) {
  const base = stars + (stars >= 3 ? THREE_STAR_BONUS : 0);
  const exempt = !!mix || !cat || level == null;
  let points = base, brave = false, cosy = false, above = false;
  const rank = levelRank(level);
  const comfort = exempt ? DEFAULT_COMFORT_RANK : comfortRank(game, cat);
  if (!exempt) {
    if (rank > comfort) {
      above = true;
      if (claimBrave(game, cat)) { brave = true; points += BRAVE_BONUS; }
    } else if (isMasteredRound(roundKeys) || extraCosy) {
      cosy = true;
      points = Math.min(points, COSY_CAP);
    }
    // 3-star rounds grow comfort at this level (never shown, never shrinks anything)
    if (stars >= 3) {
      mutate(st => {
        st.threeStars = st.threeStars || {};
        const k = `${game}:${cat}:${rank}`;
        st.threeStars[k] = (st.threeStars[k] || 0) + 1;
      });
    }
  } else if (extraCosy) {
    // a game-declared cosy round (tutorial replay) still caps, even category-less
    cosy = true;
    points = Math.min(points, COSY_CAP);
  }
  return { points, brave, cosy, above, comfort, rank, exempt };
}
