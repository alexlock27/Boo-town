// js/ack.js — the acknowledgement budget (RUN19 Z3 + Z4).
//
// Z4 asks for a set of lines in which the town NOTICES what the child has made: a restyled
// guide, her painting on the easel, a path she painted, a seat being taken. Every one of
// them is lovely once and grating the fourth time, so they share ONE budget:
//
//   • at most TWO acknowledgements in a whole session;
//   • never two in a row — after one lands, the very next eligible moment is declined;
//   • `once` moments fire at most once per session however often their trigger repeats.
//
// This is deliberately the same shape as js/encouragement.js (RUN17 X2) — the latch, the
// module-level session state, the "the policy IS the feature" stance — because the failure
// mode is identical and there is no reason for two different answers to it. Session state
// is module-level on purpose: it resets on load, and nothing about how often she has been
// complimented is ever written to the save. There is no ledger of niceness.
//
// The WORDS live in data/guideLines.js. This file chooses whether anything is said at all.

import { guideLine } from './guide.js';

export const ACK_CAP = 2;      // at most two acknowledgements per session (Z4)

// The moments Z3/Z4 name. `once` means once per session no matter how often it triggers.
export const ACK_MOMENTS = {
  socketClaim: { line: 'socketClaim', once: false },   // Z3: a Boo takes a seat
  restyle:     { line: 'ackRestyle',  once: true },    // Z4: the guide's new look
  easel:       { line: 'ackEasel',    once: true },    // Z4: her art on the easel
  path:        { line: 'ackPath',     once: false }    // Z4: a Boo crossing her path
};

let said = 0;
let justSaid = false;      // the "never two in a row" latch
let usedOnce = {};

// Test/QA seam only: a simulated session needs to start fresh.
export function resetAcks() { said = 0; justSaid = false; usedOnce = {}; }
export function acksSaid() { return said; }
export function ackBudgetLeft() { return Math.max(0, ACK_CAP - said); }

// The one decision point. Returns the line to say, or '' for silence — and silence is
// the common case by design. `vars` fills the authored line's placeholders.
export function acknowledge(moment, vars = null) {
  const spec = ACK_MOMENTS[moment];
  if (!spec) return '';
  if (said >= ACK_CAP) return '';
  if (justSaid) { justSaid = false; return ''; }       // never two in a row
  if (spec.once && usedOnce[moment]) return '';
  const line = guideLine(spec.line, vars);
  if (!line) return '';
  said++;
  justSaid = true;
  usedOnce[moment] = true;
  return line;
}

// Test hook: the caps ARE the feature, so they are inspectable.
if (typeof window !== 'undefined') {
  window.__acks = {
    said: () => said,
    cap: ACK_CAP,
    reset: () => resetAcks(),
    tryFor: (m, vars) => acknowledge(m, vars || null),
    moments: () => Object.keys(ACK_MOMENTS)
  };
}
