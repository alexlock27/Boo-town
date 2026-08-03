# RUN21A — "Reach & Truth" · Report

Branch `run21a` from main @ 96a5aeb (build run20d-20260731). SAVE VERSION stays **23** (one
additive key with a safe default: `funfair.catchup`, defaults `[]` — no migration needed).
Ships as BUILD_STAMP **run21a-20260802** with a What's New block (4 entries, all routes
resolve in the registry).

## Per-item status

| # | Title | Status | Evidence |
|---|---|---|---|
Every ACCEPT is verified by a suite, not by a throwaway probe. The pack's own criteria for
items 1, 2, 3, 6, 7, 8, 9, 11, 12 and 13 became a new permanent suite,
**`tests/r21a-reach-truth.mjs`** (~75s, stated per board law) — RUN21B–E all rewrite
`js/town.js` on top of these fixes, so each one is a live regression risk for the rest of
the programme. Items 4, 5, 15 and 16 are asserted by the suites that already owned those
contracts, re-pointed by this run.

| # | Title | Status | Where its ACCEPT is proven |
|---|---|---|---|
| 1 | Un-delete seated Boos | DONE | `r21a-reach-truth` §1 (a/b/c) + `item1-bedroom-visible.png` |
| 2 | Decorate at mount + tab select; rooms named | DONE (+TDZ hotfix) | `r21a-reach-truth` §2, all three rooms + `item2-decorate-lounge.png` |
| 3 | Gold wish tiles end readable | DONE | `r21a-reach-truth` §3 (settled-matrix sign + reduced-motion) + `item3-gold-readable.png`, which shows gold `K I T E` the right way round AND item 4's dropped tray in the same frame |
| 4 | Tray drops; duplicate line in the well | DONE (FIX: duplicate keeps well 3.5s) | `r18b-wish-arrives` §3, re-pointed |
| 5 | Taps never budget-gated | DONE | `r20-wishlife`, re-pointed |
| 6 | Boo holds still under care arc | DONE | `r21a-reach-truth` §6, 4 frames across 3.3s + `item6-care-hold.png` |
| 7 | Footprints under the finger | DONE | `r21a-reach-truth` §7, three tap heights |
| 8 | One reveal at a time | DONE | `r21a-reach-truth` §8 + `item8-one-reveal.png` |
| 9 | Back + pan memory | DONE | `r21a-reach-truth` §9 (town round trip + paramless hub case) |
| 10 | Drawer transition shield | DONE | code + `r18d-layout`/`r18b-buy-confirm` (drawer consumers) pass; see note below |
| 11 | Town Postcard 💌 | DONE | `r21a-reach-truth` §11 — payload key whitelist, eight forbidden keys, restore-box line |
| 12 | Requests: no silence tax, glyphs | DONE (CHANGE B pre-existing) | `r21a-reach-truth` §12 — all 6 template ids + an unmapped id, zero '?' |
| 13 | canPlaceIn guard | DONE | `r21a-reach-truth` §13 |
| 14 | Swing seat is the seat | DONE | `swing-before/after-1024x768.png` — measured -35.2px float → 0.2px contact |
| 15 | Build ghost-surgery | DONE | `r10p3-buildmode`, re-pointed + grep clean (no 'place' tool refs) |
| 16 | Fair catch-up | DONE (+FIX, below) | `r7p1-funfair`, re-pointed (multi-cross AND single-cross) |
| 17 | — intentionally absent from the pack (tablet truths return as a micro-pack) | — | — |
| 18 | Hint copy audit | DONE — zero changes needed | table below |

Item 10's shield is the one ACCEPT not scripted: proving "a tap mid-transition falls through
to the world" needs a real 220ms race that Playwright can only simulate by dispatching
synthetic pointer events, which bypass the very hit-testing the shield exists to change — a
green test there would prove nothing. The shield is verified by construction (a transparent
node over the tray's travel band + `pointer-events:none` on tabs/strips, dropped on
`transitionend` with a 400ms fallback, and skipped entirely under reduced motion where the
transition does not fire), and by every drawer-consuming suite still passing.

