# Boo Town — OFFICIAL serial full-board baseline

> **RUN14 U-0 ACCEPTANCE — RECORDED 2026-07-26 ~21:00.** The first sharded board ran
> against this baseline: **127 suites (125 baseline + r13bt7/r13bt8 from RUN13B),
> 4 workers, parallel 514s + @serial tail 712s = 20m 26s wall** against the baseline's
> 53m 40s — a 62% cut, inside the 25-minute budget. In-board verdict: PASS=124 FAIL=3,
> triaged per the baseline's own protocol:
> - `r7p2-zones` — NOT a sharding regression: RUN13B T8 (after this baseline) dressed
>   the meadow, superseding the suite's "meadow has no zone-props layer" assertion.
>   The suite now asserts the standing rule (layer present, pointer-events none).
> - `r6p8-booquest`, `r10p3-buildmode` — parallel-LOAD sensitivity, not sharding
>   correctness: both reproduce green serially, first try. Their waits are now
>   load-proof (rAF-paced choreography gets a generous polling ceiling; no assertion
>   weakened). Verified green after hardening.
> Zero failures were sharding bugs (no suite dropped, no cross-suite interference).
>
> **@serial suites over the 120s budget, justified (Board Law):**
> - `r13t5-cosmetics` (194s) — species-idle / dance frame evidence: dozens of 6+ frame
>   pixel-hash sequences under real clocks; parallel load starves the rAF cadence.
> - `r13t1-care-direct` (168s) — pixel-hashed 8-frame sequences per care action per
>   viewport; same real-clock evidence law.
> - `r18d-intro-freeze` (~110s, RUN18D D3) — drives all eighteen games into a live round and
>   watches each for 2s with an overlay up. A frozen clock and a clock starved by parallel
>   load are indistinguishable, so this one has to run alone.
> - `r12s12-bubble-containment` (132s -> ~185s after RUN18D D2) — a 60s live containment
>   watch plus a 22s respawn watch; the minute-long observation IS the assertion. D2 added
>   a 1.5s drift measurement at each of the four levels and a 14s retire/respawn watch,
>   because the authored BUBBLE_SPEED_PX_S table can only be checked on a running board.
> Every non-@serial suite measured under 120s (slowest: r12s4-contrast 109s,
> r4p3-rewards 108s, r12s1-routes 94s).
>
> **@serial suites added since (Board Law: each states its expected runtime):**
> - `r17x3-feelings` (~95s, RUN17 X3) — INSIDE the 120s budget, but @serial on the other
>   Board Law ground: it MEASURES the breathing cycle's authored 4s/2s/6s x4 timings
>   against a real clock, and a deliberately unhurried 48-second rhythm is exactly the
>   cadence parallel load starves. Tagged at birth rather than after a flake.

> **This file is the official serial comparison baseline for RUN14 packet U-0's sharding
> acceptance.** A sharded run is accepted only if it reproduces the PASS and FAIL verdicts
> below **exactly**: the same suites passing, the same suites failing, and the same number
> of suites executed. Wall-clock time is what sharding exists to beat; the verdicts are
> what it must not change.
>
> **This was the last serial full board this project ran.** After U-0 there is no second
> chance to take this measurement, so it is recorded here in full.

## Run identity

| | |
|---|---|
| Commit | `c2e147329a2f` |
| BUILD_STAMP | `run13-t6-20260726` |
| Save VERSION | 15 |
| Runner | `./_runall.sh` — serial, one suite at a time, no retries |
| Server | `python scripts/serve.py 8123` (HTTP/1.1 keep-alive) |
| Base URL | `http://127.0.0.1:8123` |
| Machine state | quiet — nothing else running, no concurrent suites |
| Started | 2026-07-26 17:03:15 |
| Finished | 2026-07-26 17:56:54 |
| **Total wall time** | **53m 40s** (3220s) |
| Suites enumerated | 125 |
| Suites with a result log | 125 |
| **Board result** | **PASS=125  FAIL=0** |

### Failing suites in this baseline

**None.** A sharded run must reproduce a clean board. Any failure under sharding is a
regression in the sharding until proven otherwise — the serial board was green here.

## Provenance — why this is the second run

