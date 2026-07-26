// js/games/boorollphysics.js — RUN14 U1: the Boo Roll 3.0 course engine.
// DOM-free and deterministic on a fixed 60Hz step, because the single most important
// acceptance test in the pack runs here headlessly: a fixed-lean input policy must FAIL
// all six authored courses, and scripted competent play must pass them. The same engine
// steps the real game (booroll.js renders it), so the proof and the product cannot drift.
//
// Units are CONTENT_COURSES.md's normalised grid: x 0-100, y 0-60 (y down), square units.
// The renderer applies one uniform scale (letterboxed), so authored angles stay true.

export const ROLL = {
  G: 0.05,                 // gravity, units/frame² (60fps frames)
  TILT_ACC: 0.010,         // lateral accel at |tilt| = 1, sensitivity 1.0. DELIBERATE:
                           // just under G·sin(12°) = 0.0104, so Course 2's +12° rise
                           // genuinely cannot be climbed from a standstill (its ANTI-LEAN
                           // NOTE), while ≤11° ramps remain climbable — slowly — by lean.
  FRICTION: 0.997,         // per-frame rolling friction. At 0.992 the drag alone (0.0028
                           // per frame at full speed) swamped the tilt-vs-gravity balance
                           // on Course 2's +12° rise, so banked speed could NOT carry the
                           // ball up it — breaking that course's authored promise while
                           // leaving the from-standstill guarantee intact either way.
  MAX_SPEED: 0.35,         // units/frame. Tuned DOWN so a full-speed ballistic arc off a
                           // platform edge lands on the idle seesaw's DOWN half and slides
                           // back (at 0.45 the arc reached the rising half with enough
                           // momentum to crest it — the lab trace that caught it is in
                           // RUN14_REPORT). With HOP_V below, max hop carry ≈ 10.9 units:
                           // clears the 10-unit exam gap at full speed, can NEVER clear
                           // the 12-unit seesaw void or a 12-unit girder gap.
  BALL_R: 1.3,
  HOP_V: 0.84,             // hop launch speed → rise 7.06 units, carry 11.8 at full speed.
                           // The brief's rule is the tuning rule: "hop height and cooldown
                           // are named constants tuned so hops reach the pickup stars but
                           // cannot skip mechanisms". 7.06 reaches Sunset Ridge's high
                           // mid-star (the tightest in the pack — 4.6 units short at 6.08)
                           // while staying under every girder pole (10-12) and gate (8-10),
                           // and 11.8 clears the 10-unit exam gap but never a 12-unit void.
  HOP_COOLDOWN_MS: 500,    // long enough that hopping is not a movement mode, short
                           // enough to take a star and still hop the gap that follows it
  STAR_R: 4,               // pickup radius. Generous ON PURPOSE: a star is a big glowing
                           // thing and a child who hops well enough to reach its height
                           // should not be denied it by a unit and a half. Still far too
                           // small to collect any star without hopping (the nearest sits
                           // ~5 units above its surface, ~10 above the ball's centre).
  STEP_UP_MAX: 4.5,        // AUTHORED JOINTS. CONTENT_COURSES.md's ramps state a start y
                           // and a degree; where the next platform's y differs by a few
                           // units (e.g. Course 2's +12° ramp ends at y 13.75 and meets a
                           // platform at y 10) that step is a JOINT in the authored
                           // drawing, not a wall — a rolling ball rides over it. Real
                           // blockers are `wall` segments, vertical girders and closed
                           // gates, which are 8-14 units and handled by the wall system,
                           // so this tolerance never softens an anti-lean guarantee.
  BONK_IMPACT: 1.9,        // landing speed above this bonks (never on a catch floor).
  FALL_LIMIT: 34,          // units of freefall → bonk (never onto a catch floor).
                           // Both sized to Course 2's authored promise: the 30-unit fall
                           // through the 70-76 gap "lands safely" on the lift below.
                           // Bonks still fire for out-of-course falls (y > 66).
  CATCH_WAIT_MS: 3000,     // the 3-second catch-floor parachute (identical everywhere)
  CLOCK_PENALTY_MS: 2500,
  BONK_MS: 700,
  CHUTE_MS: 1400,
  CHUTE_FALL: 0.14,        // parachute descent speed, units/frame
  SEESAW_IDLE: -22,        // degrees; tipped down-LEFT so an arriving ball meets a lip
  SEESAW_TIP: 22,          // held past level → tips down-right for a launch
  SEESAW_LEVEL_MS: 350,    // hold time to level
  SEESAW_TIP_MS: 900,      // further hold to full tip
  SEESAW_RELEASE_MS: 400,
  SEESAW_SHED_DEG: 8,      // steeper than this, the plank sheds the ball (no tilt grip):
                           // a seesaw is NEVER passable without a press, at any sensitivity
  GIRDER_MS: 320,          // quarter-turn ease
  LIFT_RATE: 0.22,         // units/frame while held
  LIFT_SINK_RATE: 0.10,
  GATE_RATE: 0.5,          // panel open/close, fraction/second·10 (per frame: h*GATE_RATE/30)
  AIR_CONTROL: 0.5,        // fraction of tilt authority retained in the air. Not zero (a
                           // child who has misjudged a leap can lean back and still land
                           // on the lift below — the authored fallback depends on it) and
                           // not one (weight is the whole feel goal).
  AIR_DRAG: 0.995,         // mild horizontal decay in flight; keeps hop ranges honest
  MECH_REACH: 20,          // the paddle operates the mechanism nearest the ball within this
  FINISH_BAND: 8
};
const DT = 1000 / 60;
const rad = d => d * Math.PI / 180;

