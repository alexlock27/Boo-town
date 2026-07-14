// js/areas.js — Town 4.0: the eight areas of the world map (RUN10 P1).
// Pure data: no DOM, no state reads beyond the predicate argument it's given.

export const AREA_W_VIEWPORTS = 4;   // every outdoor area = 4 viewports wide

// Unlock star thresholds (named constants, carried over from the old ZONES gates).
export const RIVERSIDE_STARS = 40, HILLTOP_STARS = 100, BEACH_STARS = 180;

export const AREAS = [
  { key: 'meadow',     name: 'The Meadow',     kind: 'outdoor',  scenery: 'meadow',     unlocked: () => true },
  { key: 'riverside',  name: 'Riverside',      kind: 'outdoor',  scenery: 'riverside',  unlocked: (s) => s.stars.total >= RIVERSIDE_STARS },
  { key: 'hilltop',    name: 'Hilltop',        kind: 'outdoor',  scenery: 'hilltop',    unlocked: (s) => s.stars.total >= HILLTOP_STARS },
  { key: 'beach',      name: 'Sunny Beach',    kind: 'outdoor',  scenery: 'beach',      unlocked: (s) => s.stars.total >= BEACH_STARS },
  { key: 'funfair',    name: 'The Boo Funfair',kind: 'outdoor',  scenery: 'funfair',    unlocked: () => true },
  { key: 'playground', name: 'The Playground', kind: 'outdoor',  scenery: 'playground', unlocked: () => true },
  { key: 'boohouse',   name: 'The Boo House',  kind: 'interior', scenery: 'boohouse',   unlocked: () => true },
  { key: 'gallery',    name: 'The Gallery',    kind: 'interior', scenery: 'gallery',    unlocked: () => true }
];
export const AREA_INDEX = Object.fromEntries(AREAS.map((a, i) => [a.key, i]));
export const AREA_UNLOCK_STARS = { meadow: 0, riverside: RIVERSIDE_STARS, hilltop: HILLTOP_STARS, beach: BEACH_STARS, funfair: 0, playground: 0, boohouse: 0, gallery: 0 };

// Landmark badge positions on the island map, {key: {x%, y%}} — authored constants.
export const MAP_POS = {
  meadow:     { x: 38, y: 58 },
  riverside:  { x: 58, y: 66 },
  hilltop:    { x: 22, y: 26 },
  beach:      { x: 78, y: 80 },
  funfair:    { x: 82, y: 38 },
  playground: { x: 46, y: 34 },
  boohouse:   { x: 30, y: 74 },
  gallery:    { x: 62, y: 30 }
};

export function areaByKey(key) { return AREAS.find(a => a.key === key) || AREAS[0]; }
export function unlockedAreas(s) { return AREAS.filter(a => a.unlocked(s)); }
export function isAreaUnlocked(key, s) { const a = areaByKey(key); return a ? a.unlocked(s) : false; }

// Flatten save.town.areas into one list across every area, for cross-area consumers
// (occasional-request checks, cross-area hide-and-seek in P5, etc). Each entry carries
// both `area` and `zone` (same value) since some callers still read the older field name.
export function flattenTownItems(s) {
  const out = [];
  const areas = (s && s.town && s.town.areas) || {};
  for (const key of Object.keys(areas)) {
    const a = areas[key];
    if (!a || !Array.isArray(a.items)) continue;
    for (const it of a.items) out.push({ ...it, area: key, zone: key });
  }
  return out;
}
