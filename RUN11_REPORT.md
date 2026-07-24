# RUN11_REPORT.md — the salvage and repair pack

Outcome report for RUN11, executed against `main`. Strictly technical; no personal data.
Baseline at the start of the run: `run8v2-p4-20260724`, board **69 PASS / 24 FAIL of 88**,
save VERSION 12. Final state: **99 PASS / 5 FAIL of 104**, VERSION 14.

---

## 1. Packet outcomes

| Packet | Outcome | Suite delta |
|---|---|---|
| **Q1** Retire the party feature, purge names | **COMPLETED** | +`r11q1-retire`, +`r11q1-privacy-guard`; retired `birthday-twins` (tested a feature the maintainer retired) |
| **Q2** F-05 / P9 Word Detective GO + badges | **COMPLETED** | +`r10p9-detective` |
| **Q3** F-06 / P14 attribute engine | **ADOPTED + COMPLETED** | +`r10p14-attrengine`; `r10p19-brain` behaviour unchanged |
| **Q4** P15/P16 Boo Expedition | **ADOPTED + COMPLETED** | +`r10p15`, +`r10p16`, +`r11q4-expedition-spec` |
| **Q5** P17 Snaffle's Caper | **ADOPTED + COMPLETED** | +`r10p17`, +`r11q5-caper-spec` |
| **Q6** P8 courses + medals, P7 verification | **COMPLETED** | +`r11q6-courses-spec`; `r10p8-booroll` green |
| **Q7** P21 delight pack | **ADOPTED + COMPLETED** | +`r10p21-delights`, +`r11q7-cameo` |
| **Q8** S2 register (F-03, F-04, F-08, F-11) | **COMPLETED** | `r10p19-brain` red→green, `r10p10-p11` red→green |
| **Q9** S3 register (F-09, F-10) + residual board | **COMPLETED** | +`r11q9-zeronet`; 8 residual suites red→green |
| **Q10** Full board | **COMPLETED, 4 declared blocks** | 69/24 of 88 → **99/5 of 104** |
| **Q11** Feel pass | **PARTIAL** | fresh evidence at 3 viewports for 12 surfaces; 2 presentation fixes shipped |
| **Q12** This report | **COMPLETED** | — |

13 suites were added by this run; the board grew from 88 to 104 suites.

---

## 2. Final board

**99 PASS / 5 FAIL of 104.** `p6-beat` fails only inside a long serial batch and passes on
a direct re-run (the batch-load flake CLAUDE.md documents), so the effective standing is
**100 pass / 4 declared blocks**. Every block is in `BLOCKED.md` with a repro:

| Suite | Reason it is not green |
|---|---|
| `m3-pwa` (offline-reload section) | `main.js` deliberately unregisters service workers on localhost (§11.6), so the offline guarantee is unprovable in the local harness. The precache contract itself passes (119 files). |
| `r5p4-town` (min-spacing half) | The suite derives a "too close" tap from a fixed +62px offset; P20's pre-placed Wish Well changed the Meadow, so that point can now be genuinely free ground. Test-fixture problem, not a regression. |
| `r5p1-quickwins` | A later `.hub` wait. The oops-net → Restart → hub flow it asserts was verified working in isolation; the failing section was not isolated before the run ended. |
| `r9p7-garnish` (2 assertions) | Both need a **product ruling**, not a test edit: whether a wall graze should buzz (P7 specifies haptics for BONK, not every contact), and a voice-count expectation that predates P11's en-GB filter. |

---

## 3. The F-01..F-11 register — final dispositions

| ID | Finding | Disposition |
|---|---|---|
| F-01 | Boo Roll dead (missing `data/courses.js`) | **CLOSED** (RUN8 v2) — adopted the real dependency **trio**; Q6 then corrected the course data to the P8 spec. |
| F-02 | Town render `clearRarityFx` ReferenceError | **CLOSED** (RUN8 v2) — import completed; town cascade green. |
| F-03 | Echo Lightning best not separate | **CLOSED** (Q8) — the fields were already separate; the real defect was a new best only reaching disk on the 2s debounce. A personal best now commits immediately. |
| F-04 | "Flash Boos hang" | **CLOSED (and re-diagnosed)** (Q8) — **the audit mislabelled it.** The suite never reached the Flash section: it tapped the correct tile *during* the deliberate 1.5s anti-brute-force lockout that follows a wrong tap, so the tap was correctly ignored. Test fixed to wait the lockout out; `locked()` hook added. |
| F-05 | P9 GO key + tile badges absent | **CLOSED** (Q2). |
| F-06 | Wrong attribute engine | **CLOSED** (Q3) — real P14 engine adopted as `attrengine.js`; P19 helpers moved to `brainhelpers.js`. |
| F-07 | Child PII on a public site | **CLOSED** (Q1) — feature retired, names purged from every tracked file, permanent grep-guard suite. *Git history still contains them; rewriting history was out of scope.* |
| F-08 | `RECONCILE_REPORT.md` truncated | **CLOSED** (Q8) — rewritten in full from git history, including the two overturned adoptions and a correction of the "superseded" claim about the resume branch. |
| F-09 | Orphaned `puzzles.js` / `stories.js` | **CLOSED** (Q9) — deleted with their ASSETS entries after confirming no consumer has ever existed. Recoverable from commit `ec738dd`. |
| F-10 | The lone `fetch()` | **CLOSED** (Q9) — `assertDataUrl()` guard + stated invariant + `r11q9-zeronet` suite. |
| F-11 | Band melody validator "missing" | **CLOSED (was never missing)** (Q8) — it lives in `tests/lib/melody.mjs`, run by `r9p6-band`. All four Hits pass every rule; see §4. |

