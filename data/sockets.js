// data/sockets.js — Town 4.0: activity sockets (RUN10 P2).
// x = fraction of the ITEM's rendered width, measured from its centre (negative = left).
// row = depth row (0 back .. 2 front) the seated Boo settles onto — usually matches the
// item's own row, but a socket may sit a row further back/front for visual variety.
// flip = -1 mirrors the seated pose horizontally (so two seesaw riders face each other).
// role = a semantic tag future packets read (P3's pond fishing act uses role:'fish').
// yFrac = fraction of the item's own rendered HEIGHT the seat surface sits above its
// ground line (negative = up), read from the shared 120x130 deco viewBox (art.js
// renderDeco) seat geometry, then iterated against real screenshots for pixel contact
// (town.js `give()`; slide/trampoline/bumper omit it — their per-frame role animation
// already computes its own seat-height offset, so a static yFrac would double-apply).
export const SOCKETS = {
  deco_seesaw:     [{ x: -0.32, row: 2, flip: 1, yFrac: -0.337 }, { x: 0.32, row: 2, flip: -1, yFrac: -0.337 }],
  deco_bench:      [{ x: -0.2, row: 2, yFrac: -0.274 }, { x: 0.2, row: 2, yFrac: -0.274 }],
  deco_swings:     [{ x: 0, row: 2, yFrac: -0.244 }],
  deco_slide:      [{ x: 0.38, row: 2, role: 'mount' }, { x: -0.35, row: 2, role: 'queue' }],
  deco_trampoline: [{ x: -0.2, row: 2 }, { x: 0, row: 1 }, { x: 0.2, row: 2 }],
  deco_picnic:     [{ x: -0.18, row: 2, yFrac: -0.191 }, { x: 0.18, row: 2, yFrac: -0.191 }],
  deco_paddlepool: [{ x: -0.15, row: 2, yFrac: -0.198 }, { x: 0.15, row: 2, yFrac: -0.198 }],
  deco_pond:       [{ x: 0, row: 2, role: 'fish', yFrac: -0.074 }],
  deco_bumper:     [{ x: 0, row: 2 }]
};

// Hide-and-seek 2.0 (RUN10 P5): where the daily hider peeks from on each hide-capable
// item. x = fraction of the item's rendered width from its centre (same convention as
// SOCKETS); row = which depth row the peek sits at (usually the item's own); peek picks
// which partial-sprite reads best for that item's silhouette (a tall trunk hides ears
// best, a low bush hides feet, a rounded trunk/rock reads as a tail poking out).
export const HIDE_POINTS = {
  deco_palm:     { x: 0.18, row: 1, peek: 'tail' },
  deco_oak:      { x: 0, row: 1, peek: 'ears' },
  deco_pine:     { x: 0, row: 1, peek: 'ears' },
  deco_bush:     { x: 0, row: 1, peek: 'feet' },
  deco_bench:    { x: 0.28, row: 2, peek: 'feet' },
  deco_rock:     { x: -0.15, row: 1, peek: 'tail' },
  deco_boohouse: { x: 0, row: 1, peek: 'ears' }
};
