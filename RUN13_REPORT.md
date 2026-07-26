# RUN13 — CARE, HOUSE & COSMETICS

Packets T0–T6. Baseline: `run12-s13-20260726` live, 120 board suites, save VERSION 14.
Final: save VERSION 15, five new permanent suites, four deploys.

The pack had two standing laws of its own on top of house law:

- **G8, direct manipulation.** On a touch-and-mouse device a care or craft action is
  performed by touching the thing and moving it. Arrow buttons, step controls and abstract
  +/- widgets are forbidden as the primary interaction for any physical action.
- **G9, no guilt.** Nothing about a Boo decays, dirties, saddens, hungers or degrades with
  time. Bond only rises. A Boo untouched for a year greets her identically.

---

## 1. The care audit: before and after

T0 drove every care action to completion at 1024x768, 768x1024 and 390x844 before a line of
it was changed (`tests/run13_care_audit.md`, raw record in `screenshots/run13/t0/probe.json`).

| | Before (audited at `run12-s13`) | After (T1, live at `run13-t1t2`) |
|---|---|---|
| **Brush Teeth** | Two `←` / `→` button slabs, **258x100px** at 1024 (127x100 on phone), the largest objects on the stage. Dragging the toothbrush registered **0 scrubs**. A wrong-side tap was a **silent no-op** — no sound, no wobble, no text. The status line had to spell out the widget. | The toothbrush is dragged onto the mouth zone; 40px of in-zone travel = one scrub; 12 scrubs complete it. Foam grows in four stages, then puffs away on a giant grin and a rising ping. Releasing early keeps every scrub. **The arrow controls no longer exist.** |
| **Feed** | Tap-only. The treat was code-flung on a 600ms arc with no pointer handlers. First feedback at **1102–1134ms** — five times the 200ms feel goal. | The treat is a real object dragged from the pocket to the mouth. First feedback in **50–52ms**. Tap-to-feed survives as the keyboard fallback only. |
| **Brush fur** | Already a real drag and it worked. But `firstFeedbackMs: null` over a 3.1s idle sample — the screen was completely still until the child guessed. Brush parked ~200px from the Boo. No visible fur change between strokes. | The tool beckons, sparkles trail the stroke, a shine sweeps the fur after every stroke, three strokes end in a shiver of joy. |
| **Bath** | Did not exist. | A sponge raises bubbles over ten rubs, the Boo splashes and hums two notes, completion pops every bubble at once and leaves a gleam. |
| **Play** | Peekaboo only. 9.2s long with 1.2s of dead air, and `.care-peek-target` was an unstyled transparent button — the child was told "Look!" with nothing drawn to look at. | Peekaboo kept, tightened, with the eyes actually **drawn**. Plus a second variant chosen at random: a ball she drags and throws, which the Boo chases and brings back, three fetches. |
| **Progress** | No progress ring anywhere. Progress was a sentence. | A ring around the Boo fills as the action completes, on all five. |
| **Dead ends** | Teeth and Brush both idled indefinitely with zero response if the child never found the right control. | A tool that is picked up and put down without moving wiggles and says so. Nothing is ever silence. |

Evidence: eight pixel-hashed frames per action per viewport in `screenshots/run13/t1/`, all
8-of-8 distinct; before/after stills of the same actions in `screenshots/run13/t0/`.

---

## 2. G8 compliance statement

**Boo Care contains no arrow button, no step control and no +/- widget.** This is asserted
four ways in `tests/r13t1-care-direct.mjs`, and the suite is on the permanent board:

1. **Source.** `js/care.js` contains no arrow glyph in a control (`['←','→','↑','↓',…]` — zero
   matches), no `.care-scrub` class in either the module or the stylesheet, and no
   `care-step` / `care-plus` / `care-minus` identifier.
2. **Render.** Every action is opened at all three viewports and every `button` /
   `[role=button]` inside the care stage is checked against `/^[←→↑↓+\-]$/`. Fifteen
   action-viewport combinations, zero matches.
3. **Interaction.** Every action is completed by a **real synthetic pointer stream** —
   press the tool, carry it into the zone, work it back and forth, release — not by a test
   hook. Twelve completions across three viewports.
4. **Fallback boundary.** The one press that exists is keyboard-only: the handler ignores
   any click with `detail !== 0`, so a bare tap on a tool picks it up and puts it down and
   nothing else. A test taps each tool with a real mouse and asserts nothing happens, then
   presses Enter on it and asserts the whole action completes with its payoff.

The room switcher added in T3 is a labelled tab strip, not edge arrows. It is navigation
between scenes rather than a physical action, so G8 does not reach it; the strip was chosen
anyway so a child can read where she is going.

