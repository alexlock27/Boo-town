// RUN10 P12 — upward-only Boo Care constants and pure helpers.

export const TREAT_PER_ROUND = 1;
export const POCKET_CAP = 5;
export const LEVELS = [0, 10, 25, 45, 70];
export const POINTS = {
  feed: 4,
  brush: 3,
  teeth: 3,
  bath: 3,          // RUN13 T1: Bath is new; every pre-existing value above is untouched.
  play: 5,
  expedition: 6,
  ride: 1,
  parade: 2,
  perform: 2
};

// RUN13 T1 — direct-manipulation constants (G8). Every care action is completed by
// TRAVEL of a tool the finger is holding, never by a step control. `*_TARGET` is how many
// units complete the action; `*_TRAVEL_PX` is how far the tool must move INSIDE the
// action's zone to earn one unit. Travel outside the zone earns nothing; releasing the
// tool keeps every whole unit already earned (nothing ever resets — G9 in miniature).
export const TEETH_TARGET = 12;
export const TEETH_TRAVEL_PX = 40;
export const FOAM_STAGES = 4;          // foam grows in four visible stages around the mouth
export const FUR_TARGET = 3;
export const FUR_TRAVEL_PX = 60;
export const BATH_TARGET = 10;
export const BATH_TRAVEL_PX = 45;
export const BALL_TARGET = 3;          // fetches that complete the ball variant of Play
export const PLAY_VARIANTS = ['peek', 'ball'];

// Foam/suds stage for a given unit count, 0 when nothing has happened yet.
export function stageFor(units, target, stages = FOAM_STAGES) {
  const u = Math.max(0, Number(units) || 0);
  if (!u) return 0;
  return Math.min(stages, Math.ceil(u / (target / stages)));
}

export function levelForPoints(points) {
  const p = Math.max(0, Number(points) || 0);
  let level = 1;
  for (let i = 1; i < LEVELS.length; i++) if (p >= LEVELS[i]) level = i + 1;
  return level;
}

export function pointsToNext(points) {
  const p = Math.max(0, Number(points) || 0);
  const level = levelForPoints(p);
  return level >= 5 ? 0 : LEVELS[level] - p;
}
