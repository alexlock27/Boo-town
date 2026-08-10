# TESTFIX-AUG10 ledger — Lane 4, test debt (2026-08-10, overnight)

Branch `testfix-aug10` from main 22b8d40 · worktree `..\Boo-town-testfix-wt` · port 8044.
Brief: TONIGHT-2026-08-10/LANE-BRIEFS/LANE4-TEST-DEBT.md under GOVERNANCE-TONIGHT.md.

## RED — real child-facing faults found tonight

**None so far.** Specifically: the speech cluster is NOT four broken games — all four
suites pass serially on this box tonight (evidence below). The pre-reader's Blend It
sounding-out works.

## Item 1 — the speech cluster, each suite verified individually

Ran each alone (serial, no parallel lanes, server 8044, fresh worktree of main):

| Suite | Result | Wall time |
|---|---|---|
| r16w2-blendit (FIRST — toddler priority) | PASS | 25.3s |
| r16w4-storyorder ("wrong panel's caption" — 16/16 correct tonight) | PASS | 56.5s |
| r16w3-rhymetime | PASS | 26.7s |
| r17x2-encouragement | PASS | 7.0s |

Diagnosis: the 31 Jul failures were parallel-load flakes of the stub-then-assert-fast
shape the handover traced (round line still speaking on the real engine when the stub
asserts; queued lines leak into the capture late). The races are still LATENT in the
tests; hardening in progress (deterministic queue-drain waits before each stub install).
SAY-AGAIN interrupt (approved): in progress — mapping every 🔊 read-again button first.

## Item 2 — stale pins

- **r18d-detective-abc: PASS already, 6.4s.** The "VERSION is 19" pin was re-pointed at
  the live `m.VERSION` constant in an earlier session (suite compares `r.version ===
  r.currentVersion`, now 24 vs 24). No change needed; verified green.
- **p8-frames: FIXED (test-only), now PASS 33.9s (was 1 FAIL).**
  - "nine lessons" count: already `>=` on main ("at least the nine lessons authored
    after RUN16 (11)") — no change needed.
  - `fmt is not defined`: gone — fixed at cause in dash.js `tapGate()` per BLOCKED.md
    correction of 2026-07-30. No page errors tonight.
  - **The heart: NOT an ordering fault. Stale pin.** Diagnosis: RUN18B Y7 (commit
    be09d85, 28 Jul) removed the hearts ROW from every tier on purpose — "it counted
    down while the round carried on regardless". `shell.dimHeart()` survives as an
    internal counter only (gameshell.js:150) — no DOM ever renders `.heart-ic`, so the
    pre-tap count was legitimately 0; `.heart-ic.on` can never match. `m2-feedboos` and
    `r18b-hearts-chest` already assert the row is never drawn. Fix: the suite now pins
    the Y7 guarantee instead — bonk tracked (bonks===1, already asserted) AND zero heart
    nodes before/after. Strengthened, not weakened: asserts the current design.
- r11audit: pending.
- r17x3-feelings: pending.

## Item 3 — never-complete suites: pending.

## Item 4 — Toddler Stories door (approved one-liner): pending.

## Decisions

(none beyond brief-directed work yet)
