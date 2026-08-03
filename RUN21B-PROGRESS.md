# RUN21B — "Look & Feel" progress ledger

Branch: `run21b` from main @ fec9641 (build run21a-20260803, RUN21A + RUN21F F1–F3 merged).
SAVE VERSION stays 23 — nothing here touches the schema.
Pack: `RUN21-programme/RUN21B-pack.md`. Resume at the first unchecked item.

Prereqs confirmed present: `tools/asset-preview.html`, `tools/anchor-tuner.html` (RUN21F F1/F2).

- [x] Item 1 — Sixty standalone wish artworks (all 60 in `WISH_ART`; evidence:
      `_evidence/run21b/all60-meadow.png`, `all60-room.png`, `all60-silhouette.png`;
      r20-wishlife + r10p20-wishwell + r18b-wish-arrives all still green)
- [x] Item 2 — Ambient life per class (FLIER / BOB / STEAM / GLEAM) — added as a SEPARATE
      axis from `cls`; see deviation 6
- [x] Item 3 — Proportion re-baseline. **B = 74.36px MEASURED** (the standing Boo's DRAWN
      height at scale 1, row 1, 1024x768: six of the ten starter Boos; the eared species reach
      87.4 and 93.5; the SVG box is 99.66). 15 `ACT_SIZE` entries re-based, sockets re-measured,
      resize range re-verified on pixels. See deviations 10–14, 19, 20 and 21.
      Evidence: `_evidence/run21b/ACCEPT-bench-sit.png`, `ACCEPT-bed-nap.png`,
      `ACCEPT-table-snack.png`, `ACCEPT-table-snack-little.png`, `ACCEPT-sofa-lounge.png`,
      `ACCEPT-stool-sit.png` (each `before | after` at 1024x768), `B-boos-row1-before.png`,
      and `seat-*-before.png` / `seat-*-final.png` for all 17 socketed items.
- [x] Item 4 — Slot glow visible (root cause was NOT layering — see deviation 5;
      evidence `_evidence/run21b/item4-glow-indoor-table.png`, `item4-glow-indoor-bookshelf.png`)
- [x] Item 5 — Seat offset polish. Worst float **0.12px** across table, kitchentable, counter,
      toybox and all three bookshelves — every slot, lamp/plant/frame, at parent scales
      0.8 / 1.0 / 1.3 (the ACCEPT asks for ≤2px; it was up to 25.6px). See deviations 15–18.
      Evidence: `_evidence/run21b/ACCEPT-lamp-on-table.png` and
      `item5-<parent>-scale0p8|1|1p3-a.png` (21 frames).
- [x] Item 6 — Feedback scale-up (train 2.2×, ripples, sand, river) — see deviation 8;
      evidence `_evidence/run21b/item6-train-1024x768.png`
- [x] Item 7 — Disco floor spacing (worst overlap 51.7% → 10.2%; see deviation 7;
      evidence `_evidence/run21b/item7-disco-1280.png`, `item7-disco-390.png`)

## BLOCKED
(none yet)

## DEVIATIONS (pack said → what was true → what I did)
1. **Style guide palette.** The pack's anchors are "cream `#F8ECD2`, star gold `#FFC93C`,
   pink `#FF7AC6`, teal `#4E9A8F`, purple `#B9A6F5`", and it says "confirm exact values
   against css vars before starting; vars win." Three do not match the house palette. The
   real source of truth for SVG art is `js/art.js` `COLORS` (CSS custom properties only
   cover ink/star/pop):
   - ink `#2A1B4E` = `--ink` ✅ · gold `#FFC93C` = `COLORS.gold`/`--star` ✅ ·
     pink `#FF7AC6` = `COLORS.pink`/`--pop` ✅
   - cream: pack `#F8ECD2` → **`COLORS.cream` `#FFF8F0`**
   - teal: pack `#4E9A8F` → **`COLORS.teal` `#35D0BA`**
   - purple: pack `#B9A6F5` → **`COLORS.lilac` `#C6A9F0`**
   All 60 artworks are authored against `COLORS`, per the pack's own "vars win" rule —
   otherwise the new art would sit subtly off-palette beside every existing Boo.
