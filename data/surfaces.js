// data/surfaces.js — surface slots (RUN19 Z6).
//
// Until Z6 a lamp could only ever stand on the floor beside a table, because a placement had
// no way to say "on top of that". SURFACE_SLOTS declares, per item, where things can sit on it
// and how high its surface is; SMALL_ITEMS declares which items are small enough to sit.
//
// Same convention as data/sockets.js — deliberately, so there is one geometry language in the
// codebase rather than two:
//   x        = fraction of the PARENT's rendered width from its centre (negative = left)
//   surfaceY = fraction of the parent's own rendered HEIGHT that its surface sits above its
//              ground line, read off the shared 0 0 120 130 deco viewBox in js/art.js
//              renderDeco. Authored in the pack as a fraction of height; kept verbatim.
//
// A bookshelf has TWO shelves, so its slots carry their own surfaceY and override the item's.

export const SURFACE_SLOTS = {
  deco_table:        [{ x: -0.22 }, { x: 0.22 }],
  deco_kitchentable: [{ x: -0.22 }, { x: 0.22 }],
  deco_counter:      [{ x: -0.3 }, { x: 0 }, { x: 0.3 }],
  deco_bookshelf:    [{ x: -0.18, surfaceY: 0.35 }, { x: 0.18, surfaceY: 0.68 }],
  deco_bookshelf2:   [{ x: -0.18, surfaceY: 0.35 }, { x: 0.18, surfaceY: 0.68 }],
  deco_bookshelf3:   [{ x: -0.18, surfaceY: 0.35 }, { x: 0.18, surfaceY: 0.68 }],
  deco_toybox:       [{ x: 0 }]
};

// The height of each surface, as the pack authors it.
export const SURFACE_Y = {
  deco_table: 0.55,
  deco_kitchentable: 0.55,
  deco_counter: 0.62,
  deco_bookshelf: 0.35,     // the slots carry 0.35 / 0.68 themselves; this is the fallback
  deco_bookshelf2: 0.35,
  deco_bookshelf3: 0.35,
  deco_toybox: 0.45
};

// `sizeClass:'small'` — the items that may sit in a slot. photoframe LOSES its wall-only
// exclusivity here (the pack: "either"), so it can hang on a wall OR stand on a shelf.
// wallclock stays wall-only, deliberately: a clock on a table is a different object.
export const SMALL_ITEMS = new Set(['deco_tablelamp', 'deco_lamp2', 'deco_plant1', 'deco_photoframe']);

export const SURFACE_ITEM_IDS = new Set(Object.keys(SURFACE_SLOTS));
export function slotsFor(itemId) { return SURFACE_SLOTS[itemId] || null; }
export function surfaceYFor(itemId, slotIndex) {
  const slots = SURFACE_SLOTS[itemId];
  const slot = slots && slots[slotIndex];
  if (slot && typeof slot.surfaceY === 'number') return slot.surfaceY;
  return SURFACE_Y[itemId] != null ? SURFACE_Y[itemId] : 0.55;
}
export function isSmall(itemId) { return SMALL_ITEMS.has(itemId); }

// Z6's plane union. 'sky' is RESERVED HERE and used by RUN20 W1 — the v23 migration and every
// validator must accept it now, so RUN20 does not need a second migration to introduce it.
export const PLANES = ['floor', 'wall', 'surface', 'sky'];
export const isPlane = (p) => p == null || PLANES.includes(p);

// The wall band a wall-hung item may be dragged within (fraction of viewport height).
export const WALL_Y_MIN = 0.18, WALL_Y_MAX = 0.42;
export const clampWallY = (y) => Math.max(WALL_Y_MIN, Math.min(WALL_Y_MAX, Number(y) || WALL_Y_MIN));

// A seated child renders at 0.8x its own scale, clamped so it never exceeds this much of the
// parent's width — a lamp wider than the table it stands on reads as a mistake, not a lamp.
export const CHILD_SCALE = 0.8;
export const CHILD_MAX_WIDTH_FRAC = 0.45;
// A held small item within this many pixels of a free slot glows that slot.
export const SLOT_SNAP_PX = 24;
