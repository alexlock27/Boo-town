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
- [ ] Item 3 — Proportion re-baseline (furniture measured against Boo height B)
- [x] Item 4 — Slot glow visible (root cause was NOT layering — see deviation 5;
      evidence `_evidence/run21b/item4-glow-indoor-table.png`, `item4-glow-indoor-bookshelf.png`)
- [ ] Item 5 — Seat offset polish
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

## Session notes
- Wish art lives in `renderWish()` (js/art.js ~1670), shared 120×130 deco viewBox, caption
  `<text x="60" y="124" font-size="11">`. Classes `wish-svg wish-<word>` must survive —
  every wishlife behaviour binds to them.
- Helpers available in art.js: `path()`, `rrect()`, `ell()`, `starPath()`, `silhouette()`,
  `COLORS`, `INK`, `HALO`.
- No new runtime file: `WISH_ART` goes INTO js/art.js, so sw.js ASSETS is untouched.