A clean serial board was run first, at commit `4e4e270`, and finished **PASS=124 FAIL=1**.
The single failure was real, not a flake: `r5p6-intros` hardcoded `texts.length === 34`
for the total number of authored intro steps in `js/intro.js`, and RUN13 T2 gave Boo Care
a three-step intro of its own, making it 37. The suite now derives the count from
`INTRO_SCRIPTS` and asserts only a floor (plus that `care` carries a script at all).

That fix changed the tree, so the first run no longer described what RUN14 will shard —
a sharded run against the fixed tree would have come back green and been **rejected for
being correct**. The baseline below is therefore the run taken AFTER the fix. The first
run is recorded here rather than discarded, because a baseline that appears from nowhere
is harder to trust than one that shows its own history.

## Timing method, and the trap in it

No instrumentation was added, so the measured run is the real one, unperturbed.

The obvious method — per-suite duration = log `mtime` − log `birth` — is **wrong on this
filesystem**. NTFS *file tunneling* restores a deleted file's original creation timestamp
when a file of the same name is recreated within about fifteen seconds, and `_runall.sh`
recreates every `/tmp/reg_<suite>.log` immediately after they were cleared. `reg_audit.log`
came back carrying a birth time from a previous day, which is how this was caught.

Because the board runs **strictly serially**, the mtime chain is exact and immune to it:

```
suite N duration = mtime(N) - mtime(N-1)      # completion to completion
first suite      = mtime(1) - birth(board log)
```

`/tmp/board_clean.log` is created once by the `>` redirect and never recreated, so its
birth time is a sound anchor. Completion order below is the mtime order itself.

Cross-check against birth times where those were usable: **1 suite(s)**
disagreed with the chain by more than a second, listed here rather than hidden —
each is a suite whose log was tunneled or whose process lingered after its last write:

| Suite | chain | birth-based |
|---|---:|---:|
| `audit` | 73.6s | 71.6s |

Per-suite durations sum to 53m 40s against a 53m 40s total; the
difference is process spawn and teardown between suites.

## Assertion counts, and what they do and do not mean

122 of 125 suites report per-assertion `✓` marks, totalling
**4075** passing assertions. The remainder use their own output conventions and
are not counted — an assertion total is a rough weight, never an acceptance criterion.

Suites using another convention (no `✓` marks):

- `audit`
- `portrait-qa`
- `r4p10-tablet`

## Per-suite results, slowest first

