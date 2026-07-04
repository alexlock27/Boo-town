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
  drawWeighted(shuffle(middle.slice()), wMiddle, () => 1, chosen, used);
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

// Diagnostic: bucket sizes for a pool (used by tests + debugging).
export function bucketCounts(pool, classOf = (item) => ledgerClass(item.id)) {
  const c = { weak: 0, middle: 0, mastered: 0 };
  for (const it of pool) c[classOf(it)]++;
  return c;
}
