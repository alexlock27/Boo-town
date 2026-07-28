// js/celebrate.js — RUN18D: THE CELEBRATION STANDARD and THE EXPLANATION STANDARD.
//
// Defined once, applied everywhere. Before this, "an action produces feedback" was a thing
// each screen decided for itself, and the audit found the range: some moments got a chime, a
// hop, a counter and a line; some got a silent state change and nothing at all.
//
// THE CELEBRATION STANDARD — every success moment lands in three beats:
//   1. ACKNOWLEDGE, within 100ms: the chime, and the answered element POPS (1 → 1.15 → 1
//      over 220ms). This one is not optional; it is the beat that says "yes, that".
//   2. A CHARACTER REACTS, within 300ms: the nearest Boo or guide hops (translateY -8px over
//      250ms), or the scene does its own act instead — the fed Boo chomps, the served
//      customer beams. A scene with its own act passes `act` and skips the generic hop,
//      because a hop on top of a chomp is two celebrations for one thing.
//   3. PROGRESS TICKS: the counter or star increments with a 180ms pulse.
//
// THE EXPLANATION STANDARD — a wrong answer always teaches. Never a darkening, never
// silence: the wrong element wobbles (±4°, 3 cycles, 360ms) and an authored line says what
// was actually being asked. The line is the point; the wobble is only how she knows which
// thing the line is about.
//
// REDUCED MOTION (and RUN18B Y15's "Calm motion" switch, which sets the same flag): sound
// and a colour pulse only. Nothing is DELETED — every line is still spoken, every counter
// still ticks, every explanation still arrives. Calm is not less.

import { REDUCED } from './ui.js';
import { sfx } from './sfx.js';
import { speakMaybe } from './guide.js';

// The Standard's timings, exported so a suite measures the authored numbers rather than a
// suite author's memory of them.
export const POP_MS = 220;        // beat 1: the answered element, 1 → 1.15 → 1
export const HOP_MS = 250;        // beat 2: the character's hop
export const HOP_PX = 8;          // …how far it hops
export const ACK_BY_MS = 100;     // beat 1 must have started by here
export const REACT_BY_MS = 300;   // beat 2 must have started by here
export const TICK_MS = 180;       // beat 3: the counter's pulse
export const WOBBLE_MS = 360;     // a wrong answer: ±4°, 3 cycles

function restart(node, cls, ms) {
  if (!node) return;
  node.classList.remove(cls);
  void node.offsetWidth;            // let the class removal land before it goes back on
  node.classList.add(cls);
  setTimeout(() => node.classList.remove(cls), ms + 60);
}

/** Beat 1 alone — the acknowledgement. Sound plus the element saying "me". */
export function beatAcknowledge(node, { sound = 'star' } = {}) {
  try { if (sound && typeof sfx[sound] === 'function') sfx[sound](); } catch (e) { console.warn(e); }
  restart(node, REDUCED ? 'cel-flash' : 'cel-pop', POP_MS);
}

/** Beat 2 alone — a character reacts. Skipped when the scene has its own act. */
export function beatReact(node) {
  if (!node) return;
  restart(node, REDUCED ? 'cel-flash' : 'cel-hop', HOP_MS);
}

/** Beat 3 alone — the counter ticks. The pulse runs even under reduced motion (it is a
 *  colour pulse, which is exactly what the reduced path is allowed to be). */
export function beatTick(node) {
  restart(node, 'cel-tick', TICK_MS);
}

/**
 * The whole Standard, in order.
 *   node      — the element she answered/acted on (beat 1)
 *   character — the Boo or guide that should react (beat 2). Omit when `act` is given.
 *   act       — the scene's own reaction, called instead of the generic hop.
 *   counter   — the progress element that just moved (beat 3).
 *   line      — what the guide says. Spoken unless speak:false.
 *   say       — how to say it (a screen's own bubble); falls back to speakMaybe.
 */
export function celebrate(node, { character = null, act = null, counter = null,
                                  sound = 'star', line = null, say = null, speak = true } = {}) {
  beatAcknowledge(node, { sound });
  const react = () => {
    if (typeof act === 'function') { try { act(); } catch (e) { console.warn(e); } }
    else beatReact(character);
  };
  // "within 300ms" is a ceiling, not a target — the beats must read as three, not as one.
  if (REDUCED) react(); else setTimeout(react, Math.min(REACT_BY_MS, 160));
  if (counter) setTimeout(() => beatTick(counter), REDUCED ? 0 : 200);
  if (line) {
    if (typeof say === 'function') { try { say(line); } catch (e) { console.warn(e); } }
    if (speak) speakMaybe(line);
  }
  if (typeof window !== 'undefined') {
    window.__celebrations = window.__celebrations || [];
    window.__celebrations.push({ at: Date.now(), line: line || null, beats: { pop: !!node, react: !!(character || act), tick: !!counter } });
  }
  return { line };
}

/**
 * The Explanation Standard: the thing she got wrong wobbles, and the guide says why.
 * `line` is authored copy with its «placeholders» already filled — this never composes copy.
 */
export function explainWrong(node, line, { say = null, speak = true, sound = 'oops' } = {}) {
  try { if (sound && typeof sfx[sound] === 'function') sfx[sound](); } catch (e) { console.warn(e); }
  restart(node, REDUCED ? 'cel-flash-wrong' : 'cel-wobble', WOBBLE_MS);
  if (line) {
    if (typeof say === 'function') { try { say(line); } catch (e) { console.warn(e); } }
    if (speak) speakMaybe(line);
  }
  if (typeof window !== 'undefined') {
    window.__explanations = window.__explanations || [];
    window.__explanations.push({ at: Date.now(), line: line || null });
  }
  return { line };
}

// QA: what the last action produced, so a suite can check the beats without frame-sampling
// every game. Frame evidence still covers one game per beat-type; this covers the rest.
if (typeof window !== 'undefined') {
  window.__standards = {
    celebrations: () => (window.__celebrations || []).slice(),
    explanations: () => (window.__explanations || []).slice(),
    reset: () => { window.__celebrations = []; window.__explanations = []; },
    timings: () => ({ POP_MS, HOP_MS, HOP_PX, ACK_BY_MS, REACT_BY_MS, TICK_MS, WOBBLE_MS })
  };
}