2. **Stroke weight.** Pack: "stroke 6 at a 120-unit viewBox". Measured reality: the house
   uses ink stroke **4** with a cream halo at **10** — `renderDeco` (js/art.js:968) and the
   Boo `silhouette()` defaults both. Wishes render in the same viewBox, at the same moment,
   beside those objects; at 6 they would be visibly heavier-lined than everything they sit
   next to. Authored at 4/10, which is what "as in existing Boo art" actually means.
3. **Caption halo (a FIX, item 1).** The pack says keep the caption "beneath at current
   size" — kept, same size, same y=124. But the medallion it replaced was a narrow circle,
   so the word cleared it; real objects fill the full width down to the ground line and the
   caption landed ON them (visible on the first contact sheet: robot, cake, castle, bench,
   guitar). It now gets the same cream halo pass every sticker shape gets.
4. **Wish footprints had nowhere to land (item 1).** The pack assigns every word an S/M/L
   footprint (44/64/84px), but `ACT_SIZE` in town.js had no wish entries at all — all 60
   rendered at the generic default of 92. Exported `WISH_SIZE`/`WISH_PX` from art.js and
   seeded `ACT_SIZE` from them, so the size column the pack authored is actually honoured.

5. **Item 4's diagnosis was wrong, and its ACCEPT names a surface that does not exist.**
   - Pack: "wired on both drag paths yet never seen — almost certainly layering." It is NOT
     layering: the glow lives in the `air` layer at z-index 40 (above every `.t-item`), with
     the same `-scrollX` transform as `ground`, so its world coordinates already line up and
     nothing clips it. The real cause is that it was wired to the two rarest gestures and
     NOT to the common one: the drawer chip-lift. During a lift the drawer strip holds
     pointer capture, so the viewport's `pointermove` never fires; and tap-to-place has no
     pointermove at all. Fixed in `updateChipLift`, plus clears on cancel paths.
   - Pack also says to append the glow to "a viewport-level overlay above all items". That
     overlay already exists and is `air`. Creating a second one would move the glow out of
     world space into screen space and require every position to change — a needless
     regression. Kept `air`, per CLAUDE.md's engine-reuse law.
   - ACCEPT asks for the ring on "a picnic outdoors". **There are no outdoor surface
     parents in the game**: `SURFACE_SLOTS` (data/surfaces.js) holds only table,
     kitchentable, counter, three bookshelves and toybox — all indoor. `deco_picnic` is not
     a surface parent anywhere. Adding one would be new scope (a new placement surface), and
     RUN21E item E9 "Surfaces wave two" is the pack that owns adding parents. Verified on
     the two real surface classes instead (a table and a bookshelf) and flagged for E9.

6. **Item 2's premise was false, and following it literally would have broken taps.**
   - Pack: "the wish idle runner in town.js". There is no such runner — wishes never become
     actors (`makeActor` is gated on `item.kind === 'boo'`), and no loop, timer or scheduler
     for wish idles existed anywhere. One had to be built.
   - Pack: treats FLIER/BOB/STEAM/GLEAM as classes to assign. But `cls` IS THE TAP
     DISPATCHER — town.js switches on it to pick the verb — so re-classing butterfly (FLYER),
     teapot (TAP/steam), crown (TAP/crown), key (TAP/jiggle) or lamp (TAP/lightCone) would
     have silently deleted their tap responses, contradicting the pack's own "Existing tap
     verbs unchanged" in the same paragraph. It would also have failed two structural
     assertions in tests/r20-wishlife.mjs.
   - What I did: added `WISH_IDLE` as a SEPARATE table beside the untouched `cls` table, and
     a second class token `wishidle-*` beside the `wish-<cls>` the verbs bind to. Idle and
     tap are two different questions about the same object; they now have two fields.
   - Also: the wisp is `wish-wisp`, not `wish-steam` — that class already exists as the
     teapot's TAP pose and would have collided silently.
   - Judgement logged: `crown` is in the pack's GLEAM list but is `cls: TAP`; it gets the
     GLEAM *idle* while keeping its crown verb. `balloon` is `cls: FLYER` but is NOT in the
     pack's FLIER list, so it gets no new idle — left as the pack has it.

