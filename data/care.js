// RUN10 P12 — upward-only Boo Care constants and pure helpers.

export const TREAT_PER_ROUND = 1;
export const POCKET_CAP = 5;
export const LEVELS = [0, 10, 25, 45, 70];
export const POINTS = {
  feed: 4,
  brush: 3,
  teeth: 3,
  play: 5,
  expedition: 6,
  ride: 1,
  parade: 2,
  perform: 2
};

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