| # | Suite | Verdict | Duration | ✓ | ✗ |
|---:|---|---|---:|---:|---:|
| 1 | `r12s3-oddboo` | PASS | 499.4s | 53 | — |
| 2 | `r12s4-contrast` | PASS | 205.6s | 2 | — |
| 3 | `r13t5-cosmetics` | PASS | 193.6s | 67 | — |
| 4 | `r13t1-care-direct` | PASS | 167.3s | 147 | — |
| 5 | `r12s12-bubble-containment` | PASS | 131.8s | 19 | — |
| 6 | `r4p3-rewards` | PASS | 106.8s | 25 | — |
| 7 | `r12s1-routes` | PASS | 93.1s | 220 | — |
| 8 | `r12s13-a11y` | PASS | 88.9s | 44 | — |
| 9 | `r4p12-reach` | PASS | 85.0s | 394 | — |
| 10 | `r4p5-town` | PASS | 77.8s | 36 | — |
| 11 | `audit` | PASS | 73.6s | — | — |
| 12 | `r12s11-banking` | PASS | 59.7s | 83 | — |
| 13 | `r12s9-toddler-replay` | PASS | 58.0s | 49 | — |
| 14 | `r3p2-smartmix` | PASS | 52.1s | 11 | — |
| 15 | `r4p7-boopop` | PASS | 51.8s | 33 | — |
| 16 | `m2-full` | PASS | 50.3s | 7 | — |
| 17 | `r12s6-intro-pause` | PASS | 49.7s | 31 | — |
| 18 | `r12s2-tricky-fair` | PASS | 44.3s | 29 | — |
| 19 | `r6p4-rarity` | PASS | 40.2s | 27 | — |
| 20 | `r3p1-spellboo` | PASS | 32.6s | 21 | — |
| 21 | `r7p4-toddler` | PASS | 29.2s | 24 | — |
| 22 | `r6p2-funfair` | PASS | 27.2s | 27 | — |
| 23 | `r9p3-detective` | PASS | 26.3s | 29 | — |
| 24 | `r12s8-echo` | PASS | 25.1s | 49 | — |
| 25 | `p8-frames` | PASS | 24.7s | 16 | — |
| 26 | `m2-feedboos` | PASS | 24.5s | 6 | — |
| 27 | `r13t2-care-discovery` | PASS | 24.3s | 64 | — |
| 28 | `r6p1-town` | PASS | 23.9s | 32 | — |
| 29 | `r12s10-clock` | PASS | 23.8s | 17 | — |
| 30 | `r10p5-personalities` | PASS | 23.6s | 48 | — |
| 31 | `r10p1-worldmap` | PASS | 23.3s | 69 | — |
| 32 | `r5p5-phone` | PASS | 23.1s | 248 | — |
| 33 | `r6p8-booquest` | PASS | 22.9s | 23 | — |
| 34 | `m2-spellboo` | PASS | 22.6s | 6 | — |
| 35 | `r7p2-zones` | PASS | 22.5s | 23 | — |
| 36 | `r3p3-golden` | PASS | 22.0s | 9 | — |
| 37 | `r13t3-house-rooms` | PASS | 21.8s | 52 | — |
| 38 | `r10p3-buildmode` | PASS | 21.5s | 35 | — |
| 39 | `hotfix-dash-results` | PASS | 20.0s | 7 | — |
| 40 | `r10p2-sockets` | PASS | 19.8s | 25 | — |
| 41 | `r5p8-toddler` | PASS | 18.9s | 55 | — |
| 42 | `r6p9-perf` | PASS | 18.0s | 22 | — |
| 43 | `p6-beat` | PASS | 17.7s | 16 | — |
| 44 | `dp5-stars` | PASS | 16.7s | 8 | — |
| 45 | `r5p4-town` | PASS | 16.5s | 21 | — |
| 46 | `r12s5-ceremony` | PASS | 15.5s | 49 | — |
| 47 | `r13t4-furniture` | PASS | 15.4s | 37 | — |
| 48 | `r6p5-beat` | PASS | 15.1s | 24 | — |
| 49 | `dp3-back` | PASS | 14.4s | 10 | — |
| 50 | `r9p6-band` | PASS | 14.0s | 35 | — |
| 51 | `r3p5-clock` | PASS | 13.9s | 14 | — |
| 52 | `r12s7-sockets` | PASS | 13.7s | 32 | — |
| 53 | `r7p1-funfair` | PASS | 13.6s | 26 | — |
| 54 | `r4p9-delights` | PASS | 13.5s | 19 | — |
| 55 | `r9p5-echoboos` | PASS | 12.7s | 16 | — |
| 56 | `r9p7-garnish` | PASS | 12.4s | 18 | — |
| 57 | `m1` | PASS | 11.8s | 10 | — |
| 58 | `r5p6-intros` | PASS | 11.1s | 61 | — |
| 59 | `m3-grownups` | PASS | 10.8s | 9 | — |
| 60 | `r6p7-juice` | PASS | 10.3s | 16 | — |
| 61 | `r10p4-interiors` | PASS | 10.1s | 38 | — |
| 62 | `r4p1-nav` | PASS | 9.8s | 29 | — |
| 63 | `r4p10-tablet` | PASS | 9.5s | — | — |
| 64 | `m2-onboard` | PASS | 9.4s | 10 | — |
| 65 | `p3-town` | PASS | 9.4s | 14 | — |
| 66 | `r6p3-band` | PASS | 8.9s | 19 | — |
| 67 | `r5p1-quickwins` | PASS | 8.7s | 22 | — |
| 68 | `r4p6-growth` | PASS | 8.5s | 20 | — |
| 69 | `r10p12-care` | PASS | 8.5s | 21 | — |
| 70 | `r7p3-hub` | PASS | 8.5s | 25 | — |
| 71 | `p5-bounce` | PASS | 8.0s | 15 | — |
| 72 | `r5p3-boopop` | PASS | 7.4s | 17 | — |
| 73 | `r11map-art` | PASS | 7.1s | 18 | — |
| 74 | `r4p4-trophies` | PASS | 7.1s | 85 | — |
| 75 | `r6p0-reconcile` | PASS | 6.9s | 22 | — |
| 76 | `p2-rewards` | PASS | 6.8s | 27 | — |
| 77 | `r11audit` | PASS | 6.7s | 17 | — |
| 78 | `p7-expansion` | PASS | 6.6s | 13 | — |
| 79 | `dp4-age` | PASS | 6.6s | 12 | — |
| 80 | `r8p0-bounce` | PASS | 6.5s | 21 | — |
| 81 | `r10p15-expedition` | PASS | 6.0s | 3 | — |
| 82 | `r8p2-export` | PASS | 6.0s | 22 | — |
| 83 | `r8p3-restore` | PASS | 6.0s | 15 | — |
| 84 | `r3p8-social` | PASS | 5.9s | 16 | — |
| 85 | `r10p16-expedition-puzzles` | PASS | 5.9s | 8 | — |
| 86 | `r10p17-caper` | PASS | 5.9s | 3 | — |
| 87 | `r5p7-studio` | PASS | 5.9s | 49 | — |
| 88 | `r5p2-blocks` | PASS | 5.6s | 22 | — |
| 89 | `r4p8-shiny` | PASS | 5.5s | 25 | — |
| 90 | `r3p7-voices` | PASS | 5.3s | 8 | — |
| 91 | `r6p6-bounce` | PASS | 5.3s | 12 | — |
| 92 | `portrait-qa` | PASS | 5.2s | — | — |
| 93 | `r8p4-visibility` | PASS | 4.9s | 19 | — |
| 94 | `r10p19-brain` | PASS | 4.8s | 21 | — |
| 95 | `p4-blocks` | PASS | 4.5s | 26 | — |
| 96 | `r10p10-p11` | PASS | 4.2s | 20 | — |
| 97 | `r4p10-phone` | PASS | 3.8s | 17 | — |
| 98 | `p1-creator` | PASS | 3.5s | 23 | — |
| 99 | `r10p18-disco` | PASS | 3.5s | 13 | — |
| 100 | `r10p13-slots` | PASS | 3.4s | 19 | — |
| 101 | `r10p9-detective` | PASS | 3.3s | 16 | — |
| 102 | `r11q5-caper-spec` | PASS | 3.1s | 22 | — |
| 103 | `m2-collection` | PASS | 3.1s | 13 | — |
| 104 | `r4p2-picker` | PASS | 2.9s | 68 | — |
| 105 | `r3p6-studio` | PASS | 2.7s | 11 | — |
| 106 | `r10p6-bandscenes` | PASS | 2.7s | 13 | — |
| 107 | `m3-pwa` | PASS | 2.7s | 10 | — |
| 108 | `r11q7-cameo` | PASS | 2.3s | 4 | — |
| 109 | `m3-motion` | PASS | 2.2s | 5 | — |
| 110 | `r10p20-wishwell` | PASS | 2.1s | 21 | — |
| 111 | `r10p8-booroll` | PASS | 2.1s | 12 | — |
| 112 | `r11q4-expedition-spec` | PASS | 1.6s | 13 | — |
| 113 | `r11q1-retire` | PASS | 1.1s | 15 | — |
| 114 | `r5p0-ledger` | PASS | 1.1s | 16 | — |
| 115 | `r3p9-content` | PASS | 1.0s | 17 | — |
| 116 | `r3p4-quests` | PASS | 0.9s | 13 | — |
| 117 | `r10p21-delights` | PASS | 0.8s | 9 | — |
| 118 | `r8p1-rescue` | PASS | 0.6s | 16 | — |
| 119 | `r8p1-snapshots` | PASS | 0.6s | 9 | — |
| 120 | `content` | PASS | 0.3s | 4 | — |
| 121 | `r10p14-attrengine` | PASS | 0.2s | 17 | — |
| 122 | `r11q1-privacy-guard` | PASS | 0.2s | 4 | — |
| 123 | `r11q9-zeronet` | PASS | 0.1s | 9 | — |
| 124 | `r11q6-courses-spec` | PASS | 0.1s | 64 | — |
| 125 | `r8p1-migrations` | PASS | 0.1s | 283 | — |

