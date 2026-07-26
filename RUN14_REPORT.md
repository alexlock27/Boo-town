# RUN14 — MOTION & MUSIC

Two game rebuilds and one harness rebuild. Everything below is measured, not asserted:
the numbers come from `tests/run14_audit.md` (the before), `tests/run14_hitwindow.md`
(the judge), `tests/board-serial-baseline.md` (the board) and the two new acceptance
suites, `tests/r14u1-booroll.mjs` and `tests/r14u2-beat.mjs`.

---

## U-0 — the harness, expanded

**The board went from 53m 40s to 20m 26s.** 127 suites, four worker lanes balanced by
measured per-suite durations, then the `@serial` set — frame-sampling, audio-timing and
device-simulation suites, tagged `// @serial` in their own headers — run alone at the end.

| | before | after |
|---|---:|---:|
| Full board, wall clock | 53m 40s | **20m 26s** (parallel 514s + serial tail 712s) |
| `--smoke` packet gate | (did not exist) | 107s |
| `r12s3-oddboo` | 499s | **7s** |
| `r12s4-contrast` | 205s | 106s |

**The diet did not weaken a single assertion — it strengthened one.** `r12s3-oddboo` still
drives its 200 scripted rounds and still checks every word the game says; what changed is
that the product's own pacing timers (a 1.5s anti-brute-force lockout, a 720ms round
advance) are now fast-forwarded through Playwright's stubbed clock instead of slept
through. It is a logic-honesty suite, not frame evidence, so the evidence law permits it.

`r12s4-contrast` was rebuilt around **condition-waits instead of fixed sleeps** — a screen
is judged only once every finite animation has finished, checked twice 160ms apart — plus
line-box (Range rect) scoping, an animation freeze across the capture block, and
`-webkit-text-fill-color`-only glyph hiding. That last one mattered: `color: transparent`
switches colour-emoji to a different font with different advance widths, so any node
containing an emoji **reflowed** between the two captures and its shifted edges read as
"ink on navy". A whole class of false violations came from one CSS property.

**And the stricter audit found 15 real G7 failures the old timing had been skipping** —
late-animating screens were being excluded as "still moving" and never judged at all:

- **the Boo Expedition puzzle screen at 1.01:1** — ink on navy, functionally invisible, on
  every viewport, with its title rendering *underneath* the floating back button;
- disabled buttons (`opacity: .4` → a solid muted style that stays readable);
- selected accessory chips, the disco track pill, the guitar strum plate, xylophone bar
  labels, locked Boo Quest node titles, the "My character" name and hint, the empty-jams
  line, and the Expedition/Caper primary buttons.

All fixed; every suite covering those screens re-run green.