// Static surface list from authored segments. A ramp {x,y,w,deg} runs from (x, y) to
// (x+w, y - w·tan(deg)) — +deg rises rightward, y-down grid.
function buildSurfaces(course) {
  const out = [];
  for (const s of course.segments) {
    if (s.t === 'platform') out.push({ kind: 'platform', x0: s.x, x1: s.x + s.w, y0: s.y, y1: s.y, catch: !!s.catch });
    else if (s.t === 'ramp') out.push({ kind: 'ramp', x0: s.x, x1: s.x + s.w, y0: s.y, y1: s.y - s.w * Math.tan(rad(s.deg)), deg: s.deg, catch: false });
  }
  return out;
}
function buildWalls(course) {
  return course.segments.filter(s => s.t === 'wall').map(s => ({ x: s.x, yBot: s.y, yTop: s.y - s.h }));
}

export function createRoll(course) {
  const surfaces = buildSurfaces(course);
  const walls = buildWalls(course);
  const mechs = course.mechanisms.map(m => ({
    ...m,
    // seesaw: angle in degrees; lift: current rise; girder: 0 = vertical, 1 = horizontal
    // (eased); gate: 1 = fully closed panel, 0 = open
    angle: m.t === 'seesaw' ? ROLL.SEESAW_IDLE : 0,
    v: 0, open: m.t === 'girder' ? 0 : (m.t === 'gate' ? 1 : 0), latched: false, prevPaddle: false
  }));
  const st = {
    x: course.start.x, y: course.start.y - ROLL.BALL_R, vx: 0, vy: 0,
    grounded: false, surface: null, t: 0, penalty: 0,
    stars: course.stars.map(() => false), checkpoint: { x: course.start.x, y: course.start.y },
    checkpointIdx: -1, finished: false,
    bonkUntil: 0, chuteUntil: 0, catchSince: null, hopReadyAt: 0, fallStart: null,
    events: []
  };
  const emit = (kind, data) => { st.events.push({ kind, t: st.t, ...data }); if (st.events.length > 400) st.events.shift(); };

  // Every solid surface (static + engaged mechanism surfaces) as y-at-x probes.
  function mechSurfaces() {
    const out = [];
    for (const m of mechs) {
      if (m.t === 'seesaw') {
        // angle sign: negative = tipped down-LEFT (idle). y-down grid, so the left end
        // carries the LARGER y: yAt = pivotY + tan(angle)·(x-cx) gives left end lower
        // (bigger y) at angle -22 and right end lower at +22 (the launch tip).
        const cx = m.x + m.w / 2;
        out.push({ kind: 'seesaw', mech: m, x0: m.x, x1: m.x + m.w, catch: false,
          yAt: (x) => m.y + Math.tan(rad(m.angle)) * (x - cx)
        });
      } else if (m.t === 'lift') {
        out.push({ kind: 'lift', mech: m, x0: m.x, x1: m.x + m.w, catch: false, yAt: () => m.y - m.v });
      } else if (m.t === 'girder' && m.open > 0.85) {
        out.push({ kind: 'girder', mech: m, x0: m.x, x1: m.x + m.len, catch: false, yAt: () => m.y });
      }
    }
    return out;
  }
  function allSurfaces() {
    const dyn = mechSurfaces();
    return [
      ...surfaces.map(s => ({ kind: s.kind, x0: s.x0, x1: s.x1, catch: s.catch, deg: s.deg || 0,
        yAt: (x) => s.y0 + (s.y1 - s.y0) * ((x - s.x0) / Math.max(0.0001, s.x1 - s.x0)) })),
      ...dyn
    ];
  }
  // dynamic walls: vertical girders and closed gates block like authored walls
  function allWalls() {
    const out = [...walls];
    for (const m of mechs) {
      if (m.t === 'girder' && m.open < 0.15) out.push({ x: m.x, yBot: m.y, yTop: m.y - m.len, mech: m });
      if (m.t === 'gate' && m.open > 0.2) out.push({ x: m.x, yBot: m.y, yTop: m.y - m.h * m.open, mech: m });
    }
    return out;
  }
  const surfaceUnder = (x, yFoot, tol) => {
    let best = null;
    for (const s of allSurfaces()) {
      if (x < s.x0 - 0.01 || x > s.x1 + 0.01) continue;
      const sy = s.yAt(x);
      if (sy >= yFoot - tol && (best === null || sy < best.y)) best = { s, y: sy };
    }
    return best;
  };
  const nearestMech = () => {
    let best = null, bd = ROLL.MECH_REACH;
    for (const m of mechs) {
      const cx = m.t === 'girder' ? m.x + m.len / 2 : m.x + (m.w || 2) / 2;
      const d = Math.abs(cx - st.x);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  };

  function stepMechs(paddle) {
    const near = nearestMech();
    for (const m of mechs) {
      const held = paddle && m === near;
      if (m.t === 'seesaw') {
        if (held) {
          // level first, then tip on: -22 → 0 over LEVEL_MS, 0 → +22 over TIP_MS
          const rate1 = (0 - ROLL.SEESAW_IDLE) / (ROLL.SEESAW_LEVEL_MS / DT);
          const rate2 = ROLL.SEESAW_TIP / (ROLL.SEESAW_TIP_MS / DT);
          m.angle = m.angle < 0 ? Math.min(0, m.angle + rate1) : Math.min(ROLL.SEESAW_TIP, m.angle + rate2);
        } else {
          const rate = (0 - ROLL.SEESAW_IDLE) / (ROLL.SEESAW_RELEASE_MS / DT);
          m.angle = Math.max(ROLL.SEESAW_IDLE, m.angle - rate);
        }
      } else if (m.t === 'lift') {
        m.v = held ? Math.min(m.rise, m.v + ROLL.LIFT_RATE) : Math.max(0, m.v - ROLL.LIFT_SINK_RATE);
      } else if (m.t === 'girder') {
        // one press per quarter-turn, latching
        if (held && !m.prevPaddle) m.target = m.open > 0.5 ? 0 : 1;
        if (m.target !== undefined) {
          const rate = 1 / (ROLL.GIRDER_MS / DT);
          m.open += m.open < m.target ? Math.min(rate, m.target - m.open) : -Math.min(rate, m.open - m.target);
        }
        m.prevPaddle = held;
      } else if (m.t === 'gate') {
        const rate = 1 / (ROLL.GIRDER_MS / DT);
        m.open = held ? Math.max(0, m.open - rate) : Math.min(1, m.open + rate);
      }
      if (m.t !== 'girder') m.prevPaddle = held;
    }
  }

  function respawnAtCheckpoint() {
    st.x = st.checkpoint.x; st.y = st.checkpoint.y - 14;
    st.vx = 0; st.vy = 0; st.grounded = false; st.surface = null; st.fallStart = null;
    st.chuteUntil = st.t + ROLL.CHUTE_MS;
    st.penalty += ROLL.CLOCK_PENALTY_MS;
    st.catchSince = null;
    emit('chute', {});
  }

  function step(input = {}) {
    if (st.finished) return st;
    st.t += DT;
    const tilt = Math.max(-1, Math.min(1, input.tilt || 0)) * (input.sens || 1);
    stepMechs(!!input.paddle);

    if (st.t < st.bonkUntil) return st;              // dizzy: the world waits
    // the dizzy beat has ended — parachute home BEFORE any more physics can re-bonk
    if (st._afterBonk) { st._afterBonk = null; respawnAtCheckpoint(); return st; }
    if (st.t < st.chuteUntil) {                       // parachute descent
      st.y += ROLL.CHUTE_FALL;
      const land = surfaceUnder(st.x, st.y + ROLL.BALL_R, 0.6);
      if (land && st.y + ROLL.BALL_R >= land.y) { st.y = land.y - ROLL.BALL_R; st.grounded = true; st.surface = land.s; st.chuteUntil = 0; emit('land', { soft: true }); }
      return st;
    }

    // hop. NOT from a seesaw that is tipping away under her: you cannot push off a plank
    // that is sliding out from beneath you, and allowing it let a hop-spamming policy
    // bunny-hop across an idle seesaw without ever pressing the paddle — which would have
    // broken Course 1's anti-lean guarantee ("never passable without a press").
    const onShedding = st.surface && st.surface.kind === 'seesaw' && Math.abs(st.surface.mech.angle) > ROLL.SEESAW_SHED_DEG;
    if (input.hop && st.grounded && !onShedding && st.t >= st.hopReadyAt) {
      st.vy = -ROLL.HOP_V; st.grounded = false; st.surface = null; st.fallStart = st.y;
      st.hopReadyAt = st.t + ROLL.HOP_COOLDOWN_MS;
      emit('hop', {});
    }

    if (st.grounded && st.surface) {
      const s = st.surface;
      const deg = s.kind === 'ramp' ? s.deg : (s.kind === 'seesaw' ? -s.mech.angle : 0);
      // NOTE y-down: a surface rising rightward (deg>0) opposes +vx with G·sin(deg)
      const shed = s.kind === 'seesaw' && Math.abs(s.mech.angle) > ROLL.SEESAW_SHED_DEG;
      const tiltAcc = shed ? 0 : tilt * ROLL.TILT_ACC;
      st.vx = (st.vx + tiltAcc - ROLL.G * Math.sin(rad(deg))) * ROLL.FRICTION;
      st.vx = Math.max(-ROLL.MAX_SPEED, Math.min(ROLL.MAX_SPEED, st.vx));
      let nx = st.x + st.vx;
      // walls (authored, vertical girders, gates)
      for (const w of allWalls()) {
        const yFoot = st.y + ROLL.BALL_R;
        if (yFoot > w.yTop && st.y - ROLL.BALL_R < w.yBot + 0.5) {
          if (st.x <= w.x && nx + ROLL.BALL_R > w.x) { nx = w.x - ROLL.BALL_R; st.vx = -Math.abs(st.vx) * 0.4; emit('scrape', { x: w.x }); }
          else if (st.x >= w.x && nx - ROLL.BALL_R < w.x) { nx = w.x + ROLL.BALL_R; st.vx = Math.abs(st.vx) * 0.4; emit('scrape', { x: w.x }); }
        }
      }
      const under = surfaceUnder(nx, st.y + ROLL.BALL_R, ROLL.STEP_UP_MAX);
      if (under && Math.abs(under.y - (st.y + ROLL.BALL_R)) <= ROLL.STEP_UP_MAX) {
        st.x = nx; st.y = under.y - ROLL.BALL_R; st.surface = under.s;
      } else if (under && under.y > st.y + ROLL.BALL_R + ROLL.STEP_UP_MAX) {
        // ground fell away more than a step: leave the surface, become airborne
        st.x = nx; st.grounded = false; st.surface = null; st.fallStart = st.y;
      } else if (!under) {
        st.x = nx; st.grounded = false; st.surface = null; st.fallStart = st.y;
      } else {
        // a rise taller than STEP_UP_MAX: a wall edge — stop against it
        st.vx = -st.vx * 0.3;
        emit('scrape', { x: nx });
      }
      // catch-floor dwell → the parachute home
      if (st.grounded && st.surface && st.surface.catch) {
        if (st.catchSince === null) { st.catchSince = st.t; emit('catchwait', {}); }
        if (st.t - st.catchSince >= ROLL.CATCH_WAIT_MS) respawnAtCheckpoint();
      } else st.catchSince = null;
    } else {
      // airborne
      st.vy += ROLL.G;
      st.vx = (st.vx + tilt * ROLL.TILT_ACC * ROLL.AIR_CONTROL) * ROLL.AIR_DRAG;
      st.vx = Math.max(-ROLL.MAX_SPEED, Math.min(ROLL.MAX_SPEED, st.vx));
      let nx = st.x + st.vx;
      for (const w of allWalls()) {
        const yFoot = st.y + ROLL.BALL_R;
        if (yFoot > w.yTop && st.y - ROLL.BALL_R < w.yBot + 0.5) {
          if (st.x <= w.x && nx + ROLL.BALL_R > w.x) { nx = w.x - ROLL.BALL_R; st.vx = -Math.abs(st.vx) * 0.4; emit('scrape', { x: w.x }); }
          else if (st.x >= w.x && nx - ROLL.BALL_R < w.x) { nx = w.x + ROLL.BALL_R; st.vx = Math.abs(st.vx) * 0.4; emit('scrape', { x: w.x }); }
        }
      }
      const prevFoot = st.y + ROLL.BALL_R;
      st.x = nx; st.y += st.vy;
      if (st.vy > 0) {
        // land on the first surface the foot crosses this frame
        let best = null;
        for (const s of allSurfaces()) {
          if (st.x < s.x0 - 0.01 || st.x > s.x1 + 0.01) continue;
          const sy = s.yAt(st.x);
          if (prevFoot <= sy + 0.6 && st.y + ROLL.BALL_R >= sy) { if (best === null || sy < best.y) best = { s, y: sy }; }
        }
        if (best) {
          const impact = st.vy, fall = st.fallStart === null ? 0 : (best.y - ROLL.BALL_R) - st.fallStart;
          st.y = best.y - ROLL.BALL_R; st.vy = 0; st.grounded = true; st.surface = best.s; st.fallStart = null;
          emit('land', { impact: +impact.toFixed(2) });
          if (!best.s.catch && (impact > ROLL.BONK_IMPACT || fall > ROLL.FALL_LIMIT)) {
            st.bonkUntil = st.t + ROLL.BONK_MS;
            emit('bonk', { impact: +impact.toFixed(2), fall: Math.round(fall) });
            st.vx = 0; st.vy = 0;
            const bu = st.bonkUntil;
            // after the dizzy beat, parachute home (booroll.js animates this window)
            st._afterBonk = bu;
          }
        }
      }
      // fell out of the course entirely
      if (st.y > 66) { st.bonkUntil = st.t + ROLL.BONK_MS; st._afterBonk = st.bonkUntil; emit('bonk', { fell: true }); st.vx = 0; st.vy = 0; }
    }
    // course-edge walls
    if (st.x < ROLL.BALL_R) { st.x = ROLL.BALL_R; st.vx = Math.abs(st.vx) * 0.4; }
    if (st.x > 100 - ROLL.BALL_R) { st.x = 100 - ROLL.BALL_R; st.vx = -Math.abs(st.vx) * 0.4; }

    // checkpoints (in order), stars, finish
    course.checkpoints.forEach((c, i) => {
      // a checkpoint banks at the level the BALL actually crossed it, never at the
      // topmost surface — a ball passing x underneath a bridge must respawn low
      if (i === st.checkpointIdx + 1 && st.x >= c.x && st.grounded) {
        st.checkpointIdx = i;
        st.checkpoint = { x: c.x, y: st.y + ROLL.BALL_R };
        emit('checkpoint', { i });
      }
    });
    course.stars.forEach((s, i) => {
      if (!st.stars[i] && Math.hypot(st.x - s.x, st.y - s.y) <= ROLL.STAR_R) { st.stars[i] = true; emit('star', { i }); }
    });
    if (st.x >= course.finish.x && Math.abs((st.y + ROLL.BALL_R) - course.finish.y) <= ROLL.FINISH_BAND) {
      st.finished = true;
      emit('finish', { ms: Math.round(st.t + st.penalty) });
    }
    return st;
  }

  return {
    step, state: st, mechs, surfaces, walls,
    elapsedMs: () => Math.round(st.t + st.penalty),
    surfacesNow: allSurfaces, wallsNow: allWalls, nearestMech
  };
}

// Headless run of an input policy against a course. policy(state, sim, frame) → input.
export function simulate(course, policy, maxMs = 120000) {
  const sim = createRoll(course);
  let frame = 0;
  while (sim.state.t < maxMs && !sim.state.finished) {
    sim.step(policy(sim.state, sim, frame++) || {});
  }
  return sim;
}

// THE HARD GATE'S POLICY: constant maximum tilt one way, no paddle, no hop — ever.
export const fixedLean = (dir = 1) => () => ({ tilt: dir, paddle: false, hop: false });
