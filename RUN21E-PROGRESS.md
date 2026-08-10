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
| E12 | Dead-prop amnesty (fridge, oven, bathtub, wardrobe, mirror) | **DONE** (22/22, 18s) |
| E13 | Acknowledgement wave two (3 ack lines) | TODO |
| E14 | Photo mode → postcards | TODO |
| E15 | Per-area growth tracks | TODO |
| H1 | Verify pumpWishIdles re-pointed to !softened (C report note 2) | DONE (verified) |
| H2 | L_PATH_FULL "Erase some to lay more" fix (sanctioned) | DONE |
| H3 | B1 APPROVED: bias maybePickBehaviour goals toward path runs + 90s observation | TODO |
| H4 | D's debt: playground Pulse invitation → `Someone fancies a game of tag…` (after E4) | TODO |
| F8 | Leitmotifs: APPROVED-TO-COMPOSE — compose 5 loops + audition tool; shipping GATED on SIGNED-OFF | TODO |
| F9 | Voice: VOICE still HELD → SKIPPED-GATED | GATED |

## Gate lines observed (NEEDS_ALEX.md, 2026-08-10 block)
- `LEITMOTIFS: APPROVED-TO-COMPOSE` (line 404) — compose allowed, ship gated on SIGNED-OFF.
- `B1: APPROVED — bias goal destinations toward path runs; restore the What's New entry only if the 90s observation passes` (405).
- `VOICE: still HELD` (409) — F9 stays gated.

## Evidence — handover items

**H1 (pumpWishIdles) — VERIFIED, no change needed.** `js/town.js:6117`:
`const wishIdleTimer = setInterval(() => { if (!document.hidden && !softened) pumpWishIdles(); }, 2000);`
with the RUN21C merge comment directly above (lines 6114–6116) and the cross-run note at 590–593.
The gate reads `softened` (kept current by `updateSoftened()` ← `worldSoftened()` = drawer open ‖
chip held ‖ pot held), exactly what the C report required. Cleanup clears the timer (6560).

**H2 (L_PATH_FULL) — DONE.** `data/guideLines.js:149`:
before `"That's a LOT of path! Erase some to lay more."` →
after `"That's a LOT of path! Paint over some to lay more."` — names the verb the control has
(painting over sweeps away, per PATH_POT_HINT). `tests/r10p3-buildmode.mjs:264` asserts
`/LOT of path/i`, which still matches; suite re-verified at the E-area packet gate.

## Decisions (governance §1 format)

**DEC-1 · E12 verbs run on the play path only (`!softened`), so a plain tap on these five props
no longer opens Move / Put away.** WHY: the pack asks for a response to her finger, and the wish
verbs already established exactly this shape (`if (!softened && wishTap(...)) return;`). Arranging
is still one gesture away — with the tray open, or on a long press — and a prop that answers is
worth more to a child than a prop that offers a menu she rarely wants. REVERSIBLE: delete one line
in `onTap` and the menu returns.

**DEC-2 · E12 props are NOT added to `ACT_IDS`/`SOCKETS`.** WHY: doing so would make the 4-second
role sweep claim them ambiently — a fridge that opens itself, a bath that fills with nobody asking.
The pack's verbs are all tap-initiated. REVERSIBLE: an id in a list.

**DEC-3 · The E13 ack lines are registered as four separate ACK_MOMENTS (walls and floors split).**
WHY: they are two different authored sentences; one moment with a swapped line key would make
`once` mean the wrong thing for the pair. REVERSIBLE: merge two entries.

## Deviations

**DEV-1 · E12 "removed from any dead-prop grandfather list/comment".** Pack said → such a list
exists. What was true → it does not: grepping `js/`, `data/`, `tests/` and every `*.md` finds only
CLAUDE.md's "No dead props" law (which binds NEW placeables) and a historical comment in
`data/wishlife.js:4`. What I did → treated the ACCEPT clause as satisfied by the verbs existing,
and did not invent a list to delete from.

**DEV-2 · E12 wardrobe "existing openDressUp, `from` preserved".** Pack said → `openDressUp` takes
a `from`. What was true → its signature is `openDressUp(booItem, {onDone, highlight, highlightLabel})`
(`js/accessories.js:248`); it is a body-appended overlay that never navigates, so there is no `from`
to preserve — that convention belongs to `ctx.go` routes. What I did → called it exactly as the
existing menu path does: `openDressUp(item, { onDone: () => renderPlaced() })`.

**DEV-3 · E12 fridge "a random FOOD wish art peeks".** Pack said → (implicitly) any food wish.
What was true → the FOOD class is exactly seven words (`cake apple pizza banana carrot cheese
cookie`, `data/wishlife.js:61-62`) and `WISH_ART` holds one drawing each. What I did → picked from
those seven and injected the drawing as a nested inline `<svg>` inside the fridge's own viewBox —
never emoji, per the art law.

**DEV-4 · E12 bath "paddle pose".** Pack said → a pose. What was true → the paddle "pose" is a
per-frame transform inside `stepRole`'s `case 'paddle'`, reachable only by claiming a socket — and
socketing the bath would make the role sweep fill it ambiently (see DEC-2). What I did → added a
tap-initiated `bath` goal whose step branch uses the paddle case's own numbers verbatim
(`sin(T/900)*12`, `sin(T/500)*4`, `rotate(sin(T/700)*8)`), so it is the same motion by reuse rather
than by copy-paste of a role.

**DEV-5 · E12 bath/oven overlay parenting.** The foam, the duck and the steam attach to the PROP's
wrap, never to the actor's `svg` — `stepGoal` rewrites that transform every frame and anything
parented there is wiped by the next one.

## Wall times
(none yet)

## Notes for resumption
- Required reading done: lane brief, CLAUDE.md, RUN21E pack + handover, RUN21C report notes 0–7,
  PICK-UP-HERE.md, BLOCKED.md. Key collisions: no buildMode (use `worldSoftened()`); pan only via
  `panToPx`/`panToFrac`; reveals via `enqueueReveal`; `pumpWishIdles` shared scene cap; sockets
  re-measured (trust code, not pack); every new js/data file → sw.js ASSETS[] same commit.
- Testing: 2 lanes max, seed x ≤ 0.25 on-camera, real mouse, dismiss `.overlay.growth-reveal`,
  fresh context for seeds, `BASE=http://127.0.0.1:8041 node tests/<name>.mjs`.
