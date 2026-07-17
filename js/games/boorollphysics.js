// Deterministic RUN10 P7 side-view motion helpers. Kept DOM-free for course tests.
export const GRAV = 0.55, FRICTION = 0.985, MAX_SPEED = 15, BOUNCE = 0.45;
export function slopeStep({ vx = 0, tilt = 0, deg = 0, dt = 1, grounded = true }) {
  const slope = grounded ? GRAV * Math.sin(deg * Math.PI / 180) : 0;
  let next = (vx + slope + tilt) * Math.pow(FRICTION, dt);
  next = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, next));
  return next;
}
export function shouldBonk(impact, fall) { return impact > 11 || fall > 260; }
