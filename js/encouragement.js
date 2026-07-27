// js/encouragement.js — when a kind word is said, and how hard that is capped (RUN17 X2).
//
// Feel goal: the app should feel like somewhere she is liked. Which means the kind words
// have to be RARE and TRUE. A guide that praises everything praises nothing, and a child
// works out very quickly that the nice voice is automatic.
//
// So the policy is the feature, and it is deliberately mean with itself:
//   • at most THREE encouragement lines in a whole session;
//   • never two in a row — after one lands, the very next eligible moment is declined;
//   • NEVER after a round she aced. Comforting someone who just did brilliantly reads as
//     pity, and she will hear it that way.
//   • the two once-only moments (coming back after a break, a long session's pause) fire
//     at most once each per session.
//
// The WORDS are authored in CONTENT_WARMTH.md and live in data/guideLines.js. This file
// chooses the moment; it never writes a line.
//
// Session state is module-level on purpose: it resets when the app is loaded, and nothing
// about how often she has been encouraged is ever written to the save. There is no ledger
// of kindness.

import { guideLine } from './guide.js';
import { getState, todayKey } from './state.js';

export const SESSION_CAP = 3;          // at most three kind words per session
const RETURN_AFTER_DAYS = 2;           // "returning after a break of 2+ days"
const LONG_SESSION_MS = 20 * 60 * 1000; // a long play session's natural pause

// The moments X2 names. `once` moments fire at most once per session.
export const MOMENTS = {
  returning:   { pool: 'encourageEffort',     once: true },
  hardRound:   { pool: 'encourageHardRound',  once: false },
  firstTry:    { pool: 'encourageEffort',     once: false },
  rescue:      { pool: 'encourageEffort',     once: false },
  longSession: { pool: 'encourageEffort',     once: true }
};

const sessionStart = Date.now();
let said = 0;
let justSaid = false;      // the "never two in a row" latch
let usedOnce = {};
let lastLine = '';

// Test/QA seam only: a simulated week of play needs to start each day fresh.
export function resetSession() { said = 0; justSaid = false; usedOnce = {}; lastLine = ''; }
export function sessionSaid() { return said; }

// Has she been away long enough for the "welcome back" moment? Read-only.
//
// This reads seen.lastPlayDay — the local DAY she last finished a round — and not
// save.lastPlayed. lastPlayed is restamped by every commit(), including the one the router
// makes while the app is still booting, so by the time any screen could ask it always says
// "just now". The day key is written once, when she plays, and survives the boot. Counting
// whole days is also the truer reading of "a break of 2+ days" for a child.
export function daysAway(today = todayKey()) {
  const s = getState();
  const last = s && s.seen && s.seen.lastPlayDay;
  if (!last) return 0;                       // never played a round: not "coming back"
  const a = Date.parse(last + 'T00:00:00'), b = Date.parse(today + 'T00:00:00');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86400000));
}
export function returningAfterBreak(today = todayKey()) { return daysAway(today) >= RETURN_AFTER_DAYS; }

export function inLongSession(now = Date.now()) { return now - sessionStart >= LONG_SESSION_MS; }

// The one decision point. Returns a line to say, or '' for silence — and silence is the
// common case by design.
//
// `stars` is passed for any round-shaped moment so the aced-round rule can be enforced
// HERE rather than trusted to five separate call sites.
export function encouragementFor(moment, { stars = null } = {}) {
  const spec = MOMENTS[moment];
  if (!spec) return '';
  if (said >= SESSION_CAP) return '';                 // the session cap
  if (justSaid) { justSaid = false; return ''; }      // never two in a row
  if (spec.once && usedOnce[moment]) return '';       // once-only moments
  // Never after a round she aced — that would read as pity.
  if (stars != null && stars >= 3) return '';

  const line = pick(spec.pool);
  if (!line) return '';
  said++;
  justSaid = true;
  usedOnce[moment] = true;
  lastLine = line;
  return line;
}

// Never the same words twice running: a repeat is the fastest way for a kind line to
// start sounding like a machine. Two tries is plenty for pools of 40 and 8.
function pick(key) {
  let line = guideLine(key);
  for (let i = 0; i < 3 && line === lastLine; i++) line = guideLine(key);
  return line;
}

// Test hook: the caps are the feature, so they are inspectable.
if (typeof window !== 'undefined') {
  window.__encouragement = {
    said: () => said,
    cap: SESSION_CAP,
    reset: () => resetSession(),
    tryFor: (m, opts) => encouragementFor(m, opts || {}),
    returningAfterBreak: (today) => returningAfterBreak(today),
    daysAway: (today) => daysAway(today),
    moments: () => Object.keys(MOMENTS)
  };
}