## Per-suite results, in the order the board ran them

| # | Suite | Verdict | Duration | Finished |
|---:|---|---|---:|---|
| 1 | `audit` | PASS | 73.6s | 17:04:28 |
| 2 | `content` | PASS | 0.3s | 17:04:28 |
| 3 | `dp3-back` | PASS | 14.4s | 17:04:43 |
| 4 | `dp4-age` | PASS | 6.6s | 17:04:49 |
| 5 | `dp5-stars` | PASS | 16.7s | 17:05:06 |
| 6 | `hotfix-dash-results` | PASS | 20.0s | 17:05:26 |
| 7 | `m1` | PASS | 11.8s | 17:05:38 |
| 8 | `m2-collection` | PASS | 3.1s | 17:05:41 |
| 9 | `m2-feedboos` | PASS | 24.5s | 17:06:05 |
| 10 | `m2-full` | PASS | 50.3s | 17:06:56 |
| 11 | `m2-onboard` | PASS | 9.4s | 17:07:05 |
| 12 | `m2-spellboo` | PASS | 22.6s | 17:07:28 |
| 13 | `m3-grownups` | PASS | 10.8s | 17:07:39 |
| 14 | `m3-motion` | PASS | 2.2s | 17:07:41 |
| 15 | `m3-pwa` | PASS | 2.7s | 17:07:44 |
| 16 | `p1-creator` | PASS | 3.5s | 17:07:47 |
| 17 | `p2-rewards` | PASS | 6.8s | 17:07:54 |
| 18 | `p3-town` | PASS | 9.4s | 17:08:03 |
| 19 | `p4-blocks` | PASS | 4.5s | 17:08:08 |
| 20 | `p5-bounce` | PASS | 8.0s | 17:08:16 |
| 21 | `p6-beat` | PASS | 17.7s | 17:08:33 |
| 22 | `p7-expansion` | PASS | 6.6s | 17:08:40 |
| 23 | `p8-frames` | PASS | 24.7s | 17:09:05 |
| 24 | `portrait-qa` | PASS | 5.2s | 17:09:10 |
| 25 | `r10p1-worldmap` | PASS | 23.3s | 17:09:33 |
| 26 | `r10p10-p11` | PASS | 4.2s | 17:09:37 |
| 27 | `r10p12-care` | PASS | 8.5s | 17:09:46 |
| 28 | `r10p13-slots` | PASS | 3.4s | 17:09:49 |
| 29 | `r10p14-attrengine` | PASS | 0.2s | 17:09:50 |
| 30 | `r10p15-expedition` | PASS | 6.0s | 17:09:56 |
| 31 | `r10p16-expedition-puzzles` | PASS | 5.9s | 17:10:01 |
| 32 | `r10p17-caper` | PASS | 5.9s | 17:10:07 |
| 33 | `r10p18-disco` | PASS | 3.5s | 17:10:11 |
| 34 | `r10p19-brain` | PASS | 4.8s | 17:10:16 |
| 35 | `r10p2-sockets` | PASS | 19.8s | 17:10:36 |
| 36 | `r10p20-wishwell` | PASS | 2.1s | 17:10:38 |
| 37 | `r10p21-delights` | PASS | 0.8s | 17:10:38 |
| 38 | `r10p3-buildmode` | PASS | 21.5s | 17:11:00 |
| 39 | `r10p4-interiors` | PASS | 10.1s | 17:11:10 |
| 40 | `r10p5-personalities` | PASS | 23.6s | 17:11:34 |
| 41 | `r10p6-bandscenes` | PASS | 2.7s | 17:11:36 |
| 42 | `r10p8-booroll` | PASS | 2.1s | 17:11:38 |
| 43 | `r10p9-detective` | PASS | 3.3s | 17:11:42 |
| 44 | `r11audit` | PASS | 6.7s | 17:11:48 |
| 45 | `r11map-art` | PASS | 7.1s | 17:11:55 |
| 46 | `r11q1-privacy-guard` | PASS | 0.2s | 17:11:56 |
| 47 | `r11q1-retire` | PASS | 1.1s | 17:11:57 |
| 48 | `r11q4-expedition-spec` | PASS | 1.6s | 17:11:58 |
| 49 | `r11q5-caper-spec` | PASS | 3.1s | 17:12:01 |
| 50 | `r11q6-courses-spec` | PASS | 0.1s | 17:12:02 |
| 51 | `r11q7-cameo` | PASS | 2.3s | 17:12:04 |
| 52 | `r11q9-zeronet` | PASS | 0.1s | 17:12:04 |
| 53 | `r12s1-routes` | PASS | 93.1s | 17:13:37 |
| 54 | `r12s10-clock` | PASS | 23.8s | 17:14:01 |
| 55 | `r12s11-banking` | PASS | 59.7s | 17:15:01 |
| 56 | `r12s12-bubble-containment` | PASS | 131.8s | 17:17:12 |
| 57 | `r12s13-a11y` | PASS | 88.9s | 17:18:41 |
| 58 | `r12s2-tricky-fair` | PASS | 44.3s | 17:19:26 |
| 59 | `r12s3-oddboo` | PASS | 499.4s | 17:27:45 |
| 60 | `r12s4-contrast` | PASS | 205.6s | 17:31:11 |
| 61 | `r12s5-ceremony` | PASS | 15.5s | 17:31:26 |
| 62 | `r12s6-intro-pause` | PASS | 49.7s | 17:32:16 |
| 63 | `r12s7-sockets` | PASS | 13.7s | 17:32:30 |
| 64 | `r12s8-echo` | PASS | 25.1s | 17:32:55 |
| 65 | `r12s9-toddler-replay` | PASS | 58.0s | 17:33:53 |
| 66 | `r13t1-care-direct` | PASS | 167.3s | 17:36:40 |
| 67 | `r13t2-care-discovery` | PASS | 24.3s | 17:37:04 |
| 68 | `r13t3-house-rooms` | PASS | 21.8s | 17:37:26 |
| 69 | `r13t4-furniture` | PASS | 15.4s | 17:37:41 |
| 70 | `r13t5-cosmetics` | PASS | 193.6s | 17:40:55 |
| 71 | `r3p1-spellboo` | PASS | 32.6s | 17:41:28 |
| 72 | `r3p2-smartmix` | PASS | 52.1s | 17:42:20 |
| 73 | `r3p3-golden` | PASS | 22.0s | 17:42:42 |
| 74 | `r3p4-quests` | PASS | 0.9s | 17:42:43 |
| 75 | `r3p5-clock` | PASS | 13.9s | 17:42:57 |
| 76 | `r3p6-studio` | PASS | 2.7s | 17:42:59 |
| 77 | `r3p7-voices` | PASS | 5.3s | 17:43:05 |
| 78 | `r3p8-social` | PASS | 5.9s | 17:43:11 |
| 79 | `r3p9-content` | PASS | 1.0s | 17:43:12 |
| 80 | `r4p1-nav` | PASS | 9.8s | 17:43:21 |
| 81 | `r4p10-phone` | PASS | 3.8s | 17:43:25 |
| 82 | `r4p10-tablet` | PASS | 9.5s | 17:43:35 |
| 83 | `r4p12-reach` | PASS | 85.0s | 17:45:00 |
| 84 | `r4p2-picker` | PASS | 2.9s | 17:45:03 |
| 85 | `r4p3-rewards` | PASS | 106.8s | 17:46:49 |
| 86 | `r4p4-trophies` | PASS | 7.1s | 17:46:56 |
| 87 | `r4p5-town` | PASS | 77.8s | 17:48:14 |
| 88 | `r4p6-growth` | PASS | 8.5s | 17:48:23 |
| 89 | `r4p7-boopop` | PASS | 51.8s | 17:49:14 |
| 90 | `r4p8-shiny` | PASS | 5.5s | 17:49:20 |
| 91 | `r4p9-delights` | PASS | 13.5s | 17:49:33 |
| 92 | `r5p0-ledger` | PASS | 1.1s | 17:49:35 |
| 93 | `r5p1-quickwins` | PASS | 8.7s | 17:49:43 |
| 94 | `r5p2-blocks` | PASS | 5.6s | 17:49:49 |
| 95 | `r5p3-boopop` | PASS | 7.4s | 17:49:56 |
| 96 | `r5p4-town` | PASS | 16.5s | 17:50:13 |
| 97 | `r5p5-phone` | PASS | 23.1s | 17:50:36 |
| 98 | `r5p6-intros` | PASS | 11.1s | 17:50:47 |
| 99 | `r5p7-studio` | PASS | 5.9s | 17:50:53 |
| 100 | `r5p8-toddler` | PASS | 18.9s | 17:51:12 |
| 101 | `r6p0-reconcile` | PASS | 6.9s | 17:51:19 |
| 102 | `r6p1-town` | PASS | 23.9s | 17:51:43 |
| 103 | `r6p2-funfair` | PASS | 27.2s | 17:52:10 |
| 104 | `r6p3-band` | PASS | 8.9s | 17:52:19 |
| 105 | `r6p4-rarity` | PASS | 40.2s | 17:52:59 |
| 106 | `r6p5-beat` | PASS | 15.1s | 17:53:14 |
| 107 | `r6p6-bounce` | PASS | 5.3s | 17:53:19 |
| 108 | `r6p7-juice` | PASS | 10.3s | 17:53:30 |
| 109 | `r6p8-booquest` | PASS | 22.9s | 17:53:53 |
| 110 | `r6p9-perf` | PASS | 18.0s | 17:54:11 |
| 111 | `r7p1-funfair` | PASS | 13.6s | 17:54:24 |
| 112 | `r7p2-zones` | PASS | 22.5s | 17:54:47 |
| 113 | `r7p3-hub` | PASS | 8.5s | 17:54:55 |
| 114 | `r7p4-toddler` | PASS | 29.2s | 17:55:24 |
| 115 | `r8p0-bounce` | PASS | 6.5s | 17:55:31 |
| 116 | `r8p1-migrations` | PASS | 0.1s | 17:55:31 |
| 117 | `r8p1-rescue` | PASS | 0.6s | 17:55:32 |
| 118 | `r8p1-snapshots` | PASS | 0.6s | 17:55:32 |
| 119 | `r8p2-export` | PASS | 6.0s | 17:55:38 |
| 120 | `r8p3-restore` | PASS | 6.0s | 17:55:44 |
| 121 | `r8p4-visibility` | PASS | 4.9s | 17:55:49 |
| 122 | `r9p3-detective` | PASS | 26.3s | 17:56:15 |
| 123 | `r9p5-echoboos` | PASS | 12.7s | 17:56:28 |
| 124 | `r9p6-band` | PASS | 14.0s | 17:56:42 |
| 125 | `r9p7-garnish` | PASS | 12.4s | 17:56:54 |

