# RUN21F item F6 — "Visit a Town" · progress ledger

Branch `run21f6`, worktree `Boo-town-run21f6-wt`, port 8061. Item F6 ONLY.
F6 completes RUN21A item 11 (the 💌 export half was already live).

## Steps
- [x] 1. Ledger + branch pushed
- [x] 2. state.js: an in-memory VISIT session (mutate/scheduleSave/commit inert while it runs)
- [x] 3. js/visit.js: postcard parse + sanitised snapshot + the banner + Leave (in sw.js ASSETS)
- [x] 4. main.js: `ctx.readonly` set per mount; any non-town/worldmap route ends the visit
- [x] 5. grownups.js: the `Visit a Town` paste box, on its own tab
- [x] 6. town.js: readonly — tray never mounts, no mutation path, taps still delight
- [x] 7. worldmap.js: readonly — no 💌, no unlock ceremony, the Gallery badge does not open
- [x] 8. CSS for the banner (measured height so the line wraps on a phone) + the paste box
- [x] 9. tests/r21f6-visit.mjs — the pack's ACCEPT, literally
- [x] 10. Suites + evidence + report

## What runs for a visitor, and why
KEPT (a read-only town must still be a place, not a photograph):
- the whole actor engine — wandering, roles, seats, naps, greetings, catchphrases
- RUN21D's opening **Pulse** and its 9s invitation ("Try tapping a flower…"): save-free,
  and it is the one line that tells a visitor there is something to do. Every invitation
  stays TRUE in a visit — they all invite a tap, never an arrangement.
- RUN21D's `panToFrac`/`cameraClaimed`: panning is looking, which is the whole feature
- RUN21B's per-word wish art and `pumpWishIdles`: DOM-only, and the postcard carries wishes
- squeaks, care arcs (and the care overlay behind them), wish tap verbs, pond ripples,
  waking a napper, area signatures, weather/ambient life, the landmark dots and edge shimmer
DROPPED:
- every mutation path (state.js makes them inert; town.js also refuses them outright)
- the tray, the Path Pot, the 5-step undo, the resize handle/pinch, the play card
- the doors: shop stall, bandstand, Disco, ride picker, joke stage, Wish Well, Gallery badge
- growth/funfair ticks and their reveals, request generation, quest ticking, the day's hider
  (nothing of a friend's progress is a visitor's to advance or be congratulated for)
- the 💌 on the visited map, and the map's unlock ceremony

## Deviations
- `DEVIATION: pack said "town/worldmap mount with ctx.readonly = true" → ctx is ONE shared
  object in main.js, so a screen setting it would leak into the next screen → the router
  sets `ctx.readonly = State.isVisiting()` before every mount, from the single source of
  truth, and ends the visit for any route that is not town/worldmap.`
- `DEVIATION: pack said "all mutate() calls no-op" → that alone leaves half-alive gestures
  (a dragged item slides then snaps back; a tapped stall opens the shop against a save that
  refuses to change) → mutate() IS a hard no-op (state.js), and town.js additionally refuses
  the gestures themselves, so nothing is offered that cannot happen.`
- `DEVIATION: pack said the paste box is "in Grown-ups" → put beside the restore box it is
  the answer to, it sat below a very long backup card → it is its own tab, placed BEFORE
  "Backup & data" so RUN6 C0.2's rule (Settings first, Backup & data last) still holds.`
- `DEVIATION: pack said a banner "across the top" → at 390px the authored sentence was
  ellipsised → the line wraps to two lines on a phone and js/visit.js publishes the banner's
  measured height as --visit-banner-h, so the screen below always starts under it.`

## Known limitations (data the postcard does not carry — RUN21A item 11's contract)
- a friend's **custom Boos** (`custom:*`) carry no parts in the postcard, so they render as
  nothing (town.js's `if (!item) continue;`) rather than as a broken sprite
- a friend's **funfair rides** beyond the day-one Carousel, their **growth milestones**,
  **stars**, **trophies** and **gallery** are not in a postcard; every area is opened so no
  placement is hidden, and the Gallery badge does not open
- the **dusk visitor** repeats its giggle (its "tapped" flag cannot be recorded) and the
  `crown` wish verb says its line without crowning anyone (the crown is a saved fact)

## Blocked
(none)
