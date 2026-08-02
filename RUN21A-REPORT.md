# RUN21A — "Reach & Truth" · Report

Branch `run21a` from main @ 96a5aeb (build run20d-20260731). SAVE VERSION stays **23** (one
additive key with a safe default: `funfair.catchup`, defaults `[]` — no migration needed).
Ships as BUILD_STAMP **run21a-20260802** with a What's New block (4 entries, all routes
resolve in the registry).

## Per-item status

| # | Title | Status | Evidence |
|---|---|---|---|
| 1 | Un-delete seated Boos | DONE | ACCEPT sweep A1; bedroom before/after in `_evidence/run21a/` |
| 2 | Decorate at mount + tab select; rooms named | DONE (+TDZ hotfix) | ACCEPT sweep A2 |
| 3 | Gold wish tiles end readable | DONE | ACCEPT sweep A3 + post-wish screenshot |
| 4 | Tray drops; duplicate line in the well | DONE (FIX: duplicate keeps well 3.5s) | ACCEPT sweep A4 + screenshot |
| 5 | Taps never budget-gated | DONE | ACCEPT sweep A5 |
| 6 | Boo holds still under care arc | DONE | ACCEPT sweep A6, 3 frames across 4s |
| 7 | Footprints under the finger | DONE | ACCEPT sweep A7 |
| 8 | One reveal at a time | DONE | ACCEPT sweep A8 |
| 9 | Back + pan memory | DONE | ACCEPT sweep A9 |
| 10 | Drawer transition shield | DONE | ACCEPT sweep A10 |
| 11 | Town Postcard 💌 | DONE | ACCEPT sweep A11 (payload key assertions) |
| 12 | Requests: no silence tax, glyphs | DONE (CHANGE B pre-existing) | ACCEPT sweep A12 |
| 13 | canPlaceIn guard | DONE | ACCEPT sweep A13 |
| 14 | Swing seat is the seat | DONE | `swing-before/after-1024x768.png` — measured -35.2px float → 0.2px contact |
| 15 | Build ghost-surgery | DONE | ACCEPT sweep A15; grep clean (no 'place' tool refs) |
| 16 | Fair catch-up | DONE | ACCEPT sweep A16 (also observed live during item-14 probing: a 300★ save produced exactly one combined reveal) |
| 17 | — intentionally absent from the pack (tablet truths return as a micro-pack) | — | — |
| 18 | Hint copy audit | DONE — zero changes needed | table below |

## Deviations (pack said → what was true → what I did)
See RUN21A-PROGRESS.md "DEVIATIONS" for the full nine-entry log. Summary: two wrong code
shapes (unseatBoo arity; single placement funnel), two wrong component names (duplicate
"toast" lives in town.js sayInWorld; the shop "coach" is the shared intro system), two
already-implemented claims (town-side request rolls, RUN19 Z2; sockets.js swing values —
the perch was the role animation's baked -30px baseline), one engine-reuse substitution
(roomScroll extended instead of a parallel lastScroll map, per CLAUDE.md), one persistence
addition the pack's mechanism needed to survive hub ticks (`funfair.catchup`), and one
impossible ACCEPT literal ("both seats occupied" — the swing has one seat).

One FIX under the dispatch's Fix rule: duplicate wish grants keep the well open 3.5s
instead of 1.5s so the (now in-well) line can actually be read and heard; new-word grant
timing is untouched at 1.5s.

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
(filled at gate completion)

### Affected suites
PENDING

### ACCEPT sweep
PENDING

### Regression sweep (scripted, error hooks armed)
PENDING

### Deploy
PENDING
