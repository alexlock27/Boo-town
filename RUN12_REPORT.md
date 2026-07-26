# RUN12 — FIX & FEEL: report

A repair run. No new games, no new systems. Eighteen reported defects were triaged against
the live tree before anything was fixed, then fixed one packet at a time, each with a
regression test that would have caught it — because every one of these bugs shipped for the
same reason: no suite drove that path.

Baseline: `main @ run11-privacy-20260725`, board 107/107, save VERSION 14.
Final live stamp: **`run12-s13-20260726`**, save VERSION 14 (unchanged — this run needed no
migration). Every S1–S13 product fix is in that stamp and is live.

**S14 did not close a deploy gate, deliberately.** By the time the board finished, a second
session was mid-flight on RUN13 with uncommitted Boo Care work in the tree. Bumping
BUILD_STAMP would have deployed another packet's unfinished rework — RUN12.md explicitly
puts Boo Care out of scope and hands it to RUN13 — so the stamp was left where S13 put it
and the RUN13 session closes its own gate. This document and PROGRESS.md were committed on
their own, with every other file in the tree left untouched.

---

## 1. Triage table, with final dispositions

Evidence for every row: `tests/run12_triage.md` and `screenshots/run12/triage/`.

| # | Finding | Triage verdict | Outcome |
|---|---|---|---|
| F12-01 | Wish Well card crashes the app | CONFIRMED — `pageerror: openWishWellOverlay is not defined` | **FIXED** (S1). One `openWellHere()` serves all three entry points. |
| F12-02 | Unattempted questions logged as wrong | CONFIRMED, Boo Beat only | **FIXED** (S2). The collector has no generic `add()` any more. |
| F12-03 | Odd Boo Out rounds with no unique odd one | CONFIRMED — non-odd items differed in 400/400 grids at every tier | **FIXED** (S3). Uniform grid, one difference. |
| F12-04 | Explanation names a feature she did not see | CONFIRMED — `species → 'shape'` | **FIXED** (S3). Labels name the rendered part, checked against the SVG. |
| F12-05 | Boo Beat lane 3 unreadable | CONFIRMED — 1.37:1, and the cause was an off-by-one `nth-child` | **FIXED** (S4). Keyed on `data-lane`. |
| F12-06 | "Nothing here yet!" invisible | CONFIRMED — 1.04:1, white on cream | **FIXED** (S4). |
| F12-07 | Non-Boo drops announce a Boo | CONFIRMED (copy). Blank-badge sub-claim **NOT-REPRODUCED** | **FIXED** (S5). Kind-aware copy; a rarity-less item omits the badge. |
| F12-08 | Tutorials do not pause the round | CONFIRMED — Boo Beat lost 2 hearts, Flash Boos revealed AND hid its scene | **FIXED** (S6). |
| F12-09 | Disco Hall Boos float | CONFIRMED — 76px of air at 1280×720 | **FIXED** (S7). 0px off the declared surface. |
| F12-10 | Echo Boos' lit feedback too faint | CONFIRMED, and worse than reported: it rendered **nothing** | **FIXED** (S4 root cause + S8 tuning). |
| F12-11 | Toddler Animal Sounds plays once | CONFIRMED — one call, 240ms in, no replay path | **FIXED** (S9). |
| F12-12 | Clock Shop hands / overlapping drag | Reset **CONFIRMED**; proportional hour travel **BY-DESIGN** | **FIXED** (S10). Reset + sticky grab + the explanation. |
| F12-13 | Leaving mid-round forfeits everything | CONFIRMED — 0 banked | **FIXED** (S11). |
| F12-14 | Treats balance invisible outside Boo Care | CONFIRMED — no chip on the hub | **FIXED** (S11). |
| F12-15 | Bubble Pop bubbles untappable | CONFIRMED — HUD overlap in 10/12 samples, worst 164px | **FIXED** (S12), plus a second cause the report missed. |
| F12-16 | Journal trophy dated in the past | **NOT-REPRODUCED** | Recorded below. |
| F12-17 | Star Chest control opens nothing | CONFIRMED as a dead control | **See remaining gaps.** |
| F12-18 | Hearts empty, round continues | **BY-DESIGN** | Recorded below. |

**New defect found while triaging, not in the report:** `js/ui.js`'s `el()` silently dropped
every CSS custom property, because `Object.assign` on a `CSSStyleDeclaration` ignores `--*`
keys. Fourteen call sites were passing `--accent`, `--boo`, `--cols`, `--petal` and `--i`
and getting nothing. This was the root cause of F12-10 and had been quietly degrading the
game shell's accent colour, every level button, every hub game card, Word Detective's grid
and the trophy blooms. Fixed in S4.

---

## 2. Packet outcomes

