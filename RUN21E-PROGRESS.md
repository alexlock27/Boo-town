# RUN21E-PROGRESS.md — ledger ("Every Area a Job")

Branch `run21e` from main@22b8d40 (run21f-20260804). Worktree `..\Boo-town-run21e-wt`, port **8041**.
Governance: TONIGHT-2026-08-10/GOVERNANCE-TONIGHT.md in force (decide-and-record, no parking).
Save is **v24** — E adds ONLY additive keys with safe defaults, NO version bump.

## Status board

| Item | Title | Status |
|---|---|---|
| E1 | Riverside — jetty, float sailing, feedable ducks | TODO |
| E2 | Hilltop — train line, kite rack, rain windmill | TODO |
| E3 | Beach — tide, shells, sandcastle persists | TODO |
| E4 | Playground — tag, ring-a-roses, notice poster | TODO |
| E5 | Meadow — signpost (shared Today card) | TODO |
| E6 | Funfair — fair day (Saturday) | TODO |
| E7 | Boo House — pretend-night lamp | TODO |
| E8 | Gallery — three pins + Featured Wall | TODO |
| E9 | Surfaces wave two (mantelpiece, windowsills, 3 smalls; consider outdoor parent) | TODO |
| E10 | Outdoor hang points (lantern, bunting swags) | TODO |
| E11 | Adjacency delights (moth, frog/dragonfly, marshmallows) | TODO |
| E12 | Dead-prop amnesty (fridge, oven, bathtub, wardrobe, mirror) | TODO |
| E13 | Acknowledgement wave two (3 ack lines) | TODO |
| E14 | Photo mode → postcards | TODO |
| E15 | Per-area growth tracks | TODO |
| H1 | Verify pumpWishIdles re-pointed to !softened (C report note 2) | TODO |
| H2 | L_PATH_FULL "Erase some to lay more" fix (sanctioned) | TODO |
| H3 | B1 APPROVED: bias maybePickBehaviour goals toward path runs + 90s observation | TODO |
| H4 | D's debt: playground Pulse invitation → `Someone fancies a game of tag…` (after E4) | TODO |
| F8 | Leitmotifs: APPROVED-TO-COMPOSE — compose 5 loops + audition tool; shipping GATED on SIGNED-OFF | TODO |
| F9 | Voice: VOICE still HELD → SKIPPED-GATED | GATED |

## Gate lines observed (NEEDS_ALEX.md, 2026-08-10 block)
- `LEITMOTIFS: APPROVED-TO-COMPOSE` (line 404) — compose allowed, ship gated on SIGNED-OFF.
- `B1: APPROVED — bias goal destinations toward path runs; restore the What's New entry only if the 90s observation passes` (405).
- `VOICE: still HELD` (409) — F9 stays gated.

## Decisions (governance §1 format)
(none yet)

## Deviations
(none yet)

## Wall times
(none yet)

## Notes for resumption
- Required reading done: lane brief, CLAUDE.md, RUN21E pack + handover, RUN21C report notes 0–7,
  PICK-UP-HERE.md, BLOCKED.md. Key collisions: no buildMode (use `worldSoftened()`); pan only via
  `panToPx`/`panToFrac`; reveals via `enqueueReveal`; `pumpWishIdles` shared scene cap; sockets
  re-measured (trust code, not pack); every new js/data file → sw.js ASSETS[] same commit.
- Testing: 2 lanes max, seed x ≤ 0.25 on-camera, real mouse, dismiss `.overlay.growth-reveal`,
  fresh context for seeds, `BASE=http://127.0.0.1:8041 node tests/<name>.mjs`.
