# RUN21B — "Look & Feel" · Report

Branch `run21b`, built on RUN21A + RUN21D + RUN21F F1–F3/F4/F7/F10. SAVE VERSION stays **23**
(no schema change; no new `js/` or `data/` file, so `sw.js` ASSETS[] is untouched and
`m3-pwa` is green). Ships as BUILD_STAMP **run21b-20260803** with a What's New block.

## Per-item status

| # | Title | Status | Where its ACCEPT is proven |
|---|---|---|---|
| 1 | Sixty standalone wish artworks | DONE | `all60-meadow.png`, `all60-room.png`, `all60-silhouette.png`; wish suites green |
| 2 | Ambient life per class | DONE | `_probe_wishidle` — butterfly flying within 5s and really moving (6/6 distinct transforms over 3.3s), boat/duck bobbing, episodic idles capped at 8/min under a hostile pump, reduced motion fully static, owl night-only |
| 3 | Proportion re-baseline | DONE | `ACCEPT-bench-sit.png`, `ACCEPT-bed-nap.png`, `ACCEPT-table-snack.png`, `ACCEPT-lamp-on-table.png`, `ACCEPT-sofa-lounge.png`, `ACCEPT-stool-sit.png` (each before\|after) + `seat-*-before/final.png` for all 17 socketed items |
| 4 | Slot glow visible | DONE | `item4-glow-indoor-table.png`, `item4-glow-indoor-bookshelf.png` |
| 5 | Seat offset polish | DONE | 21 frames `item5-<parent>-scale0p8\|1\|1p3-a.png`; worst float **0.12px** against a 2px ACCEPT (was up to 25.6px) |
| 6 | Feedback scale-up | DONE | `item6-train-1024x768.png`; train 163×44 cream-on-ink with its line, sand echoing, river untouched, rings peaking at exactly 64px |
| 7 | Disco floor spacing | DONE | `item7-disco-1280.png`, `item7-disco-390.png`; worst overlap 51.7% → 10.2% |

## What this pack actually found

Every one of the seven items required a deviation, and four of them were the pack being
**materially wrong** rather than merely drifted. The full log is in `RUN21B-PROGRESS.md`
(21 entries). The ones that mattered:

- **Item 2's premise was false and its method destructive.** There is no "wish idle runner in
  town.js" — wishes never become actors. Worse, `cls` IS the tap dispatcher, so re-classing
  butterfly/teapot/crown as the pack asks would have silently deleted their tap verbs,
  contradicting its own "existing tap verbs unchanged" in the same paragraph. Idle and tap are
  now two separate axes.
- **Item 3's method was arithmetically impossible.** The pack gives most items a width AND a
  seat height as multiples of Boo height B, but `ACT_SIZE` scales one shared viewBox
  uniformly, so that ratio is fixed by the art. Measured: the pack wants every paired item
  wider relative to its seat than it is drawn (bench 1.78 vs 3.27 demanded, bed 1.90 vs 4.22,
  sofa 2.40 vs 4.80). Resolved by ruling that the seat height wins, since that is what the
  ACCEPT tests. **B was measured, not assumed: 74.36px drawn height** (the SVG box is 99.66px,
  i.e. ~25px of transparent margin — using it would have made everything ~32% too big).
- **Item 4's diagnosis was wrong.** Not layering: the glow already sat in the `air` layer above
  every item. It was simply never wired to the gesture children actually use — lifting a chip
  out of the drawer, where the strip holds pointer capture so the viewport's own handler never
  fires. Its ACCEPT also names an outdoor picnic surface that **does not exist** — there are no
  outdoor surface parents in the game at all. Flagged for RUN21E's "Surfaces wave two".
- **Item 7 missed the real culprit.** The dominant overlap was the **spotlight**, which the pack
  never mentions: it parks the spotlit dancer at centre stage and nudged its neighbours to a
  fixed column, leaving one 71px from a 129px-wide Boo. Row 0 now re-spreads around it.

## Two real defects found while proving ACCEPTs

1. **A tap the instant a pose ended was swallowed.** `playOnce` and the launch's airborne
   cleanup queued an *unconditional* class removal at pose-length + 40ms, so tapping again at
   that moment let the already-queued timer strip the class the new tap had just added. It was
   unreachable until RUN21A-5 stopped budget-gating taps. Both timers now carry tokens: only
   the play that started a pose may end it. **Found by merging RUN21D into this branch.**
2. **Bigger furniture made the resize handle unreachable.** Caught by `r10p4-interiors`, not by
   a pin — three causes, all from taller boxes: the unconditional up-flip landing under the
   build tool rows, the placement test running while the drawer was still sliding, and a
   re-baselined rug's mostly-empty 256×277 box sitting over the handle. Now four candidate
   corners with a real `elementFromPoint` hit test, a second pass after the drawer settles, and
   the selected item drawing above its neighbours.

## Stale pins re-pointed — both STRENGTHENED, neither weakened

- **`r19z6-objectmodel`** restated `data/surfaces.js`'s own `0.55` back at itself, so it could
  only ever confirm the code agreed with itself. It now reads the tabletop off the ART (viewBox
  y=56) and compares the lamp's own drawn base — and its tolerance **tightens from 4px to 2px**.
  Its bookshelf pin now asserts the `(120−S)/130` identity against each shelf's own books.
- **`r20-wishlife`** — its duration read moved from a `getAnimations()` count to computed style,
  because a tap landing in the frame a pose is torn down restarts the animation without it
  being enumerable at the sample. The authored 3200ms is asserted directly; `landed` still
  proves the flight ran.

## Known limitation, honestly recorded

**The bed art bounds its own ACCEPT.** The pack asks for "duvet covers the Boo, head on
pillow". A Boo's face sits in the *lower* half of its art (eyes at viewBox y 66–94 of a
21–118 body) while the bed occludes from y=66 down, so a sleeper cannot show its face *and*
be under the covers. Six positions were photographed to establish this. It needs a bed drawn
with a lower footboard, or a lying-down pose — either is new art, which is not this item.
Recorded for RUN21E.

## Suites
39 suite-runs green across the pack's own work, plus a narrowed merge gate after reconciling
with main: `r10p2-sockets`, `r19z6-objectmodel`, `r10p4-interiors`, `r21a-reach-truth`,
`r12s1-routes`, `m3-pwa`. Two failures during the pack (`r21d-alive`, `r10p5-personalities`)
were each confirmed flakes by ONE serial re-run — `ERR_NO_BUFFER_SPACE` socket exhaustion and
a statistical rate respectively.

## For the packs that follow
- **The resize contract is 0.70–2.00 for ANY furniture indoors**, not just beds — the pack's
  "(beds 2.0)" understates the code.
- **`.t-item` wraps are full 120×130 boxes** whatever the art fills, so flat items (rugs)
  intercept pointer events across a large empty rectangle. Mitigated for the selected item only.
- **The resize drag sums raw dx+dy**, so on the flipped corners "away from the item" is the
  wrong sign — pre-existing from RUN19 Z6's up-flip, inherited not introduced.
- **`deco_pond` reads small** (0.90×B wide, so a fishing Boo covers it) but appears in neither
  of the pack's lists, so it was left alone.
- **There are no outdoor surface parents** — RUN21E E9 is the pack that owns adding them.