| Packet | Verdict | Suites | Live stamp |
|---|---|---|---|
| S0 triage | DONE | none (tests-only, board untouched) | — |
| S1 Wish Well + route smoke | DONE | +`r12s1-routes` (208 assertions); `r10p16`, `r10p17` red→green | `run12-s1-20260725` |
| S2 Tricky Pile fairness | DONE | +`r12s2-tricky-fair` | `run12-s2-20260725` |
| S3 Odd Boo Out | DONE | +`r12s3-oddboo`; `r10p19-brain` updated (3 superseded assertions) | `run12-s3-20260725` |
| S4 contrast law (G7) | DONE | +`r12s4-contrast` | `run12-s7s8-20260726` |
| S5 ceremony copy | DONE | +`r12s5-ceremony` | ″ |
| S6 tutorials pause | DONE | +`r12s6-intro-pause` | ″ |
| S7 sockets | DONE | +`r12s7-sockets` | `run12-s7s8-20260726` |
| S8 Echo Boos | DONE | +`r12s8-echo`; `r10p10-p11` updated (setup markup) | ″ |
| S9 toddler replay | DONE | +`r12s9-toddler-replay` | `run12-s9s10-20260726` |
| S10 Clock Shop | DONE | +`r12s10-clock` | ″ |
| S11 banking + treats | DONE | +`r12s11-banking` | `run12-s11s12-20260726` |
| S12 Bubble Pop containment | DONE | +`r12s12-bubble-containment` | ″ |
| S13 accessibility pack | DONE | +`r12s13-a11y` | `run12-s13-20260726` |
| S14 board + report | DONE (no deploy gate — see above) | — | none; stays `run12-s13-20260726` |

**Board: 107 → 120 suites.** Thirteen new permanent suites, no suite deleted.

### Final board — PROVISIONAL, and here is why

**This count is not a valid measurement and must not be quoted as one.** The sweep ran
while a second session was actively working in the same tree on RUN13: two commits landed
on top of RUN12 partway through it (`2e3d593` RUN13 T0, `767d3f5` RUN13 T1 (part)), and
`css/styles.css`, `js/care.js`, `js/town.js`, `js/collection.js`, `js/intro.js` and two test
files were being modified while suites were reading them. A serial board run measures the
tree it runs against, and that tree was moving.

**The next clean full-board run supersedes everything in this section.**

| | |
|---|---|
| Provisional result | serial batch reported `TOTAL PASS=116 FAIL=4`; all four passed on a direct re-run |
| Re-run directly per CLAUDE.md's flake rule | `m2-full`, `p2-rewards`, `r12s11-banking`, `r5p5-phone` — all PASS |
| Not run at all | `r13t1-care-direct` — it did not exist when the sweep captured its suite list |
| RUN12's own 13 suites | none failed, in the batch or on re-run |
| Standing block, unchanged from RUN11 | `m3-pwa`'s offline-reload section (see `BLOCKED.md`) |

What can be said honestly on this evidence: no suite RUN12 added or touched was red, and
every red in the batch was either fixed or shown to be the documented `.hub` load flake.
What cannot be said: a board total for RUN12, because the tree was not still.

Two of the four reds were genuinely mine and were **fixed**, not re-run away:
`p2-rewards` pinned the ceremony's copy per dice roll, which RUN12 S5 supersedes (it now
reads the expected copy from the same authored table the product does), and
`r12s11-banking` snapshotted the star totals before the round was *played* rather than
before the *exit*, so anything the round itself banked was attributed to the exit. The other
two — `m2-full` and `r5p5-phone` — were the `.hub` timeout CLAUDE.md documents under serial
load, and passed on a direct re-run without any change.

The board grew from 107 to 120 and **no suite was deleted or weakened to green it**. Five
suites had assertions updated, each because RUN12 is the spec of record for what they were
freezing, and each justified in this report: `r10p19-brain` (three assertions that required
the very ambiguity S3 removed), `r10p10-p11` (Echo's setup markup), `p2-rewards` (ceremony
copy), and `r10p16-expedition-puzzles` + `r10p17-caper` (hardcoded port, no assertion
touched).

### The suites that matter most
Three of the thirteen guard a *class* of bug rather than an instance, which is the point of
the run:

- **`r12s1-routes`** reads `main.js`'s registry from source, scrapes every
  `go('route', { … })` shape out of every file in `js/`, and **fails if source passes a
  param no fixture drives**. It mounts all 44 routes plus 31 param shapes and fails on any
  console error, page error, unhandled rejection or throw. It found two more crashes of the
  Wish Well class within minutes of being written (`toddlergame` and `expeditionpuzzle`, both
  computing a fallback and then ignoring it), and later refused S11's new `partial` param
  until it had a fixture.
- **`r12s4-contrast`** samples real pixels rather than compositing CSS: it renders each
  screen twice, masks the pixels the glyphs actually cover, and takes the worst one — so
  gradients, overlays and images are judged as rendered. 44 routes × 2 phases × 3 viewports,
  1312 text nodes, zero violations.
- **`r12s2-tricky-fair`** drives the round nobody had ever tested: the one where the player
  does not play.

---

## 3. BY-DESIGN findings, recorded with their reasoning