**`r4p12-reach` is fixed and BLOCKED.md's only item is closed.** The recommendation there
was exact: hold the app's organic timers still during the walk. `window.BooTown
.qaHoldOrganic()` exposes the suspension pair `js/intro.js` already had, and
`checkAndCelebrate()` now waits while a round is suspended — which also means **an intro
overlay is protected from organic trophy ceremonies**, a real product improvement that fell
out of the test fix. One further nondeterminism surfaced while closing it: a box drop can
award `extraBoxes`, making "Keep for later" correctly *re-open* the ceremony rather than
navigate away. Three consecutive green runs, 394/394 checks each.

The one item declined: **moving more suites to direct node execution.** The six pure-logic
suites already run without a browser; every remaining sub-2s suite imports module graphs
that touch `localStorage`/`window` at import time, so converting them means shims that can
drift from the runtime — a real correctness risk for about a second each. Documented as a
deliberate non-change rather than quietly skipped.

---

## U0 — the playtest audit

Full detail in `tests/run14_audit.md`. The headline findings, all measured from live play:

- **Boo Roll: a constant lean with no other input FINISHED two of the three courses**, in
  6.7s and 8.9s against gold pars of 55s and 85s. The third soft-locked in a respawn loop.
  Mechanisms never joined the collision model, and rolling onto a raised platform
  *teleported* the ball up to it, so height was never earned.
- **Boo Roll: 1 pickup star of 9 was collectable.** There was no jump; nothing the player
  could do changed the ball's height. Closest approach to the other eight: 50-356px against
  a 42px pickup radius.
- **Boo Beat: something was tappable for 13.2% of a round**, with 3.5-4.5s of dead air
  between phrases, ten times a round.
- **Boo Beat: a press outside ±160ms was silently ignored** — no sound, no wobble, nothing.

---

## U1 — Boo Roll 3.0

### The hard gate, which is the whole point

**A fixed-lean policy — constant maximum tilt one way, no paddle, no hop — now FAILS all
six authored courses, in both directions. Twelve runs, twelve failures.** One is given five
simulated minutes and still never finishes.

| course | fixed lean, right | fixed lean, left | scripted competent play | gold ×1.4 |
|---|---|---|---:|---:|
| First Roll | stops at x 56 | stops at x 6 | **4.8s** | 28s |
| Over and Under | stops at x 38 | stops at x 5 | **18.1s** | 36s |
| Lift Off | stops at x 22.7 | stops at x 1.4 | — (BLOCKED, below) | — |
| Spin Cycle | stops at x 20.7 | stops at x 5 | **4.8s** | 48s |
| The Gate | stops at x 32.7 | stops at x 4 | **5.0s** | 53s |
| Sunset Ridge | stops at x 79.6 | stops at x 1.5 | **8.1s** | 63s |

Each stopping point is the course's own authored anti-lean device doing its job: the
idle-tipped seesaw at x 56, the +12° rise at x 38 that cannot be climbed from a standstill,
the vertical girder at x 20.7, the closed gate at x 32.7.

The proof runs against **the same engine the child plays** — `js/games/boorollphysics.js` is
DOM-free and deterministic on a fixed 60Hz step, and `js/games/booroll.js` renders it. A
proof against a separate model would prove nothing about the game.

### What else the suite establishes

- Every playable course is completable by scripted competent play **and** through the drag
  puck, inside gold ×1.4.
- **13 of 15 pickup stars are reachable** by routes that use the hop (two authored
  exceptions, below), and each course has at least one star that genuinely requires it.
- **The hop cannot bypass any mechanism**: it rises 7.06 units — under every girder pole
  (10-12) and gate (8-10) — and carries 11.8 units at full speed, clearing the authored
  10-unit "exam" gap but never a 12-unit girder void. A hop-spamming policy that never
  touches the paddle finishes none of the mechanism-gated courses.
- A catch floor never BONKs from any height, and parachutes home after exactly 3 seconds.
- One screen, no camera: one authored `0 0 100 60` viewBox at every viewport, nothing
  scrolls.
- Orientation lock is requested on GO, with the iOS-Safari fallback card exercised under a
  stubbed API; **calibration accepts an arbitrary pose** (a lazy 35° hold reads as level).
- The calibration copy is the authored line, exactly: *"Hold it however you like — then tap
  GO!"* — and the words "hold flat" appear nowhere.
- VERSION 16 migration: every RUN9 and RUN10-P8 best time and medal is preserved verbatim
  under `booRoll.legacy`, nothing is invented for the new courses, and migrating twice
  changes nothing.

### G10 — is the rebuild better on its own feel goals?

The feel goals were: *the ball has weight; a slope makes her lean without thinking; a
course is a puzzle you read at a glance and then execute; a run has rhythm.* Argued from
evidence, not assertion:

- **"Read at a glance"**: 6-8 screenfuls of camera-scrolled world → one screen, whole.
  Measured: the SVG fits inside the stage at 1024×768, 768×1024 and 390×844, and the page
  does not scroll at any of them.
- **"Execute"**: input mattered so little that *not touching the controls* won two courses
  in under nine seconds. Now it wins nothing, anywhere, in either direction.
- **"A run has rhythm"**: the old runs had one verb (lean). The new ones are built from
  four — build speed, brake against the roll, time a mechanism, hop — and the scripted
  routes need all four: Course 5 cannot be taken without a deliberate counter-lean, Course
  2 without a run-up, Course 4 without two girder presses.
- **"Weight"**: gravity, friction, a capped speed and *partial* air control (50%) — enough
  that a child who misjudges a leap can lean back and still land on the deck below, not
  enough to steer in mid-air.

This is not a lateral move; the anti-pattern the brief named ("hold-right-to-win") was
literally true of the old game and is now provably false of the new one.

### Blocked, with traces (see BLOCKED.md, NEEDS_ALEX.md)

Two authored geometry conflicts. Neither is mine to fix — the brief is explicit that
geometry is not an executor's to change — so both are logged with simulation evidence:

1. **Course 3 "Lift Off" cannot be finished.** A wall at x 24 (height 14) stands between
   the only approach platform and the first lift at x 26. Clearing it needs a 12.7-unit
   climb; the hop rises 7.06, and a hop big enough would clear every girder and gate in the
   pack. All 42 tested input policies end resting against that wall at x 22.7. **The course
   ships exactly as authored but its card is a construction site — "Being built — back
   soon! 🚧" — and cannot be entered.** A child must never be handed a course she cannot
   finish. The trophy requirements exclude it, so "All Gold" stays earnable.
2. **Course 2's third star sits on an unstandable deck.** The lower deck spans x 30-64 with
   no hole above it, and the only fall lands on the lift at x 68-76 — a 4-unit void
   separates them. The course itself is fine and ships. The star is pinned by name in the
   suite so the situation cannot silently change in either direction.

Both have a one-number fix suggested to the maintainer; neither was applied.

---

## U2 — Boo Beat 2.0

| | before (U0) | after |
|---|---:|---:|
| Round time with something tappable | **13.2%** | **88.3%** |
| Longest stretch with nothing to hit | 3.5-4.5s | **283ms** |
| Judged window | ±160ms | **±220ms** |
| A press outside the window | silently ignored | answered: "so close — a tiny bit early/late!" |

- **Continuous music with tap-along notes.** Groove notes flow on the beat throughout and
  any lane accepts them; they carry no learning value and cost nothing when missed. Density
  rises with level (2 → 3 → 4 per bar) and syncopation with it.
- **Questions on the phrase.** A question trio lands every four bars, on a bar downbeat,
  measured across a live round: gaps of exactly 16, 16, 16 beats. Its card appears one bar
  ahead for reading time.
- **The music never stops** — verified across a wrong answer, a missed question, and six
  continuous seconds of play including a question boundary.
- **The judge is instrumented.** `tests/run14_hitwindow.md` reports a live sweep of the
  shipped judge at controlled offsets (the boundaries land exactly where the constants
  say), a model of a nine-year-old's press error showing what each candidate window would
  accept, and a played round's real distribution. **220ms is where the returns stop**: the
  old 160ms rejected roughly one genuine attempt in six, and past ~240ms the extra width
  starts buying accidental hits rather than accuracy.
- **The hit window is a place, not a guess.** A visible band is drawn to exactly
  `2 × GOOD_MS` of note travel at the round's tempo — measured 113px against 115px expected.
- **Difficulty rises through music, never by shortening thinking time.** The reading lead,
  the judged window, the fall time and the question cadence are byte-identical at every
  level; only groove density and syncopation change. This is now a permanent rule.
- Steady mode measurably differs (517ms → 662ms per beat, and a thinner groove).

### G10 — is it better on its own feel goals?

*It should feel like playing along to a song she likes; hitting the answer on the beat
should feel great; there should be no dead air.* The old game was, by measurement, a quiz
with a soundtrack: the player was idle 87% of the time and the backing track played on
without her. The rebuild makes her hands part of the music for 88% of the round, and the
groove answers every tap with the next note of the melody. The dead air the brief named is
gone — 4.5 seconds became 283 milliseconds.

---

## Remaining gaps

- **BLOCKED.md carries two items**, both authored Boo Roll geometry (above), both with a
  suggested one-number fix awaiting the maintainer.
- Course 3 is unplayable by design until that answer arrives.
- The node-direct conversion of the remaining fast browser suites was assessed and
  declined, with reasons, rather than done.
