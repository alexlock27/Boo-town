// js/games/boorollplay.js — RUN14 U1: SCRIPTED COMPETENT PLAY.
// One policy per authored course, written the way a child who has understood the course
// would play it. This is TEST SUPPORT and route evidence, not a bot the game runs — it
// lives beside the engine so U1's assertions (every course beatable under gold×1.4, every
// star reachable, no mechanism skippable) are proved headlessly and re-proved every board.
//
// Policies are built from four PRIMITIVES rather than hard-coded x windows, because a
// window-matched script is brittle in exactly the way a real player is not: it misses its
// cue whenever the ball arrives airborne or a shade early.
//   drive(to)      — lean toward a target x
// ` brake()        — counter-lean against the current roll (the Course 5 skill)
//   hopEdge(edges) — when grounded and rolling at a gap edge, hop it
//   ride(lift)     — settle onto a lift, hold until it tops out, then lean off
import { ROLL } from './boorollphysics.js';

const mechs = (sim, t) => sim.mechs.filter(m => m.t === t);
const mech = (sim, t, i = 0) => mechs(sim, t)[i];

// Lean toward x. Inside `brake`, counter-lean so the ball settles instead of overshooting.
function drive(s, x, brake = 0) {
  const d = x - s.x;
  if (brake && Math.abs(d) < brake && Math.abs(s.vx) > 0.06) return -Math.sign(s.vx);
  return Math.sign(d) || 1;
}
// Hop when grounded and the ball is running at a gap edge (within `lead` units before it),
// moving toward it with real speed. Robust to arriving early or late.
function hopEdge(s, edges, lead = 3) {
  if (!s.grounded || s.t < s.hopReadyAt || s.vx <= 0.12) return false;
  return edges.some(e => s.x > e - lead && s.x <= e + 0.4);
}
// Take a star: hop when grounded, under it, and it is still uncollected.
function hopStar(s, i, x, lead = 2) {
  return s.grounded && !s.stars[i] && s.t >= s.hopReadyAt && Math.abs(s.x - x) < lead;
}
// Ride a lift: brake to a stop on its deck, hold the paddle, lean off at the top.
function ride(s, lift) {
  const on = s.x > lift.x - 0.4 && s.x < lift.x + lift.w + 0.4 && Math.abs((s.y + ROLL.BALL_R) - (lift.y - lift.v)) < 2.5;
  if (!on) return null;
  const topped = lift.v >= lift.rise - 0.8;
  if (topped) return { tilt: 1, paddle: true, hop: false };        // step off to the right
  return { tilt: Math.abs(s.vx) > 0.04 ? -Math.sign(s.vx) : 0, paddle: true, hop: false };
}

// THE AIR BRAKE. A real player who has missed a ledge stops pushing and counter-leans, so
// the ball drops onto the catch floor / lift below instead of sailing past it. Without this
// every course's authored fallback ("falling instead lands safely on the lower deck") is
// unreachable by a script that only ever leans forward — the traces that proved it are in
// RUN14_REPORT.md. Applied to every policy; it never fires while grounded.
const withAirBrake = (fn) => (s, sim) => {
  const out = fn(s, sim) || {};
  if (!s.grounded && s.vy > 0.22 && Math.abs(s.vx) > 0.05) return { ...out, tilt: -Math.sign(s.vx) };
  return out;
};

