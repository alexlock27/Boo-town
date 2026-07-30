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
  deco_bumper:     [{ x: 0, row: 2 }],
  // ---- RUN13 T3: house furniture sockets ------------------------------------------------
  // Same convention as above: x = fraction of the item's rendered width from its centre,
  // yFrac = fraction of its rendered height the surface sits above its own ground line,
  // both read from the shared 0 0 120 130 deco viewBox in art.js renderDeco and then
  // measured against real screenshots for pixel contact (r13t3-house-rooms).
  // Bedroom - NAP: the mattress top is y=78, so the sleeper lies on it, not beside it.
  // yFrac = (seatY - 120) / 130, where seatY is the surface's own y in the 0 0 120 130
  // deco viewBox. That identity falls straight out of town.js `give()` and renderPlaced()
  // and is what makes these values checkable by hand rather than dialled in by eye.
  deco_bed:        [{ x: -0.06, row: 2, yFrac: -0.323, role: 'nap' }],                                   // mattress top y=78
  deco_bunkbed:    [{ x: -0.04, row: 2, yFrac: -0.231, role: 'nap' }, { x: 0.04, row: 2, yFrac: -0.585, role: 'nap' }],  // lower y=90, upper y=44
  // Kitchen - SNACK: a Boo stands AT the table (feet on the floor line, y=102), nibbling.
  deco_table:      [{ x: -0.30, row: 2, yFrac: -0.138 }, { x: 0.30, row: 2, yFrac: -0.138 }],            // legs meet the floor at y=102
  deco_kitchentable: [{ x: -0.32, row: 2, yFrac: -0.138 }, { x: 0.32, row: 2, yFrac: -0.138 }],
  deco_counter:    [{ x: -0.34, row: 2, yFrac: -0.138 }, { x: 0.34, row: 2, yFrac: -0.138 }],
  deco_stool:      [{ x: 0, row: 2, yFrac: -0.323 }],                                                    // seat y=78
  // Lounge - LOUNGE: the sofa's cushion line is y=80; the rug is floor level.
  deco_sofa:       [{ x: -0.22, row: 2, yFrac: -0.308 }, { x: 0.22, row: 2, yFrac: -0.308 }],           // cushion line y=80
  deco_armchair:   [{ x: 0, row: 2, yFrac: -0.308 }],
  deco_rug:        [{ x: -0.20, row: 2, yFrac: 0 }, { x: 0.20, row: 2, yFrac: 0 }]                       // flat on the floor
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

// ---- venue sockets (RUN12 S7) ---------------------------------------------------------
// SOCKETS above covers the TOWN, where RUN10 P2 gave every seatable decoration a seat with
// pixel contact. Venues built after it never adopted anything of the kind: the Disco Hall
// stood its dancers 76px above the dance floor at 1280x720, because .disco-dancers set a
// fixed `bottom: 38%` while the floor is a 3D-rotated plane whose projected surface lands
// wherever the stage height puts it.
//
// Every scene that places a Boo on or against a surface declares it here, or declares in so
// many words that it does not — so a new venue cannot quietly float its Boos again.
//
// Boo art shares the 0 0 120 130 viewBox from js/art.js renderBoo(); the feet are drawn at
// y 108..118, so the visible sole sits this far down the rendered SVG box.
export const BOO_FOOT_FRAC = 118 / 130;

export const VENUE_SOCKETS = {
  discohall: {
    route: 'discohall',
    boos: '.disco-dancer', surface: '.disco-floor',
    // where along the floor's PROJECTED box the dancers stand: 0 = its far edge, 1 = the
    // near edge. Alex, 2026-07-30: was 0.30, which stood the front row near the floor's BACK
    // rail with the whole floor empty in front of them and only ~29px of projected floor left
    // for the two rows behind to recede into. 0.72 stands the front row well forward, which
    // is both what a front row means and what gives FLOOR_ROWS room to show depth.
    surfaceFrac: 0.72, tolerance: 4,
    note: 'js/discohall.js measures the floor each layout — a CSS percentage cannot, because the floor is rotateX(55deg).'
  },
  town: {
    route: 'town', params: { area: 'playground' },
    boos: '.t-actor', surface: null, seatedBy: 'SOCKETS',
    note: 'The town seats Boos through SOCKETS above (RUN10 P2) with per-item yFrac; r10p2-sockets owns its pixel evidence.'
  },
  // --- declared free-floating, with the reason -----------------------------------------
  band: { route: 'band', boos: '.band-room-bopper', freeFloating: true,
    note: 'A decorative trio bopping in the header strip. They are UI garnish beside the instrument buttons, not Boos standing in a room, and there is no floor to stand on.' },
  expedition: { route: 'expedition', boos: '.exp-camp-boo', freeFloating: true,
    note: 'The camp mugs are a 34px ROSTER of who came along, laid out in a row like a team sheet inside the cocoa card, and only while the party is at camp. The party that stands on the TRAIL (.exp-walker, RUN18C C2) does stand on something — but its surface is an SVG path sampled with getPointAtLength, not a box a socket can measure, so it seats itself from the same geometry the path is drawn from.' },
  caper: { route: 'caper', boos: '.caper-suspect .caper-art', freeFloating: true,
    note: 'Suspects are pinned cards on a corkboard. A card hangs; it does not stand.' },
  expeditionpuzzle: { route: 'expeditionpuzzle', boos: '.exp-puzzle-boo', freeFloating: true,
    note: 'The dock is a rack of pickable portrait cards (RUN18C C3 gave them real art), not a place Boos stand — a card is held, it does not stand on a floor.' }
};