7. **Item 7: right intent, wrong location — and it missed the real culprit.**
   - Pack: "overflow rows stagger depth instead of overlapping", as though depth rows were
     new. `FLOOR_ROWS` has had three rows with per-row scale and offset since RUN19.
   - Pack: enforce the gap "when assigning floor spots", i.e. in `layoutFloor`. That
     function is a PURE spread whose only input is a count — it cannot see a pixel, and it
     is exported and unit-tested. The gap is therefore enforced in a second width-aware pass
     (`spaceFloor`) called from `buildFloor`, where the container and dancer boxes are
     measurable. Rows that cannot seat everyone hand overflow down a row (= the stagger).
   - **The pack does not mention the spotlight at all, and it was the dominant cause.**
     `vacateCentre` nudged crowded dancers to a fixed 0.35/0.65 while the spotlit dancer
     itself takes 0.5 — leaving a neighbour 71px from it at 1280, where a Boo is 129px wide.
     Row 0 now re-spreads around the spotlight at the measured gap. Without this the ACCEPT
     fails on any spotlit frame, which is most of them.

8. **Item 6: the train is CSS, and "rings grow to 64px" is a shrink.**
   - "cream body + ink outline" reads like an art.js change; the train is not SVG art at all
     but a 74×20 CSS bar (`.t-train`). 2.2× therefore had to hit four coupled numbers —
     width, height, radius and BOTH carriage box-shadows — or the carriages ride up over the
     engine. Its `top` is set inline in JS, so that compensates for the extra height too.
   - "Ripples: rings grow to 64px max" is phrased as growth but is a REDUCTION: the ring
     finished 110px wide while the pond's own water ellipse is only 54–78px across, so it
     spilled onto the grass. Implemented as a smaller box the same transform scales into, so
     the starting ring, the 900ms and the transform-only rule are all unchanged.
   - Two ring elements exist (`.t-ripple` pond taps, `.t-skim-ring` riverside stone skims).
     Read the pack as meaning `.t-ripple`; `.t-skim-ring` left alone.
   - The sand line is deliberately ungated (the pack says "echoes … on footprint taps",
     plural, and the beach has no once-per-visit gate to borrow). The hilltop train keeps its
     existing once-per-visit gate, which also means neither train nor line appears under
     reduced motion — pre-existing, and what "existing once-per-visit rule" asks for.
   - All three strings stay inline in town.js beside the river's, not in data/guideLines.js:
     the hint bar is not guide speech, and ~25 hint strings are already inline there.

