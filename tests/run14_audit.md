# RUN14 U0 — playtest audit of Boo Roll and Boo Beat (2026-07-26)

Probe: `tests/lib/run14_u0_probe.mjs` (+ a per-course star probe), driven headlessly at
1024x768 / 768x1024 / 390x844. Raw numbers: `screenshots/run14/u0/probe.json`; frames in
`screenshots/run14/u0/`. Every named observation in RUN14.md was verified from LIVE play,
not from reading the code — code is cited only where it explains a measurement.

## Boo Roll (current: RUN10 P7/P8 side-view, 3 courses)

**1. "Leaning one direction carries the ball through an entire course" — CONFIRMED,
and it is worse than the brief feared.** A constant full lean with zero paddle presses:

| Course | Fixed-lean outcome | Time | Gold par |
|---|---|---|---|
| rolling-meadow | **FINISHED** | **6.7s** | 55s |
| windy-hill | finished in 1 of 2 runs; the other soft-locked at 20% in a bonk-respawn loop | ~7-60s | 70s |
| sunset-ridge | **FINISHED** | **8.9s** | 85s |

Two structural causes, seen in the traces: (a) the mechanisms never join the collision
model — a "vertical" girder, an un-ridden lift and a closed gate all let the ball
straight through, so every mechanism is decoration; (b) rolling onto an elevated
`platform` segment TELEPORTS the ball up to it (`y = groundY(seg) - BALL_R` on the
grounded path), so height is never earned. The 6.7s finish against a 55s gold par means
the medal table is measuring nothing. The windy-hill soft-lock is the same defect from
the other side: when the lean DOESN'T fly over a gap, the ball falls, bonks, respawns
behind the same gap and repeats forever — a leaning child either wins in seconds or is
stuck for eternity, and both without ever touching a control.

**2. "Stars sit off the line with no way to reach them" — CONFIRMED.** Closest approach
of the rolling line to each star (pickup radius 42px), measured across full runs:

| Course | star 1 | star 2 | star 3 | collected by rolling |
|---|---|---|---|---|
| rolling-meadow | 12px ✓ | 50px | 88px | 1/3 |
| windy-hill | 186px | 84px | 114px | 0/3 |
| sunset-ridge | 139px | 173px | 356px | 0/3 |

1 star of 9 is collectable. There is no jump; nothing the player can do changes the
ball's height. Eight stars are scenery.

**3. "The course spans multiple screens" — CONFIRMED.** Worlds are 6000/7000/8000px
against a 1000px canvas: 6-8 screenfuls, camera-scrolled. The 24px top strip is the only
whole-course view. Frames: `roll-play-*.png`.

**4. "The calibration card says hold flat" — CONFIRMED, verbatim.** The card reads
"Hold flat, then lean to roll. The finger puck is always ready too." and the GO button
is "✋ Hold flat, then tap GO" (`roll-calibrate-1024x768.png`). Nobody holds a tablet flat.

## Boo Beat (current: RUN2 C6 + RUN9 C6 backing)

**1. "The third lane's number is unreadable" — FIXED, verified.** RUN12 S4's contrast law
covers every lane label; the (now stricter) audit runs green across all three lanes at
390x844 (`beat-play-390x844.png`).

**2. "One note every few seconds is not music" — CONFIRMED by measurement.** Over a 40s
competently-played round: candidate notes existed on screen 100% of the time (the trio
lingers in the DOM), but something was actually TAPPABLE for only **13.2%** of the round.
There are no tap-along notes at all — three candidates arrive together once per phrase
(~every 4 seconds), and the hands are idle between them. The backing loop (kick/snare/
hats/bass/stabs from RUN9 C6) plays continuously and is genuinely musical — the GAME on
top of it is the sparse part.

**3. "Note presses near the line are sometimes not accepted" — CONFIRMED in code and
behaviour.** The judge is `PERFECT_MS = 80`, `GOOD_MS = 160`, and a press outside 160ms
is `if (errMs > GOOD_MS) return;` — silently ignored: no sound, no wobble, no judgement.
A child pressing 200ms early (entirely normal at age 9) experiences "my tap did nothing".
RUN14 U2's 220ms window with a visible hit-zone band is the fix, with the distribution
instrumented to tune it.

**4. "The wait between questions is dead time" — CONFIRMED.** After a phrase resolves:
450ms pause → notes scheduled 2 beats out → 4 beats of fall before anything is tappable
again ≈ **3.5-4.5s of nothing to do per phrase**, ten times a round. Combined with (2):
a "rhythm game" where the player is idle ~87% of the time.

## What U1/U2 must beat (G10 feel-goal baselines)

- Boo Roll: input must matter (fixed-lean fails all six authored courses — the U1 hard
  gate); a course readable at a glance (one screen, not 6-8); every star reachable by a
  real route (the hop); pars that mean something.
- Boo Beat: hands busy (tappable fraction FAR above 13.2%); nothing silently ignored
  within a generous honest window; no multi-second dead stretches; music never stops.