## Deviations (pack said → what was true → what I did)
See RUN21A-PROGRESS.md "DEVIATIONS" for the full nine-entry log. Summary: two wrong code
shapes (unseatBoo arity; single placement funnel), two wrong component names (duplicate
"toast" lives in town.js sayInWorld; the shop "coach" is the shared intro system), two
already-implemented claims (town-side request rolls, RUN19 Z2; sockets.js swing values —
the perch was the role animation's baked -30px baseline), one engine-reuse substitution
(roomScroll extended instead of a parallel lastScroll map, per CLAUDE.md), one persistence
addition the pack's mechanism needed to survive hub ticks (`funfair.catchup`), and one
impossible ACCEPT literal ("both seats occupied" — the swing has one seat).

Two FIXes under the dispatch's Fix rule ("acceptance criteria are the target, not the code
shapes; iterate until it passes its own ACCEPT on screen"):

1. **Item 4** — duplicate wish grants keep the well open 3.5s instead of 1.5s so the
   (now in-well) line can actually be read and heard. New-word grant timing untouched at 1.5s.
2. **Item 10** — the transition shield swallowed the child's *placement* tap. `selectHold`
   closes the drawer deliberately, to get out of the way so she can tap the ground; the
   shield then covered up to 48vh of the world for the next 220–400ms, so her first tap
   after picking something up did nothing. Caught at the gate by `r10p2-sockets` (the
   area-full line never appeared because the ground click never landed — and the "25th item
   refused" assertion was passing for the wrong reason). Fixed by giving `closeDrawer` a
   `{ shield: false }` option for closes that hand the world back; every user-driven
   open/close still shields, which is what the pack's ACCEPT actually asks for.
3. **Item 16** — the combined catch-up celebration was firing on *any* town mount, because
   `tickFunfair` runs on every one. Caught at the gate by `r18b-wish-arrives`: the overlay
   opened over the **Meadow** and covered the wish-arrival line. The pack's ACCEPT says
   "first **fair** mount", and a headline reading "Look how the fair has grown!" gives her
   nowhere to look from the Meadow (CLAUDE.md, announced moments). The rides still complete
   on whichever tick finds them — that is the actual fix, and it is unchanged — but the
   celebration is now gated to `AREA.key === 'funfair'` and waits in `funfair.catchup`
   until she walks in.

## BLOCKED
None.

## Item 18 — the full hints table (every `hint.textContent` in js/town.js)

All hints were audited against post-RUN21A behaviour. **Zero copy changes were required**:
no hint anywhere mentions the Place tool or the hammer; there is no dedicated Erase hint
(the pack's conditional "if the Erase hint implies items" has no matching hint to change).

| Line (approx) | Hint | Verdict |
|---|---|---|
| updateHint, holding | `Tap the ground — I'll find the nearest free spot!` | unchanged — true |
| updateHint, buildMode | `Drag to move. Tap an item for size controls.` | unchanged — both actions remain available in build mode (item drags start on the item; band drags paint) |
| updateHint, placeMode | `Tap the ground to place it!` | unchanged — true |
| updateHint, default | `Drag from the tray. Tap a Boo to say hi!` | unchanged — item 6 makes the second half stay true (the Boo now holds still) |
| pathCapWobble | guideLine `L_PATH_FULL`: "That's a LOT of path! Erase some to lay more." | unchanged — refers to path tiles, truthfully (Erase erases only path cells) |
| riverside signature | `Plop, plop, plop!` | unchanged |
| skyChipNudge | `<name> needs the big open sky — take it outside and I'll put it right up!` | unchanged |
| lightCone | `It will glow when it gets dark!` | unchanged |
| climb | `Up we go!` / `Nothing to lean on — up two rungs and back down!` | unchanged |
| wishFood no-boo | guideLine `wishFoodNoBoo` | unchanged copy; item 5 removed its session budget (always answers) |
| decorate swatch applied | `<name>!` | unchanged |
| spotWobble | `That spot's taken — try a little further along!` | unchanged |
| area full | guideLine `L_AREA_FULL`: "This spot's bursting! Try another area?" | unchanged |
| sky-needed | `needs the sky!` (INDOOR_TIP) | unchanged |
| not indoors | guideLine `L_NOT_INDOORS`: "That belongs outside!" | unchanged |
| not outdoors | guideLine `L_NOT_OUTDOORS`: "Cosy things like a roof!" | unchanged |
| surface drop | `On the <parent>!` (two sites) | unchanged |
| nearest-spot | `Tucked into the nearest free spot!` (two sites) | unchanged |
| RUN21A-1 (new) | `<Name> hopped off the <Ride> to come here!` | new, authored by the pack |
| sprinkle trio | `…is already sparkling today! ✨` / cost lines / `…is sparkling! ✨` | unchanged |
| resize | `<name> size: NN%` (two sites) | unchanged |
| flashLocked | `<Zone>: N / M ⭐` | unchanged (dead code under the single-zone shim) |
| shooting star | `✨ You caught a shooting star! +1 ✨` / `✨ Pretty!` | unchanged |

Forward note for RUN21C's gate grep: the shop's dressing-purchase line "…tap Build, then
Decorate." still names Build. It is TRUE today (build mode also reaches Decorate) and dies
with the hammer in C.

## Final gate results

Run from a FRESH CLONE of `run21a` (`../Boo-town-run21a-gate`, its own server on :8001),
not the working tree — per the pack.

**`npm test` does not run.** `package.json` points `test` at `node tests/run.mjs`, and that
file does not exist. Noted, NOT repaired — the pack says the harness is RUN21F's job (F4),
and RUN21F's own F3 generator independently reported the same thing. Suites are therefore
invoked directly (`BASE=… node tests/<name>.mjs`), which is how `_runall.sh` drives them too.

### Affected suites — 25/25 PASS

Chosen per the Board Law: the suites covering the files this run changed (town.js, shop.js,
drawer.js, wishwell.js, worldmap.js, state.js, requests.js, funfair.js, sockets.js,
wishlife.js, styles.css) and their dependents, plus the fixed core (`r12s1-routes`,
`r8p1-migrations`, `m3-pwa`, `r12s4-contrast`, `r18a-copyguard`). No full board — that runs
once at the end of the programme.

`r21a-reach-truth` · `r12s1-routes` · `r8p1-migrations` · `m3-pwa` · `r12s4-contrast` ·
`r18a-copyguard` · `r10p2-sockets` · `r4p5-town` · `r10p5-personalities` · `r10p20-wishwell` ·
`r18b-wish-arrives` · `r20-wishlife` · `r19z2-requests` · `r18a-shop-chrome` ·
`r18b-buy-confirm` · `r18b-shop-handoff` · `r19z6-objectmodel` · `r10p3-buildmode` ·
`r6p2-funfair` · `r7p1-funfair` · `r4p6-growth` · `r13bt8-town-dressing` · `m3-grownups` ·
`r17x4-whatsnew` · `r18d-layout`

The first pass (2 lanes) had four reds. All four are now green, and each was resolved by
finding out WHY rather than by re-running until it went away:

| Suite | Verdict |
|---|---|
| `r10p2-sockets` | **REAL BUG in item 10** — see FIX 2 above. Green after the fix. Note its "25th item refused" assertion had been passing for the wrong reason (nothing was placed because the click never landed), which is exactly how a shield bug hides. |
| `r21a-reach-truth` | Three defects in the NEW suite, not the app: a document-wide empty-state check (other tabs legitimately show "Nothing here yet!"); an expiry assertion that assumed no new request could be generated in the same visit (it can — that IS item 12 working); and a care-arc block that seeded its Boo at x 0.3, which in a four-viewport-wide area is off-camera, so `stepActors` skipped it and the click missed. That last one was silently proving nothing — the Boo "held still" because it had never been walking. |
| `r4p5-town` | Flake. `seesaw: alternating bounce` wants ≥5 distinct frames; it sampled 4 under 2-lane load, 7 serially. Board-law frame-evidence class. |
| `r10p5-personalities` | Flake. `.hub` boot timeout under load; passes serially and passed in an earlier 3-lane run. |

Both flakes were confirmed by ONE serial re-run each, per the board law, not assumed.
Re-verification after the item-10 fix ran **serially** and re-included every drawer consumer
(`r18d-layout`, `r10p20-wishwell`, `r18b-buy-confirm`, `r10p3-buildmode`) because the fix
touched `js/drawer.js`: all green.

### ACCEPT sweep — PASS
`tests/r21a-reach-truth.mjs`, ~90s, green. Covers items 1 (all three ACCEPT clauses), 2
(all three rooms), 3 (settled-transform sign + reduced motion), 6 (4 frames / 2.6s under a
live arc), 7 (three tap heights), 8, 9 (town round trip AND the paramless hub case), 11
(payload key whitelist + eight forbidden keys + the restore line), 12 (all six template ids
plus an unmapped one), 13. Items 4, 5, 15, 16 are proven by their re-pointed owners; item
14 by measured screenshots; item 10 by construction (see note above).

### Regression sweep (scripted, error hooks armed) — PASS, zero console errors

`_probe_regress.mjs` (a probe by design — RUN21F F10 owns the permanent `tests/walk.mjs`),
with `window.onerror` + `unhandledrejection` + `console.error` all captured:

- place / move / put-away in the **Meadow** and the **Kitchen** — each adds exactly one
  placement, survives a real move-drag as one placement, and returns to the drawer;
- one **new-word wish arrival** — one placement, one unlock;
- one **nap + wake** — a Boo takes to the bed (eyes genuinely shut) and wakes;
- **ride seat / unseat** — aboard, then off;
- **ten minutes of walking**, 15 full laps of all six outdoor areas and all three Boo House
  rooms, panning within each;
- and the pack's "rich QA save": the real **v17 QA backup reads, migrates to v23**, and
  every area and room renders.

**`errors captured: 0`.**

First run reported 4 errors, all `setPointerCapture: No active pointer` — manufactured by
the harness itself (synthetic `PointerEvent`s have no active pointer), 2 drags × 2 handlers.
Rather than explain them away, the drags were rewritten to drive the real mouse and the full
sweep re-run from scratch: the app behaviour is identical and the errors are gone. Worth
remembering — a synthetic pointer drag will always frame the app for an error it did not
commit.

### Deploy
`run21a` → `main`, fast-forward, pushed. BUILD_STAMP `run21a-20260803`, What's New block
appended with four child-facing entries (all four routes resolve — `r17x4-whatsnew` green).
Live URL confirmed serving the new stamp.