const RAW = {
  // C1 "First Roll" — tilt, the seesaw, the hop.
  'first-roll': (s, sim) => {
    const seesaw = mech(sim, 'seesaw');
    const onSeesawRun = s.x > 44 && s.x < 70;
    return {
      tilt: drive(s, 96),
      paddle: onSeesawRun,                    // hold it level as a bridge across 56-68
      hop: hopStar(s, 1, 61, 3)               // the mid star floats over the seesaw
    };
  },
  // C2 "Over and Under" — momentum up the +12° rise; hop the 70-76 gap at speed; a fall
  // lands on the lower deck (catch) where the third star is, and the lift rides back up.
  'over-and-under': (s, sim) => {
    const lift = mech(sim, 'lift');
    const r = ride(s, lift);
    if (r) return r;                                   // riding beats every other intent
    if (s.y > 30) {                                    // the lower deck
      if (!s.stars[2]) return { tilt: drive(s, 36, 3), paddle: false, hop: hopStar(s, 2, 36, 3) };
      return { tilt: drive(s, lift.x + lift.w / 2, 4), paddle: false, hop: false };
    }
    // THE RUN-UP. The +12° rise at x38 cannot be climbed from a standstill (that is the
    // course's anti-lean guarantee), so a competent player who stalls on it rolls back
    // down the flat and comes again with speed — exactly what the note asks her to learn.
    // Hysteresis matters: without it the ball dithers on the spot at the stall point.
    // Commit to the run-up (lean left) until she is genuinely back down the flat at x≤26.
    const stalled = s.grounded && s.x > 37 && s.x < 58 && Math.abs(s.vx) < 0.22;
    const runningUp = s.grounded && s.vx < -0.03 && s.x > 26 && s.x < 58;
    if (stalled || runningUp) return { tilt: -1, paddle: false, hop: false };
    return {
      tilt: drive(s, 96),
      paddle: false,
      hop: hopStar(s, 0, 30) || hopStar(s, 1, 64) || hopEdge(s, [70])
    };
  },
  // C3 "Lift Off" — two lifts, no route past either. Ride, roll, ride again.
  'lift-off': (s, sim) => {
    const [lift1, lift2] = mechs(sim, 'lift');
    const r1 = ride(s, lift1), r2 = ride(s, lift2);
    if (r1) return r1;
    if (r2) return r2;
    if (s.y > 34) {                                     // the low deck
      if (!s.stars[0] && s.x < 20) return { tilt: drive(s, 14, 3), paddle: false, hop: hopStar(s, 0, 14, 3) };
      return { tilt: drive(s, lift1.x + lift1.w / 2, 4), paddle: false, hop: false };
    }
    return {
      tilt: drive(s, lift2.x + lift2.w / 2, 4),
      paddle: false,
      hop: hopStar(s, 1, 44) || hopStar(s, 2, 82)
    };
  },
  // C4 "Spin Cycle" — both girders idle vertical; a press each turns them flat; the two
  // high stars need a hop off the horizontal girder mid-crossing.
  'spin-cycle': (s, sim) => {
    const [g1, g2] = mechs(sim, 'girder');
    return {
      tilt: drive(s, 96),
      paddle: (g1.open < 0.5 && s.x > 14 && s.x < 24) || (g2.open < 0.5 && s.x > 60 && s.x < 72),
      hop: hopStar(s, 0, 28) || hopStar(s, 1, 56) || hopStar(s, 2, 76, 3)
    };
  },
  // C5 "The Gate" — brake against the roll onto the 8-wide ledge, hold the gate, hop the
  // 76-84 gap with the third star at its apex; a fall lands on the catch floor + lift.
  'the-gate': (s, sim) => {
    const lift = mech(sim, 'lift');
    const r = ride(s, lift);
    if (r) return r;
    if (s.y > 32) {                                     // the catch floor below
      return { tilt: drive(s, lift.x + lift.w / 2, 4), paddle: false, hop: false };
    }
    const approachingLedge = s.x > 20 && s.x < 30;
    return {
      tilt: approachingLedge ? drive(s, 30, 10) : drive(s, 96),   // the deliberate brake
      paddle: s.x > 28 && s.x < 38,                                // hold the gate open
      hop: hopStar(s, 0, 30) || hopStar(s, 1, 60) || hopEdge(s, [76])
    };
  },
  // C6 "Sunset Ridge" — everything at once: seesaw, girder, the exam gap, the final gate.
  'sunset-ridge': (s, sim) => {
    const girder = mech(sim, 'girder');
    const lift = mech(sim, 'lift');
    const r = ride(s, lift);
    if (r) return r;
    if (s.y > 32) {                                     // the catch floor below
      return { tilt: drive(s, lift.x + lift.w / 2, 4), paddle: false, hop: false };
    }
    return {
      tilt: drive(s, 97),
      paddle: (s.x > 12 && s.x < 34)                        // level the seesaw, cross it
        || (girder.open < 0.5 && s.x > 28 && s.x < 40)      // turn the girder flat
        || (s.x > 76 && s.x < 90),                          // hold the final gate open
      hop: hopStar(s, 0, 24) || hopStar(s, 1, 52) || hopStar(s, 2, 88, 3) || hopEdge(s, [66])
    };
  }
};

export const PLAY = Object.fromEntries(Object.entries(RAW).map(([k, fn]) => [k, withAirBrake(fn)]));
