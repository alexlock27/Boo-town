# RUN21B — "Look & Feel" progress ledger

Branch: `run21b` from main @ fec9641 (build run21a-20260803, RUN21A + RUN21F F1–F3 merged).
SAVE VERSION stays 23 — nothing here touches the schema.
Pack: `RUN21-programme/RUN21B-pack.md`. Resume at the first unchecked item.

Prereqs confirmed present: `tools/asset-preview.html`, `tools/anchor-tuner.html` (RUN21F F1/F2).

- [ ] Item 1 — Sixty standalone wish artworks
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

## Session notes
- Wish art lives in `renderWish()` (js/art.js ~1670), shared 120×130 deco viewBox, caption
  `<text x="60" y="124" font-size="11">`. Classes `wish-svg wish-<word>` must survive —
  every wishlife behaviour binds to them.
- Helpers available in art.js: `path()`, `rrect()`, `ell()`, `starPath()`, `silhouette()`,
  `COLORS`, `INK`, `HALO`.
- No new runtime file: `WISH_ART` goes INTO js/art.js, so sw.js ASSETS is untouched.