- **F12-18, hearts are informational.** `js/gameshell.js` has said so since it was written:
  "hearts (informational, round never ends early)". No caller ends a round at zero, and that
  is deliberate — nothing in Boo Town punishes a child out of a round. The genuine defect was
  that nothing on screen said so, and that the row's only accessible name was `"tries left 3"`,
  where the word *tries* actively implies a limit that does not exist. Recorded as a
  remaining gap rather than silently changed, because renaming it is a copy decision.
- **F12-12's proportional hour hand.** Dragging the minute hand moves the hour hand. That is
  not a bug; it is the lesson. At half past, the hour hand *should* sit between the numbers,
  and the rejection of a clock reading "7 o'clock" when the order asked for "half past 7" is
  pedagogically correct. S10 kept the rejection and added the explanation.
- **F12-16, journal dates.** Does not reproduce. `stampJournal()` is the only writer of
  journal dates and it stores `todayKey()`, so a stamp cannot predate its save; a brand-new
  v14 save renders an empty journal and zero trophies. The nearest real behaviour is
  `retroAwardOnce()` awarding "100 total stars" and "Every Zone Open" to a save that already
  had the stars but had never opened the Trophy Room, under a ceremony captioned "Look what
  you had already earned" — which *reads* as a retro-dated trophy without being one.
- **F12-07's blank rarity badge.** Does not reproduce: every kind rendered a real badge. The
  fallback was not blank, it was wrong — a bed was told "Your very own Boo!". Fixed anyway,
  and the no-rarity case now omits the badge entirely rather than printing anything.
- **PWA install and gyro prompts** were desktop artefacts of the review environment, not
  product behaviour, and were not carried into the triage.

---

## 4. Honest notes on the fixes

- **S3, species labels.** This art set contains no species pair that differs in exactly one
  part. The authored table uses a `bloop` base because its own signature (two small fangs) is
  the least visible in the set, so the odd Boo's signature is what stands out; for `munch` the
  mouth is the only difference of substance. For the other four pairs the odd Boo also carries
  the default grin rather than bloop's fangs — a real but distinctly secondary cue. Naming the
  dominant, always-visible part is the honest maximum here, and the suite proves the named part
  really differs in the rendered SVG.
- **S4, a visible palette change.** Cream text on `--pop` measures 2.25:1. Making the app's
  primary button legible meant recolouring its label to ink across fifteen rules. Buttons are
  the same pink; the words on them are now dark. This is the largest visual change in the run
  and it was unavoidable under G7.
- **S7, the residual few pixels.** Dancer *bounds* sit 0px off the declared surface. Their
  drawn *soles* are 7–10px above it, which is the Boo art's own transparent bottom margin. The
  suite asserts both, separately, rather than reporting the flattering number alone.
- **S12, a second cause.** The report described bubbles going behind the HUD. They also went
  behind the **question card**, which the report did not mention and which the containment
  sweep found. Both are fixed; the play field's top inset is measured from the card.
- **S11, what a partial round does not earn.** Banking pays stars and meter points for work
  actually done. It deliberately does not award the medal tally, the personal best or the
  Caper clue that only a *finished* round should.

---

## 5. Remaining gaps

1. **F12-17, the Star Chest.** Triaged as CONFIRMED and *not* fixed in this run. With
   `chestState().ready === false` the rail chip's `onclick` is a no-op: no feedback, no
   explanation, nothing. The information a child needs is already computed (the aria-label
   reads "Star Chest: 12 of 50 stars") but never shown. Fixing it properly means deciding what
   a not-yet-ready chest should *do* when tapped — a small design decision, and RUN15 owns the
   shop and star types. Logged in `NEEDS_ALEX.md`.
2. **Hearts copy.** They are informational by design, but "tries left 3" says the opposite.
   A one-word copy change would settle it; it is a decision, not a repair.
3. **Read-aloud coverage.** S13 wired the speaker control into Bubble Pop, Boo Dash and Boo
   Beat — the three question surfaces the reviewer used. Feed the Boos, Spell Boo, Clock Shop
   and the toddler games speak their prompts through other paths and were left alone.
4. **`m3-pwa`'s offline-reload section** remains the standing block from RUN11: `main.js`
   deliberately unregisters service workers on localhost (§11.6), so the guarantee is
   unprovable in the local harness. Unchanged by this run. See `BLOCKED.md`.
5. **Score games do not bank.** Boo Blocks and Boo Pop have no per-question notion of
   "correct so far", so leaving them mid-game still banks nothing. Documented rather than
   guessed at.

---

## 6. What a child would actually notice

The first card she taps no longer takes the app down. The intro stops the game instead of
playing it behind its own back — Flash Boos' scene is still there when she finishes reading.
A phrase she watches go by is not filed as a wrong answer. The odd Boo is findable by
looking, and the explanation names something she can check. Every word on every screen is
readable. Boos on the dance floor stand on the dance floor. The lit Boo in Echo Boos is
unmistakable with the sound off. A three-year-old can ask to hear the animal again, as many
times as she likes, for nothing. The clock starts fair every time. And if she has to stop
after seven right answers, she keeps them.