9. **Item 3's method is impossible as written; its ACCEPT is not. Ruling, before any code.**
   The pack gives most items TWO targets — a width and a seat/top height, both as multiples
   of the Boo's height B. `ACT_SIZE` scales one shared 120×130 viewBox uniformly, so an
   item's drawn-width : drawn-seat-height ratio is FIXED BY ITS ART and cannot be changed by
   sizing. Measured, the pack wants every paired item wider relative to its seat than the art
   draws it: bench art 1.78 vs pack 3.27 · bed 1.90 vs 4.22 · sofa 2.40 vs 4.80 · armchair
   2.00 vs 2.60 · little table 1.00 vs 1.81 · kitchen table 1.375 vs 2.44. Both numbers can
   only hold if the FURNITURE ART IS REDRAWN, which is not this item (and would be scope
   invention: item 3 is a re-baseline, and item 1 already spent this run's art budget).
   **Ruling, per the dispatch's Fix rule ("acceptance criteria are the target, not the code
   shapes"):**
   a. **B = the Boo's DRAWN height (~76px at scale 1, row 1), not its 99.7px SVG box.** The
      pack's ratios describe what the eye sees; the box carries ~24px of transparent margin.
      Using the box would make every re-baselined item ~32% too big — the opposite of the
      fix. Both readings are recorded here because they differ by 32% and someone will ask.
   b. **Where the two targets conflict, the SEAT/TOP height wins** — that is the number the
      ACCEPT actually tests ("a Boo fits every seat without floating"), and the one the WHY
      is about. Width follows from the art.
   c. **Nothing shrinks that the WHY calls too small.** Several targets computed against B
      would REDUCE the item (wall clock 105→42, photo frame 105→38, pot plant 110→68, table
      lamp 105→65), which contradicts the pack's own opening sentence. Those are treated as
      authored against a different B and left at or near their current size unless a
      side-by-side shows them genuinely oversized.
   d. `deco_bench` "Cosy Bench" is the ONLY bench — the pack's indoor and outdoor lists are
      the same item. It, `deco_pond` and `deco_bookshelf3` have no `ACT_SIZE` entry at all
      and render at the 92 fallback, so they are ADDED, not edited.
   e. "pot plant" is unnamed in the pack; there are three. `deco_plant1` is the only one in
      `SMALL_ITEMS` (it is the one that stands on tables), so it is the one meant.

10. **The ruling needed one more clause: WHICH ground line heights are measured from.**
    Deviation 9a settles that B is the Boo's DRAWN height. It does not say what an item's
    "seat top off ground" is measured from, and the two candidates differ by up to 40%: the
    viewBox's nominal ground line (y=120) or the item's OWN DRAWN BASE (a table's legs stop at
    y=102, a bench's at y=114, a bed's frame at y=108 — none of them reach y=120).
    Measured both ways against the pack's targets:
    - from y=120: bed 0.706→0.45 (shrink 36%), sofa 0.740→0.5 (shrink 32%), armchair 0.583→0.5,
      table 0.914→0.72, kitchentable 0.968→0.78 — SIX of the targets shrink the furniture.
    - from each item's own drawn base: bench 0.310→0.52, stool 0.319→0.50, armchair 0.379→0.50,
      table 0.672→0.72, kitchentable 0.757→0.78, sofa 0.481→0.50 — every one grows or holds.
    The second reading is the one the pack's WHY describes, and it is also what the eye reads as
    the floor. **Heights are measured from each item's own drawn base.** Recorded because it
    changes every number in the table and someone will ask.
11. **The bed's seat target was already met; its LENGTH was the one that was short.** Pack:
    "bed length = 1.9×B, mattress top = 0.45×B". Measured at 150, the mattress top was already
    0.504×B — so ruling 9b (seat height wins) would have SHRUNK the bed to 134, and ruling 9c
    forbids shrinking the very item the WHY names first. Photographed at 150, the ACCEPT
    ("duvet covers the Boo, head on pillow") plainly fails: the bed is shorter than the Boo
    lying in it. Took the LENGTH target instead — 1.345×B → 1.90×B, i.e. `ACT_SIZE` 150 → 212.
    Mattress top lands at 0.71×B, which is a tall bed but is what the art's own proportions
    give once the length is right.
12. **Two of deviation 9c's four "shrinks" are not shrinks.** 9c lists wall clock, photo frame,
    pot plant and table lamp as targets that would REDUCE the item. Re-measured against B as
    DRAWN height on both sides (9a's own rule, applied to the item as well as to the Boo):
    table lamp is 0.682×B against a 0.85 target and pot plant 0.678×B against 0.9 — both GROW,
    which is what the WHY says they should do. `deco_tablelamp` 105→131, `deco_plant1` 110→146.
    Only wall clock (0.800×B vs 0.55) and photo frame (0.988×B vs 0.5) genuinely shrink; both
    are left exactly as they were, per 9c, and a side-by-side shows neither oversized.
13. **The bed's socket pointed at the pillow twice, and the ACCEPT was never met at any size.**
    `yFrac -0.262` is the pillow's BOTTOM (y=86), which left the sleeper's drawn bottom at
    y=80.7 — half a unit ABOVE the duvet's top edge (y=82), so the duvet crossed none of it and
    only the bed frame occluded anything. RUN19 Z3's own comment names the value it meant
    ("bottom at y=100") and then writes its arithmetic with the sign inverted. Re-measured to
    **-0.242** (y=88.5): drawn bottom at 84, inside the duvet band 82..102, with 18.3 viewBox
    units — 37px at 1024x768, 14px at 390 — of head clear above the pillow's top edge. x stays
    at the pillow's centre; -0.10 and -0.04 were photographed and both slide the head off the
    pillow. **Bounded by the two artworks, not by the numbers:** a Boo's face sits in the LOWER
    half of its own art (eyes at viewBox y 66..94 of a 21..118 body) while the bed occludes
    from y=66 down, so a sleeper cannot show its face AND be under the covers. Photographed
    -0.185, -0.200, -0.238, -0.278, -0.300 and -0.262 to establish that. What ships is the read
    the art supports: the top of the head and the ears above the pillow, body under the bedding.
    Flagged for RUN21C/E: this needs a bed drawn with a lower footboard, or a lying-down pose.
14. **Two socket bugs the re-measure surfaced, both pre-existing.** (a) `deco_table`,
    `deco_kitchentable` and `deco_counter` all carried `yFrac -0.138`, which is y=102 — the
    LITTLE table's floor line. The kitchen table's legs end at y=106 and the counter's carcass
    at y=108, so a Boo at either stood 4–6 viewBox units above its own floor. Each now names
    its own line (-0.108, -0.092). (b) The tables' socket x (±0.30/±0.32) put two Boos so close
    that they covered the entire tabletop — the "table-snack" ACCEPT photographed as two Boos
    and no table. Widened to ±0.40, which flanks the top and leaves its middle (and its drawn
    cup and dish) visible.
15. **The brief's premise about the two surface comments is not what the code does — and the
    code is still the truth.** The brief says surfaces.js measures from the ground line while
    town.js measures from the parent's rendered BOX BOTTOM. Measured: `renderPlaced` sets an
    item's box top to `rowGround - size + 8`, which lands the art's **y=120 GROUND LINE** at
    `rowGround + 8` — the box bottom is a further `size*10/120` below that. So town.js's
    `(pGround + 8) - surfaceY * pHeight` measures from the ground line after all, and it is
    town.js's own comment that was wrong. Changed no arithmetic; corrected BOTH comments to
    state the identity that makes the numbers checkable: `surfaceY = (120 - S)/130`.
16. **Item 5's residual has a CHILD term, and no value of `surfaceY` can absorb it.** town.js
    landed every small item with one flat `placedSize * (10/130)` nudge, which is exactly right
    only for art that stops at viewBox y = 110.8 — and nothing does. The lamp's foot stops at
    104 (so it floated 5.7% of its own size) and the plant's pot at 114 (so it sank 2.7%).
    Added `SMALL_ITEM_BASE_Y` to data/surfaces.js and replaced the nudge with
    `seat.y - placedSize * (baseY/120)`, so each item's own drawn base lands on the surface.
    Exact by construction at every scale; measured worst residual 0.12px.
17. **Every authored `surfaceY` named a line that is not in the art.** table 0.55 = y 48.5,
    above the tabletop entirely; counter 0.62 = y 39.4, 15 units above the worktop; toybox 0.45
    = y 61.5, half a lid DOWN so a lamp sank into it; bookshelf slot 0 at 0.35 = y 74.5, mid-air
    between the divider and the shelf, and slot 1 at 0.68 = y 31.6, above the top of the books.
    All re-read off the art. r19z6-objectmodel pinned two of these numbers, so both pins were
    **re-pointed, not deleted**: its contact check now reads the tabletop off the ART (viewBox
    y=56) and compares the lamp's own DRAWN base, the way r10p2-sockets reads a seat line, and
    its tolerance TIGHTENS from 4px to the pack's 2px; its shelf pin now asserts the
    `(120 - S)/130` identity against each shelf's own books instead of restating two constants.
    Both are strictly stronger than what they replace and neither can go stale again.
18. **FIX, found by r10p4-interiors: bigger furniture made the resize handle unreachable.**
    Not a stale pin — a real regression, reproduced by hand. Three causes, all consequences of
    taller boxes: the handle flipped UP unconditionally when the drawer covered its bottom-right
    corner, and on a 40%-taller item the flipped-up corner lands under the build-mode tool rows
    (`elementFromPoint` at the ring's own centre returned `.t-style-btn`); the placement test ran
    once, on the frame after selection, while build mode's drawer was still sliding in; and every
    `.t-item` is a full 120x130 box however little of it the art fills, so a re-baselined rug is
    a 256x277 rectangle of mostly nothing that sat over the bed's handle — neighbours share a
    z-index, so DOM order was deciding. Now: four candidate corners (bottom-right, up, and the
    two on the LEFT, which clear the right-edge tool rows), a real `elementFromPoint` hit test
    instead of a list of named panels, a second pass after the drawer settles, and the SELECTED
    item drawing above its neighbours while its menu is open. Measured: reachable, and the drag
    takes a bed 212px → 396px. **Left for RUN21C/E:** the drag maths sums raw dx+dy, so on the
    flipped corners "away from the item" is the wrong sign — a pre-existing quirk of Z6's up-flip
    that this inherits rather than introduces, and changing it would re-point r10p4's fixed drag
    vector for reasons unrelated to size.
19. **Ruling 9d's three additions, and what each is worth.** `deco_bench` is in the pack's list
    and gets its bench ratio (→154). `deco_bookshelf3` is not the pack's "low bookshelf" — it is
    the tall ladder shelf — but at the 92 fallback it rendered 0.99×B, SHORTER than the low shelf
    would now be, which is incoherent for a surface parent whose slots hold lamps. Added at 139
    (1.50×B) so the three read low 1.10 / standard 1.40 / ladder 1.50 as one family.
    `deco_pond` is in NEITHER the indoor list nor the outdoor sanity list, and photographed with
    a fishing Boo it does fit — so it is added explicitly at its current 92 with no visual
    change. It does read small (0.90×B wide, so the Boo covers it); flagged for RUN21C/E rather
    than resized on no mandate.
20. **The resize contract is wider than the pack states, and holds.** The pack's ACCEPT says
    "0.70–1.60 (beds 2.0)". The code is `scaleMaxFor`: 2.0 for the bed anywhere AND for **any**
    furniture indoors, 1.6 otherwise. Verified on rendered pixels, not on the constant, for all
    14 re-based items: every one clamps to exactly 0.70 and to its own max, and the rendered
    width tracks it (bed 172.1px / 245.9px / 491.8px at 0.7 / 1.0 / 2.0). Nothing changed.
21. **Outdoor sanity pass: no change.** Photographed one Boo on each of swings, slide, seesaw,
    trampoline, picnic and paddlepool at the new bases. Every Boo fits; none is touched. The
    "cosy bench" is `deco_bench`, the same object as the indoor bench, and it takes the bench
    ratio as the pack instructs.

## Session notes
- Wish art lives in `renderWish()` (js/art.js ~1670), shared 120×130 deco viewBox, caption
  `<text x="60" y="124" font-size="11">`. Classes `wish-svg wish-<word>` must survive —
  every wishlife behaviour binds to them.
- Helpers available in art.js: `path()`, `rrect()`, `ell()`, `starPath()`, `silhouette()`,
  `COLORS`, `INK`, `HALO`.
- No new runtime file: `WISH_ART` goes INTO js/art.js, so sw.js ASSETS is untouched.
- Items 3 and 5 (2026-08-03). B was measured, not assumed: `_probe_measure.mjs` reads every
  drawable's `getBBox` out of the live app in viewBox units, and `_probe_scene.mjs` converts
  to screen px. Boo drawn height at scale 1, row 1 = **74.36px** (97 of 130 viewBox units at
  size 92); box height 99.66px. The ruling's "~76px" is right to within 2%.
- The one identity everything in items 3 and 5 rests on: an item's art ground line (viewBox
  y=120) is drawn at `rowGround + 8`, and one viewBox unit is `ACT_SIZE * ROW_SCALE / 120` px.
  From it, `yFrac = (S - 120)/130` and `surfaceY = (120 - S)/130` for a line at viewBox y = S —
  both SCALE-INVARIANT, which is why re-sizing furniture did not move a single seat.
- Probes left in the tree (all gitignored `_probe*.mjs`, none ship): `_probe_measure.mjs`
  (art bboxes), `_probe_scene.mjs` (B + every socket + screenshots), `_probe_surf.mjs`
  (item 5's float table), `_probe_resize.mjs` (the clamp range on pixels), `_probe_bed.mjs` /
  `_probe_bedsweep.mjs` (nap candidates), `_probe_ring.mjs` (handle reachability),
  `_probe_eye.mjs` (where a Boo's eyes are in its own art), `_probe_sbs.mjs` (side-by-sides).
- Working-tree note: mid-task the coordinator checked out `main` in this tree and switched back.
  Every "before" measurement was RE-TAKEN afterwards on a confirmed-clean `run21b` and came back
  byte-identical, and the committed `ACT_SIZE` at 04cf6ba matches what those numbers imply, so
  nothing had to be redone.
- NOT done here (belongs to whoever closes RUN21B, per the pack's own Final gate section):
  BUILD_STAMP bump, What's New block, sw cache id, live-URL check, `RUN21B-REPORT.md`.
