# RUN21B — "Look & Feel" progress ledger

Branch: `run21b` from main @ fec9641 (build run21a-20260803, RUN21A + RUN21F F1–F3 merged).
SAVE VERSION stays 23 — nothing here touches the schema.
Pack: `RUN21-programme/RUN21B-pack.md`. Resume at the first unchecked item.

Prereqs confirmed present: `tools/asset-preview.html`, `tools/anchor-tuner.html` (RUN21F F1/F2).

- [x] Item 1 — Sixty standalone wish artworks (all 60 in `WISH_ART`; evidence:
      `_evidence/run21b/all60-meadow.png`, `all60-room.png`, `all60-silhouette.png`;
      r20-wishlife + r10p20-wishwell + r18b-wish-arrives all still green)
- [ ] Item 2 — Ambient life per class (FLIER / BOB / STEAM / GLEAM)
- [ ] Item 3 — Proportion re-baseline (furniture measured against Boo height B)
- [ ] Item 4 — Slot glow visible
- [ ] Item 5 — Seat offset polish
- [ ] Item 6 — Feedback scale-up (train 2.2×, ripples, sand, river)
- [ ] Item 7 — Disco floor spacing

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

## Session notes
- Wish art lives in `renderWish()` (js/art.js ~1670), shared 120×130 deco viewBox, caption
  `<text x="60" y="124" font-size="11">`. Classes `wish-svg wish-<word>` must survive —
  every wishlife behaviour binds to them.
- Helpers available in art.js: `path()`, `rrect()`, `ell()`, `starPath()`, `silhouette()`,
  `COLORS`, `INK`, `HALO`.
- No new runtime file: `WISH_ART` goes INTO js/art.js, so sw.js ASSETS is untouched.
