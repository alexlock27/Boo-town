# RUN21A — "Reach & Truth" progress ledger

Branch: `run21a` (from main @ 96a5aeb, build run20d-20260731). SAVE VERSION stays 23.
Pack: `RUN21-programme/RUN21A-pack.md`. Resume at the first unchecked item.
Item 17 is intentionally absent from the pack (returns as a micro-pack after Alex's tablet pass).

- [x] Item 1 — Un-delete seated Boos (the invisible-Boo bug)
- [x] Item 2 — Decorate renders at mount and on tab select; everything names its room (+ TDZ hotfix: roomIdOfArea hoisted)
- [x] Item 3 — Gold wish tiles never end mirrored
- [x] Item 4 — The Well's tray drops so the grant is visible; duplicate line
- [x] Item 5 — A child's tap is never budget-gated
- [x] Item 6 — A Boo holds still while its care arc is open
- [x] Item 7 — Footprints under the finger
- [x] Item 8 — One reveal at a time, everywhere
- [x] Item 9 — Back goes where you came from; the pan survives
- [x] Item 10 — The drawer ignores taps mid-transition
- [x] Item 11 — The ✈️ becomes an honest Town Postcard (💌)
- [x] Item 12 — Requests: no silence tax, town-side rolls, no bare "?"
- [x] Item 13 — canPlaceIn guard
- [x] Item 14 — The swing seat is the seat (measured: -35.2px float → 0.2px contact)
- [x] Item 15 — Build ghost-surgery
- [x] Item 16 — Fair catch-up: one celebration, not four queued days
- [x] Item 18 — Hint copy audit (zero hints promise unavailable actions; table in report)

All items implemented; FINAL GATE in progress (fresh-clone ACCEPT sweep + affected suites).

## BLOCKED
(none)

## DEVIATIONS (pack said → what was true → what I did)
1. Item 1: `unseatBoo(id)` → real signature is `unseatBoo(ride, booId)` → called with `seated.ride, id`.
2. Item 1: "chip-lift drop AND placeAtClient" as two paths → chip-lift delegates to placeAtClient
   (single funnel; wall/surface branches unreachable for Boos) → one insertion point after the
   floor-branch mutate covers every new Boo placement.
3. Item 4: "duplicate toast" lives in town.js grantWishIntoWorld (sayInWorld), not wishwell.js;
   the tray's collapse control is the drawer API (drawer.close()), not a chevron on .bd-tray →
   changed both at their real homes. FIX (iterated for ACCEPT): duplicate grants keep the well
   open 3.5s (not 1.5s) so the line can actually be read/heard; new-word timing untouched.
4. Item 8: "shop onboarding coach" → the shared first-play intro (maybeIntro('shop', SHOP_INTRO));
   deferred to the welcome-present modal's dismiss when the modal shows.
5. Item 9: pack's `params.from`/`params.area` + new `lastScroll` map → the stall door already
   passes `fromArea`, and a session pan-memory map already exists (roomScroll, RUN13 T3) →
   extended roomScroll to all areas (engine-reuse law) and used from/fromArea/fromRoom; the
   locked-swatch path needs the ROOM too or Back would land in the Lounge. "Hub entry" is
   actually the Collection's shop link — paramless, unchanged, still returns to hub.
6. Item 12 CHANGE B: town-side request rolls already exist (RUN19 Z2: checkRequestOpen at mount
   + renderRequestBubble in renderPlaced) → no second call added; verified at gate instead.
7. Item 14: sockets.js entry was already plank-correct ((88-120)/130 = -0.244, and the r10p2
   suite pins wrap-to-seat contact); the crossbar perch came from the swing ROLE's baked -30px
   svg baseline in town.js → fixed there (+5, measured), numbers recorded in the sockets.js
   comment as the pack asks. ACCEPT says "both seats occupied" but the swing has ONE seat
   (two ropes, one plank) — one rider verified.
8. Item 16: hub.js also ticks the funfair and cannot show reveals → the catch-up persists in
   `funfair.catchup` (additive key, safe [] default, v23 kept) until a town mount shows it —
   same never-lost semantics as the existing build reveal.
9. Item 18: no hint anywhere mentions the Place tool or the hammer; no dedicated Erase hint
   exists (L_PATH_FULL's "Erase some to lay more" refers to path, truthfully) → zero copy
   changes; full audit table in the report. Forward note for RUN21C: the shop's dressing
   purchase line "tap Build, then Decorate" still names Build — true today, dies with the
   hammer in C's gate grep.

## Session notes
- 2026-08-02: branch created; RUN21F items F1–F3 dispatched to a parallel worktree
  (branch `run21f`) per the dispatch's "may run in parallel with A in a second tree".
  F4 deferred until after A–E merge so the CHANGELOG/README truth pass has real
  reports and F3 numbers to draw from (logged in RUN21F-PROGRESS.md when created).
- NEEDS_ALEX gates for F8/F9 are ABSENT in NEEDS_ALEX.md → both will log SKIPPED-GATED.