**G9 is intact and asserted.** A 30-simulated-day absence leaves care state deep-equal; the
grep guard for downward-state identifiers covers `js/care.js` and `data/care.js`; the Bath
block is separately checked for accusatory language ("bath time is fun", never "you need
washing"); the snack socket writes nothing resembling hunger to the save. `POINTS` values are
add-only and every pre-existing one is unchanged — `bath: 3` is the only addition.

---

## 3. New-item inventory

### Care (T1)
| Item | Detail |
|---|---|
| Bath | New fifth care action, 10 sponge rubs, `POINTS.bath = 3` |
| Ball fetch | Second Play variant, 3 fetches, chosen at random against peekaboo |
| Progress ring | Shared, on all five actions |
| Named constants | `TEETH_TARGET` 12, `TEETH_TRAVEL_PX` 40, `FOAM_STAGES` 4, `FUR_TARGET` 3, `FUR_TRAVEL_PX` 60, `BATH_TARGET` 10, `BATH_TRAVEL_PX` 45, `BALL_TARGET` 3 |

### The Boo House (T3)
Three rooms — **Lounge** (the original storage key), **Kitchen**, **Bedroom** — each its own
placeable scene with its own wall/floor rows, build mode and camera. Three room-appropriate
socket behaviours, all riding the existing socket loop: `housenap` (beds), `snack` (tables,
counters, stools) and `lounge` (sofas, armchairs, rugs — with a two-Boo chat).

### Furniture and decor (T4) — 24 items
Armchair · Stripy Rug · Star Rug · Low Bookshelf* · Corner Shelves* · Toy Box · Photo Frame*
· Kitchen Table · Kitchen Counter · Little Stool · Fridge · Little Oven · Bunk Beds ·
Painted Wardrobe · Paper Lamp† · Floor Lamp† · Little Pot Plant · Tall Leafy Plant ·
Hanging Ivy* · Wall Clock*† · Round Mirror* · Sunshine Picture* · Mountain Picture* ·
Squiggle Picture*
&nbsp;&nbsp;\* wall-hung (9 of 24) · † carries a night state

### Cosmetics (T5) — 12 accessories, 2 costume sets, 10 dance moves, 18 idles
| Slot | Items |
|---|---|
| hat | Bobble Beanie · Party Hat · Fluffy Earmuffs · **Comet Cape** (`motion: 'flutter'`) |
| face | Freckles · Monocle · Spotty Bandana · Snorkel Mask |
| feet | Stripy Trainers · Bunny Slippers · **Springy Boots** (`locomotion: 'spring'`) · **Swim Flippers** (`locomotion: 'flap'`) |

Costume sets: **Astronaut** (helmet + boots, slow-motion moon-bounce idle) and **Pirate**
(hat + eyepatch, hearty wave idle). Both equip atomically with their ceremony; pieces come
off individually.

Dance moves, ten: bounce · sway · spin · sway-small · shimmy · star-jump · wiggle · robot ·
clap · twirl. Each of the six temperaments prefers three, re-picked every bar. A
**Boo of the moment** takes the centre floor for exactly eight bars, rotating through the
roster so every Boo gets a turn.

Idles, two per species (nine species, eighteen idles): a universal blink-and-look-around plus
a species flavour — jiggle (bloop), ear-flick (pip), nibble-air (munch), antenna-bob (twirl),
sun-stretch (sunny), twinkle (nova), snuggle-down (snug), zoom-shiver (zippy), neck-crane
(giraffe). Hard-capped: 14s minimum gap per Boo, 3 per rolling minute per Boo, 4 concurrent
per scene.

---

## 4. Save migration

**VERSION 14 → 15.** The Boo House's Lounge **keeps the original `boohouse` storage key**, so
a pre-rooms house is not rewritten at all: every placement, row, scale and floor path stays
byte-identical and simply becomes the Lounge. `boohouse_kitchen` and `boohouse_bedroom` join
the same backfill loop that has kept the eight area keys honest since v6, created empty.

`tests/r8p1-migrations.mjs` gained a furnished pre-rooms Boo House in every era from v6 and
asserts the Lounge's items and paths come through byte-identical, that both new rooms exist
and are empty, and that migrating twice changes nothing.

A useful identity fell out of the socket work and is now written down in `data/sockets.js`:

    yFrac = (seatY - 120) / 130

where `seatY` is the surface's own y in the shared 0 0 120 130 deco viewBox. It follows from
`town.js give()` and `renderPlaced()`, and it means every socket can be checked by hand
rather than dialled in by eye. The first three T3 values were guesses and were 12–16px out.

---

## 5. Suite deltas

| Packet | Suites |
|---|---|
| T0 | none — audit only, board untouched (probe lives under `tests/lib/`, outside the glob) |
| T1 | **+`r13t1-care-direct`** (147 assertions) NEW-GREEN; `r10p12-care` updated, 3 superseded assertions justified in-file |
| T2 | **+`r13t2-care-discovery`** (64 assertions) NEW-GREEN |
| T3 | **+`r13t3-house-rooms`** (52 assertions) NEW-GREEN; `r8p1-migrations` extended with the v15 era case; `r12s1-routes` red→green |
| T4 | **+`r13t4-furniture`** (37 assertions) NEW-GREEN; `m2-collection` red→green |
| T5 | **+`r13t5-cosmetics`** (67 assertions) NEW-GREEN |

**Five G3 test changes, each justified:**

1. `r10p12-care` — three assertions superseded by T1: "four care actions" (Bath made it five),
   "six alternating scrub taps" (the alternation was only meaningful because of the arrow
   control that was the pack's named G8 violation), and the `stroke()`/`scrub()` hooks
   (replaced by the single honest `travel()` the engine actually measures).
2. `r10p12-care` — pins `window.__carePlayVariant = 'peek'`. T1 gave Play two variants chosen
   by a coin toss; its peekaboo assertions were a 50/50 flake without a pin.
3. `r12s1-routes` — a fixture for the new `town` route param `room`. **This suite caught the
   gap on its own**, which is exactly what RUN12 S1 built it to do.
4. `r8p1-migrations` — extended, not weakened: a furnished pre-rooms Boo House now rides
   through every era and is asserted byte-identical on the far side.
5. `m2-collection` — "70 collectibles" was hardcoded and went stale the moment 24 pieces of
   furniture joined. It now reads `TOTAL_ITEMS` from the catalogue, so the assertion it
   actually cared about (every collectible has a tile, five owned, the rest silhouettes)
   can never drift again.

---

## 6. Two defects the packets' own evidence found

**The contrast pass found a layout collision, not a colour bug.** T2's pixel audit measured
`.care-status` at **1.13–1.24:1** at all three viewports. The text colour was fine; the
bobbing tool was physically sitting on top of it. Guidance moved to the top of the care
stage and the tools own the bottom edge. A contrast audit that samples real pixels catches
things a CSS audit cannot see.

**An infinitely-animating button box is untestable and hostile to hit-testing.** The care
tools' "pick me up" bob made Playwright's `click()` hang on *element is not stable*. The
animation moved onto an inner `.tool-glyph` span so the button's own box never moves —
better for pointer capture, keyboard focus and every future reachability sweep.

---

## 7. Harness note that applies to every future run

`python -m http.server` speaks HTTP/1.0 and closes the socket after every response, so a
context-heavy Playwright suite burns one ephemeral TCP port per file per page load. On
Windows that exhausts the 49152–65535 dynamic range (sockets sit in TIME_WAIT for ~4
minutes) and pages start failing mid-suite with `net::ERR_ADDRESS_IN_USE` — 5,612 sockets
were in TIME_WAIT when it first bit. **Use `python scripts/serve.py 8123`** (HTTP/1.1,
keep-alive), added in this run.

---

## 8. Remaining gaps

1. **Cross-room routing is per-room, not house-wide.** "At night Boos in the house route to
   the Bedroom" is implemented as: within the Bedroom, at night, beds are claimed first. A
   Boo standing in the Lounge does not walk through to the Bedroom, because the rooms are
   separate scenes and moving her would mean rewriting a placement the child made. A
   house-wide router would need a placement-preserving way to express "she is in the house"
   separately from "she is at this spot in this room".
2. **Room-affinity is item-driven, not room-gated.** A sofa is a lounge socket wherever it is
   placed, including the Kitchen. This was deliberate — gating by room would leave furniture
   dead in the "wrong" room, which is worse — but it means the rooms are a framing rather
   than a rule.
3. **Bunk-bed upper socket is authored, not yet pixel-verified.** `deco_bunkbed`'s two nap
   sockets carry `yFrac` values from the identity above; only the single-bed case has a
   pixel-contact assertion. The upper bunk should get one.
4. **The photo frame does not react to a nickname change.** It re-renders with the scene, so
   it will pick up a change on the next render, but there is no explicit invalidation.
5. **RUN15's shop will need prices for all 24 new furniture items** — they currently roll
   from boxes at decoration odds and have no price.
6. **The care intro is not toddler-voiced.** It uses the standard three-step intro with
   `speakMaybe`, which is correct, but the toddler tier's authored per-action lines
   (`TODDLER_LINES`) are separate from it.