---

## 4. Melody validator report (F-11)

All four Boo Pop Hits pass **every** binding P6 rule. No recomposition was needed.

| Hit | bpm | progression | beats | off-beat | durations | hook recurs | rests | chord tones | final note | range | loop |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Golden Boo | 116 | Am-F-C-G | 64 | ✓ | ✓ | ✓ (authored hook) | 2 | 77% | G over G | 0–16 | ✓ |
| Neon Star | 120 | I-V-vi-IV | 64 | 29% | 4 distinct | ✓ | 4 | 91% | F over F | 0–16 | ✓ |
| Sparkle Rush | 124 | I-vi-IV-V | 64 | 35% | 4 distinct | ✓ | 2 | 87% | G over G | 2–16 | ✓ |
| Midnight Dance | 112 | vi-IV-I-V | 64 | 30% | 4 distinct | ✓ | 4 | 92% | D over G | 0–16 | ✓ |

Trio distinctness: all three pairs differ on progression, bpm **and** first-four hook notes.

---

## 5. Feel pass (Q11) — evidence and honest critique

Fresh frames were captured for 12 surfaces at 1024x768, 768x1024 and 390x844
(`screenshots/r11q11/`), with a per-screen audit of button overlap, horizontal scroll and
page errors.

**Result: every screen is clean** — zero overlapping primary buttons, no horizontal scroll,
no page errors, at all three viewports. (An initial sweep flagged the world map and town;
both were seeding artifacts — a Trophy-Room retro ceremony and a zone-unlock toast covering
the screen — and a focused re-check confirmed both screens clean.)

Two presentation-level fixes shipped under this packet's "only where a critique honestly
fails" rule:

- **`bandLaneFall` and `careGleam` animated layout properties** (`bottom` / `left`), which
  breaks CLAUDE.md's transform-only performance law. Both converted to `translate` with
  start positions pinned, so the visuals are unchanged and 206 keyframes are now clean.
- **The wished butterfly never flew away.** A later "Animated Living Items" rule used
  `!important` to force an endless hover onto the wish-spawned butterfly, overriding P20's
  authored 3-second flutter-away. The wish spawn is now excluded; a *placed* butterfly still
  hovers.

**The world map — critique, then fixed (follow-up pass, stamp `run11-map-20260724`).**
The original critique: the map avoided P1's "menu pretending to be a map" anti-pattern (it
reads as an island with a river and a beach), but did **not** reach "looking at home from a
hilltop" — the landmarks were **emoji** inside plain white circles, closer to UI chips than
to places, the two interiors rendered as blank cream rectangles, and nothing moved.

That has now been addressed:
- `art.js` gained `renderAreaGlyph(key)` — a house-style sticker per area on a shared 24-box
  (meadow flower, riverside bridge, hilltop-and-sun, beach parasol, big top, slide, cottage,
  framed picture). The badges render those instead of emoji, which the art contract forbids
  as scene art. All eight glyphs are distinct.
- The two interiors became real little buildings (door, lit windows, a hung picture), and the
  scenery motifs were scaled back so they read as background texture *supporting* the badges
  rather than competing with them — and moved inside the phone-safe band, since the island's
  `slice` crop shows only x 27..73 at 390px.
- Quiet life: two drifting clouds and a shimmer on the river, transform/opacity only with a
  reduced-motion path. Evidence: 7 distinct cloud positions over 3.4s.
- Guarded by a new permanent suite, `r11map-art` (SVG stickers not emoji, eight distinct
  glyphs, the locked state still honest, cloud drift, reduced motion).

**Bonus: a real router race was found while shooting that evidence.** Screens are lazily
imported, so a second `go()` starting while the first was still awaiting its module let the
slower import mount ITS screen over the newer one — a fast tap during boot could land on the
wrong screen, and it is the likely cause of much of the board's `.hub` flakiness. `go()` now
takes a navigation ticket and a superseded navigation drops its result instead of painting it.

The remaining surfaces (Gallery, Band Room, Boo Roll, Blocks, Expedition trail, Disco floor,
Odd Boo Out, Flash Boos, Word Detective, collection) render cleanly and on-spec at all three
viewports.

---

## 6. Remaining known gaps for the next run

1. ~~The world map's art~~ — **DONE** in the follow-up pass (see §5). The remaining nicety
   would be a Boo actually wandering the island; the map now has clouds and river shimmer
   but no inhabitants.
2. **The four declared blocks** in `BLOCKED.md`, one of which (`r9p7-garnish`) needs a
   product ruling on haptics for wall contact.
3. **Expedition depth** — the trail, budgets, stars, hint, tiers and rewards are all built
   and tested, but the four puzzles have not been driven through a headless optimal-strategy
   solve at all four tiers with per-beat choreography frames. The engine guarantees behind
   them are proven (`r10p14`: exclusive covers 500/500, clue uniqueness 189/189).
4. **The Snaffle reveal scene** is a one-time card rather than the full authored animation.
5. **Guest top-up copy** — `L_EXP_GUESTS` exists and the picker tops up a thin party, but
   the VISITOR sash treatment is minimal.
6. **Git history still contains the retired names** (F-07). The working tree is clean and
   guarded; rewriting history was explicitly out of scope.
7. **Board stability** — this machine cannot finish a 104-suite serial run without suites
   timing out on `.hub` under accumulated load. Counts in this report come from chunked runs
   with direct re-runs of every failure, per CLAUDE.md's flake rule.
