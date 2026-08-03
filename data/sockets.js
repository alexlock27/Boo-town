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
  // yFrac is a FRACTION of the item's own rendered height, so it survives a size change
  // untouched — which is what makes RUN21B item 3's re-baseline safe for every seat below.
  // The re-measure it did need was arithmetic: several values were eyeballed to within a
  // rounding of the art rather than read off it. Each now states the viewBox y it means, and
  // r10p2-sockets cross-checks that y independently.
  deco_seesaw:     [{ x: -0.32, row: 2, flip: 1, yFrac: -0.338 }, { x: 0.32, row: 2, flip: -1, yFrac: -0.338 }],   // plank top y=76 (unchanged size)
  // RUN21B item 3: deco_bench is the ONLY bench — the pack's indoor "bench" and outdoor "cosy
  // bench" are the same object — and it was on the 92 fallback, so its seat sat 0.31xB off the
  // ground. At 154 it is 0.52xB and two Boos read as sitting on it rather than around it. x
  // stays ±0.2: it is a fraction of the rendered width, so it grew with the bench, and at the
  // new size the pair sit shoulder to shoulder with ~13% overlap, which reads as cosy.
  deco_bench:      [{ x: -0.2, row: 2, yFrac: -0.277 }, { x: 0.2, row: 2, yFrac: -0.277 }],                        // seat top y=84 -> (84-120)/130
  // RUN21A-14 re-measure (1024x768, scale 1): this entry was already right — x:0 centres
  // the rider between the ropes (viewBox x=52/68) and yFrac -0.244 = plank top y=88 via
  // (88-120)/130. The crossbar perch came from the swing ROLE's baked -30px baseline in
  // town.js stepRole (now +5; svg-bottom lands 0.2px off the plank line at rest).
  deco_swings:     [{ x: 0, row: 2, yFrac: -0.244 }],
  deco_slide:      [{ x: 0.38, row: 2, role: 'mount' }, { x: -0.35, row: 2, role: 'queue' }],
  deco_trampoline: [{ x: -0.2, row: 2 }, { x: 0, row: 1 }, { x: 0.2, row: 2 }],
  deco_picnic:     [{ x: -0.18, row: 2, yFrac: -0.192 }, { x: 0.18, row: 2, yFrac: -0.192 }],                      // bench top y=95 (size unchanged)
  deco_paddlepool: [{ x: -0.15, row: 2, yFrac: -0.200 }, { x: 0.15, row: 2, yFrac: -0.200 }],                      // water line y=94 (size unchanged)
  deco_pond:       [{ x: 0, row: 2, role: 'fish', yFrac: -0.077 }],                                                // near bank y=110 (size unchanged)
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
  // RUN19 Z3 re-seated the beds, twice, against screenshots.
  //
  // What was wrong: x/-0.06 put the sleeper over the HEADBOARD, yFrac/-0.323 put it on the
  // bed FRAME rather than the bedding, and RUN13 T3's `rotate(-90deg)` at 0.86 scale made a
  // round Boo read as TOPPLED OVER on top of a bed rather than tucked into one — the bed
  // itself was almost entirely hidden behind it.
  //
  // What it is now, read straight off the art (renderDeco 'bed', 120x130 viewBox, ground
  // line y=120): frame 20..100 x 78..108, pillow 26..50 x 66..86, duvet 50..96 x 82..102.
  // The sleeper sits UPRIGHT with its head on the PILLOW — pillow centre x=38, so
  // (38-60)/120 = -0.183 — and low enough that the duvet crosses its body: bottom at y=100,
  // so (120-100)/130 = 0.154. town.js also drops its z-index below the bed's, so the duvet
  // genuinely covers it. That is the picture a child draws of somebody in bed.
  //
  // `role:'nap'` was dead data until Z3 — nothing anywhere read the field. give() reads it
  // now, so it is the marker that turns a seat claim into a real nap.
  //
  // RUN21B item 3 re-measure, at the new deco_bed base size (150 -> 212). The bed grew, so the
  // seat had to be read again — and reading it again found the ACCEPT ("duvet covers the Boo,
  // head on pillow") was not being met at ANY size, because both numbers pointed at the pillow
  // rather than at the bed. x/-0.183 = the pillow's centre (viewBox x=38), so the sleeper sat
  // clear of the duvet, which only starts at x=50; yFrac/-0.262 = the pillow's BOTTOM (y=86),
  // which put the sleeper's whole body ABOVE the duvet's top edge (y=82) — measured, its drawn
  // bottom landed at y=80.7, so the duvet crossed none of it. Z3's own comment describes the
  // value it meant ("low enough that the duvet crosses its body: bottom at y=100") and then
  // records the sign inverted, which is how -0.154 became -0.262.
  //   x     -0.183  UNCHANGED. It is the pillow's centre (viewBox x=38) and re-measuring it
  //                    at 212 confirmed it: 75% of the sleeper's drawn width lies over the
  //                    pillow (26..50) and its right shoulder reaches the duvet's left edge.
  //                    Photographed x -0.10 and -0.04 as well; both slide the head off the
  //                    pillow into the middle of the bed, which reads as a Boo behind a
  //                    bolster rather than one with its head on a pillow.
  //   yFrac -0.262 -> -0.242  = (88.5-120)/130. -0.262 is the pillow's BOTTOM (y=86) and left
  //                    the sleeper's drawn bottom at y=81.5 — half a unit ABOVE the duvet's top
  //                    edge (y=82), so the duvet crossed none of it and only the frame did.
  //                    y=88.5 puts the drawn bottom at 84, inside the duvet band 82..102, and
  //                    still leaves 18.3 viewBox units (37px at 1024x768, 14px at 390) of head
  //                    clear above the pillow's top edge.
  //                    Photographed -0.185, -0.200, -0.238, -0.278 and -0.300 as well. Lower
  //                    than -0.24 buries the head; higher lifts the body clear of the bedding
  //                    so the sleeper reads as STANDING BEHIND the bed. The window is narrow
  //                    because a Boo's face occupies the LOWER half of its own art (eyes at
  //                    viewBox y 66..94 of 21..118) while the bed occludes from y=66 down —
  //                    the two artworks, not the numbers, are what bound this.
  deco_bed:        [{ x: -0.183, row: 2, yFrac: -0.242, role: 'nap' }],
  deco_bunkbed:    [{ x: -0.183, row: 2, yFrac: -0.185, role: 'nap' }, { x: -0.183, row: 2, yFrac: -0.539, role: 'nap' }],  // lower bunk, upper bunk (size unchanged; re-measured, still on the art)
  // Kitchen - SNACK: a Boo stands AT the table (feet on its floor line), nibbling.
  // RUN21B item 3: the x's widen with the tables' new sizes so the Boos flank the top instead
  // of standing on it — at ±0.30/±0.32 a pair of Boos (each ~0.25 of the table's rendered width
  // per side) covered the whole tabletop and the table read as missing. And all three shared
  // yFrac -0.138 = y 102, which is deco_table's floor line and nobody else's: the kitchen
  // table's legs end at y=106 and the counter's carcass at y=108, so a Boo at either stood 4-6
  // viewBox units above its own floor. Each now names its own.
  deco_table:      [{ x: -0.40, row: 2, yFrac: -0.138 }, { x: 0.40, row: 2, yFrac: -0.138 }],            // legs meet the floor at y=102 -> (102-120)/130
  deco_kitchentable: [{ x: -0.40, row: 2, yFrac: -0.108 }, { x: 0.40, row: 2, yFrac: -0.108 }],          // legs meet the floor at y=106 -> (106-120)/130
  deco_counter:    [{ x: -0.34, row: 2, yFrac: -0.092 }, { x: 0.34, row: 2, yFrac: -0.092 }],            // carcass meets the floor at y=108 -> (108-120)/130 (size unchanged, so x is untouched)
  deco_stool:      [{ x: 0, row: 2, yFrac: -0.323 }],                                                    // seat y=78 -> (78-120)/130; base 95 -> 149 lifts it 0.32xB -> 0.50xB
  // Lounge - LOUNGE: the sofa's cushion line is y=80; the rug is floor level.
  // RUN21B item 3: sofa and armchair draw the SAME cushion geometry, so they now share a size
  // (172) as well as this yFrac; the armchair used to sit 0.38xB against the sofa's 0.48xB
  // purely because its base size was 130 against the sofa's 165.
  deco_sofa:       [{ x: -0.22, row: 2, yFrac: -0.308 }, { x: 0.22, row: 2, yFrac: -0.308 }],           // cushion line y=80 -> (80-120)/130
  deco_armchair:   [{ x: 0, row: 2, yFrac: -0.308 }],                                                    // same cushion line y=80
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
