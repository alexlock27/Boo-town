// js/haptics.js — gentle haptics (RUN9 C7). Android only, feature-detected via
// navigator.vibrate; short + subtle; NEVER used for errors; switchable off in Settings and
// absent-safe everywhere (no feature depends on it). Patterns are milliseconds.
let enabled = true;   // mirrors save.settings.haptics; the Settings toggle drives it

export function hapticsSupported() {
  try { return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'; }
  catch { return false; }
}
export function setHapticsEnabled(on) { enabled = !!on; }
export function hapticsEnabled() { return enabled; }

// Subtle, short patterns. `tick` — a correct answer; `open` — a box/chest opening (a tiny
// double-buzz); `bump` — a Boo Roll wall hit; `pulse` — a Word Detective green.
const PATTERNS = { tick: [12], open: [16, 40, 16], bump: [10], pulse: [14] };

export function haptic(kind) {
  if (!enabled || !hapticsSupported()) return false;
  const p = PATTERNS[kind] || PATTERNS.tick;
  try { return navigator.vibrate(p); } catch { return false; }
}