## Where the time went

The ten slowest suites account for **51%** of the accounted runtime:

- `r12s3-oddboo` — 8m 19s
- `r12s4-contrast` — 3m 26s
- `r13t5-cosmetics` — 3m 14s
- `r13t1-care-direct` — 2m 47s
- `r12s12-bubble-containment` — 2m 12s
- `r4p3-rewards` — 1m 47s
- `r12s1-routes` — 1m 33s
- `r12s13-a11y` — 1m 29s
- `r4p12-reach` — 1m 25s
- `r4p5-town` — 1m 18s

These are where sharding has the most to win, and their cost is real work rather than
page-load overhead: full-viewport pixel audits, multi-minute containment runs,
frame-sampled motion evidence and multi-viewport sweeps. **A shard plan that puts two of
them in one lane will be bounded by that lane** — balance by these measured durations,
not by suite count.

## What a sharded run must reproduce

1. **All 125 suites execute.** Check the count first: a sharding bug that drops
   a suite is indistinguishable from a faster board.
2. **PASS=125, FAIL=0**, with the same suites on each side of the line.
3. **No suite may be skipped, quarantined, or retried-until-green** to reach that number.
   Where CLAUDE.md's flake rule was applied during RUN13, the batch verdict is what is
   recorded above — re-run results are noted in RUN13_REPORT.md and are NOT folded in here.
   A baseline that launders a flake into a pass is worse than no baseline.
4. **Timing is not part of acceptance.** It will change, and it is meant to.
5. Suites are enumerated by `_runall.sh` as `ls tests/*.mjs` minus the `shoot`,
   `sim-blocks` and `device-qa` prefixes. A sharder must use the same enumeration or it
   is not running the same board.

