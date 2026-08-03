// data/surfaces.js — surface slots (RUN19 Z6).
//
// Until Z6 a lamp could only ever stand on the floor beside a table, because a placement had
// no way to say "on top of that". SURFACE_SLOTS declares, per item, where things can sit on it
// and how high its surface is; SMALL_ITEMS declares which items are small enough to sit.
//
// Same convention as data/sockets.js — deliberately, so there is one geometry language in the
// codebase rather than two:
//   x        = fraction of the PARENT's rendered width from its centre (negative = left)
//   surfaceY = fraction of the parent's own rendered BOX HEIGHT that its surface sits above the
//              parent's own GROUND LINE — the y=120 line of the shared 0 0 120 130 deco viewBox
//              in js/art.js renderDeco.
//
// RUN21B item 5 — the exact identity, because this comment used to say only "above its ground
// line" and town.js's said "from the parent's rendered BOX BOTTOM", and neither was checkable:
//
//     surfaceY = (120 - S) / 130,   S = the surface's own y in the 0 0 120 130 deco viewBox
//
// The two facts that make it that and not something else:
//   * renderPlaced sets an item's box top to (rowGround - size + 8), so the art's y=120 line —
//     NOT the box bottom — lands at (rowGround + 8). The box bottom is a further size*10/120
//     below it, which is the transparent margin the viewBox leaves under the ground line.
//     town.js's `(pGround + 8) - surfaceY * pHeight` therefore measures from the GROUND LINE.
//   * the multiplier is the full 130-unit BOX height, not the 120 units above the ground line.
// Every number below is now read straight off the art with that identity, and the residual
// float it leaves is 0 by construction at every parent scale. What it does NOT fix by itself is
// the CHILD term — see SMALL_ITEM_BASE_Y.
//
// A bookshelf has TWO shelves, so its slots carry their own surfaceY and override the item's.

export const SURFACE_SLOTS = {
  deco_table:        [{ x: -0.22 }, { x: 0.22 }],
  deco_kitchentable: [{ x: -0.22 }, { x: 0.22 }],
  deco_counter:      [{ x: -0.3 }, { x: 0 }, { x: 0.3 }],
  // Shelf slot 0 is the LOWER shelf, slot 1 the UPPER — the order the old 0.35/0.68 pair
  // already implied. Both were guesses: on deco_bookshelf 0.35 = y 74.5, which is mid-air
  // between the divider (y=64) and the lower shelf's floor (y=102), and 0.68 = y 31.6, which
  // is ABOVE the top of the upper row of books (y=30). Read off the art, a shelf's floor is
  // where its own books stand.
  deco_bookshelf:    [{ x: -0.18, surfaceY: 0.138 }, { x: 0.18, surfaceY: 0.462 }],   // books stand at y=102 / y=60
  deco_bookshelf2:   [{ x: -0.18, surfaceY: 0.108 }, { x: 0.18, surfaceY: 0.308 }],   // books stand at y=106 / y=80
  deco_bookshelf3:   [{ x: -0.18, surfaceY: 0.262 }, { x: 0.18, surfaceY: 0.462 }],   // planks' top faces y=86 / y=60
  deco_toybox:       [{ x: 0 }]
};

// The height of each surface. RUN21B item 5 re-measured every one against the art (before ->
// after, with the viewBox y it now names):
//   table        0.55 -> 0.492  the tabletop ellipse's top face where the slots actually sit:
//                               ell(60,62,34,10) is at y=55.7 at x=±26.4, which is where slot
//                               x ±0.22 lands. (0.55 meant y=48.5, ABOVE the tabletop
//                               entirely, which is the float item 5 was sent to fix; the
//                               ellipse's own centre line, y=60, sinks a lamp half into it.)
//   kitchentable 0.55 -> 0.492  the top face of the slab rrect(16,56,88,12), y=56
//   counter      0.62 -> 0.508  the top face of the slab rrect(12,54,96,12), y=54
//   toybox       0.45 -> 0.508  the lid's top face rrect(20,54,80,16), y=54 — 0.45 meant y=61.5,
//                               half a lid DOWN, so a lamp sank into the toybox instead
export const SURFACE_Y = {
  deco_table: 0.492,
  deco_kitchentable: 0.492,
  deco_counter: 0.508,
  deco_bookshelf: 0.138,    // the slots carry their own two shelves; this is the fallback
  deco_bookshelf2: 0.108,
  deco_bookshelf3: 0.262,
  deco_toybox: 0.508
};

// RUN21B item 5, the CHILD half of the residual. A parent's surfaceY says where the tabletop
// is; it says nothing about where the thing standing on it stops being drawn. Every small item
// shares the same 0 0 120 130 viewBox, and NONE of them draws down to the y=120 ground line:
// the lamp's foot ends at y=104, the plant's pot at y=114, the frame at y=110. town.js used one
// flat stand-in for all of them (a 10/130 nudge, exactly right only for art ending at y=110.8),
// so the lamp floated ~6% of its own size above every surface and the plant sank ~3% into it —
// which is why fixing SURFACE_SLOTS ys alone could never close the gap. This is the y at which
// each item's art actually stops, so town.js can land THAT line on the surface.
// Default 120 (the nominal ground line) for anything not listed.
export const SMALL_ITEM_BASE_Y = {
  deco_tablelamp: 104,     // rrect(52,96,16,8) foot
  deco_lamp2: 104,         // same foot
  deco_plant1: 114,        // pot path M44 96 L76 96 L72 114 L48 114 Z
  deco_photoframe: 110     // rrect(24,26,72,84) frame
};
export const baseYFor = (itemId) => SMALL_ITEM_BASE_Y[itemId] != null ? SMALL_ITEM_BASE_Y[itemId] : 120;

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
