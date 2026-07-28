// js/smartmix.js — Smart Mix selection (RUN3 C2).
// Composes a round from a pool by the mistake ledger: 40% weak (missed more than got
// right, recent first), 40% level-appropriate not-yet-mastered, 20% mastered due a
// refresh (oldest lastSeen). Sound Twins sets and Tricky Sounds words get double weight
// while weak (via each pool item's `boost`). Smart Mix ALWAYS draws from all installed
// content — callers must pass the full pool, never a content-tier-filtered one.

import { ledgerClass, ledgerEntry } from './state.js';

const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Weighted sampling without replacement. weightOf(item) -> positive number.
function drawWeighted(items, k, weightOf, chosen, used) {
  const pool = items.filter(it => !used.has(it.id));
  for (let picked = 0; picked < k && pool.length; picked++) {
    const weights = pool.map(weightOf);
    let total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) { const it = pool.splice(rand(pool.length), 1)[0]; chosen.push(it); used.add(it.id); continue; }
    let r = Math.random() * total, idx = 0;
    while (idx < weights.length - 1 && r > weights[idx]) { r -= weights[idx]; idx++; }
    const it = pool.splice(idx, 1)[0];
    chosen.push(it); used.add(it.id);
  }
}

// pool: [{ id, boost?, ...payload }]. Returns up to n pool items (payload preserved).
export function buildSmartMix(pool, n = 8, opts = {}) {
  const classOf = opts.classOf || ((item) => ledgerClass(item.id));
  const weak = [], middle = [], mastered = [];
  for (const it of pool) { const c = classOf(it); (c === 'weak' ? weak : c === 'mastered' ? mastered : middle).push(it); }
  weak.sort((a, b) => ledgerEntry(b.id).lastSeen - ledgerEntry(a.id).lastSeen);       // weak: recent first
  mastered.sort((a, b) => ledgerEntry(a.id).lastSeen - ledgerEntry(b.id).lastSeen);   // mastered: oldest first (due a refresh)

  const wWeak = Math.round(n * 0.4);
  const wMastered = Math.round(n * 0.2);
  const wMiddle = n - wWeak - wMastered;

  const chosen = [], used = new Set();
  // weak weighted by boost (double weight for twins / th words while weak)
  drawWeighted(weak, wWeak, (it) => (it.boost || 1), chosen, used);
  // RUN18B Y9: the middle bucket honours `boost` too. It did not, and that quietly gutted the
  // Tricky Pile's whole point — an item she missed but has not yet missed MORE than she has
  // got right is 'middle', which is where most pile items sit, and there the boost was thrown
  // away. Within-bucket weighting only; the 40/40/20 split is untouched.
  drawWeighted(shuffle(middle.slice()), wMiddle, (it) => (it.boost || 1), chosen, used);
  drawWeighted(mastered, wMastered, () => 1, chosen, used);
  // backfill shortfalls (small pools / empty buckets): prefer middle -> weak -> mastered
  const rest = [...shuffle(middle.slice()), ...weak, ...mastered];
  drawWeighted(rest, n - chosen.length, (it) => (it.boost || 1), chosen, used);
  return chosen.slice(0, Math.min(n, pool.length));
}

// For generate-and-filter games (maths/arcade): a shuffled per-slot class plan with the
// 40/40/20 target. The game generates candidates each slot and matches the class, drawing
// from ALL its categories, with graceful fallback when a class has no available items.
export function mixPlan(n) {
  const wWeak = Math.round(n * 0.4), wMastered = Math.round(n * 0.2), wMiddle = n - wWeak - wMastered;
  return shuffle([...Array(wWeak).fill('weak'), ...Array(wMiddle).fill('middle'), ...Array(wMastered).fill('mastered')]);
}

// ---- Timed games practise mastered material (RUN18B Y10) ----------------------
// A timed game is not where a child MEETS something. Boo Beat puts a falling note behind the
// question and Bubble Pop puts a clock behind it; being asked, at speed, something you have
// never yet got right is not practice, it is a small ambush. The timed games draw only what
// she has already shown she can do.
//
// ELIGIBLE = two or more rights, OR the item has never been got wrong. The second half is
// what keeps a fresh save playable: an empty ledger makes EVERYTHING eligible, so a first-
// ever round is unchanged in every respect. The policy only bites once she has a history —
// and what it removes is precisely the handful of things she is currently getting wrong,
// which the untimed games and Teach Me (the introduction path) go on serving as before.
export const TIMED_RIGHTS = 2;
export function eligibleForTimed(item) {
  const id = typeof item === 'string' ? item : (item && (item.id || item.key));
  if (!id) return true;
  const e = ledgerEntry(id);
  return e.rights >= TIMED_RIGHTS || e.misses === 0;
}

// The timed games GENERATE candidates rather than draw from a listed pool, so "the eligible
// pool" is measured by probing the generator for DISTINCT eligible ids before the round
// starts. If it cannot find needs x 1.5 of them the whole round falls back to the full pool
// — SILENTLY: no message, no marker, nothing on screen. A child is never told that a game
// has quietly lowered a bar for her.
export function timedGate(gen, needs, { probe = 150 } = {}) {
  const want = Math.max(1, Math.ceil(needs * 1.5));
  const found = new Set();
  for (let i = 0; i < probe && found.size < want; i++) {
    const q = gen();
    const id = q && (q.key || q.id);
    if (id && eligibleForTimed(q)) found.add(id);
  }
  const on = found.size >= want;
  return {
    on, found: found.size, want,
    // Draw one question. `prefer` is a SOFT wish (Smart Mix's class plan); eligibility is the
    // hard filter, so a slot that wanted a 'weak' item and cannot have one still gets served.
    pick(gen1, { tries = 12, prefer = null } = {}) {
      let first = null, firstOk = null;
      for (let t = 0; t < tries; t++) {
        const q = gen1();
        if (!q) continue;
        if (!first) first = q;
        const ok = !on || eligibleForTimed(q);
        if (ok && !firstOk) firstOk = q;
        if (ok && (!prefer || prefer(q))) return q;
      }
      return firstOk || first;
    }
  };
}

// Diagnostic: bucket sizes for a pool (used by tests + debugging).
export function bucketCounts(pool, classOf = (item) => ledgerClass(item.id)) {
  const c = { weak: 0, middle: 0, mastered: 0 };
  for (const it of pool) c[classOf(it)]++;
  return c;
}
