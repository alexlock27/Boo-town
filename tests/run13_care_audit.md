# RUN13 T0 — Boo Care audit (no fixes in this packet)

Driven live against `run12-s13-20260726` (working tree at `95f7a0b`) with
`tests/lib/run13_t0_probe.mjs` — a one-shot probe under `tests/lib/`, deliberately outside
the `tests/*.mjs` board glob so T0 moves no counters. Every care action was driven to
completion at **1024x768, 768x1024 and 390x844**. Raw record:
`screenshots/run13/t0/probe.json`; 6-frame motion samples spanning 3.1s per action per
viewport: `screenshots/run13/t0/<action>-<viewport>-f0..f5.png`.

Verdict counts: **2 G8 violations** (one severe), **4 dead-feel findings**, **0 G9
violations**, **1 missing action** (Bath, in T1 scope).

---

## How care is reached today

| Entry point | What it is | At 390x844 |
|---|---|---|
| Tap a placed Boo in town | A 4-icon arc (`.town-care-arc`), icons staggered 260ms, auto-fades after 4s | 4 buttons, 52x52px, icon **plus** a `<small>` label ("Treat / Brush / Teeth / Play"), no truncation |
| Collection card | `.collection-care-box` — hearts row, "N points to the next heart", 🍪 count, 4 labelled buttons | buttons 66px wide, labels present, no truncation |

Both entry points already carry visible labels under each icon. The **town arc shows the
treats count but no hearts row** (`showsHearts: 0` at all three viewports) — the collection
card shows both. That asymmetry is the gap T2 names.

---

## Action-by-action

### 1. Brush Teeth — **SEVERE G8 VIOLATION**, and the reason care reads as clunky

- **Interaction today:** two `<button class="care-scrub left|right">` slabs bearing the
  literal glyphs `←` and `→`. The child taps them in strict alternation; 6 alternating taps
  complete the action. The toothbrush in the middle is **decoration only** — it flips
  `.right` on the emoji, nothing more.
- **What it looks like:** at 1024x768 each arrow button measures **258 x 100px**; at 390x844
  **127 x 100px**. They are two large white slabs that flank — and at phone width visually
  crowd — the Boo. See `screenshots/run13/t0/teeth-390x844-f2.png`: the Boo's face is
  sandwiched between two arrows, and the arrows are the largest, brightest objects on the
  stage. The stage reads as a widget, not as a Boo.
- **What feedback it gives:** on a *correct* tap, foam advances a stage, 3 bubble particles,
  `sfx.tap()`, status text "N of 6 sparkly scrubs".
- **Where it fails:**
  - **G8, primary interaction.** Arrow/step controls are the *only* way to perform the
    action. The law forbids exactly this.
  - **A drag does nothing.** The probe dragged the toothbrush 120px across the mouth the way
    a child would: `scrubsFromRealDrag: 0` at all three viewports. The most natural gesture
    available produces no response of any kind.
  - **A wrong-side tap is a silent no-op.** `scrub()` returns early when
    `side !== expectedSide`: `scrubsAfterWrongSideTap: 0`, no sound, no wobble, no text. A
    three-year-old tapping the same arrow twice gets nothing back and cannot tell whether the
    app is broken. This is the "invisible progress" anti-pattern in its purest form.
  - **The instruction line spells out the widget** — "Tap left, right, left, right…" — copy
    that only exists because the interaction is not self-evident.
  - No progress ring; `firstFeedbackMs: null` across the 3.1s sample (nothing happens until
    a *correct* arrow tap lands).

### 2. Brush fur — partially compliant, but inert until touched

- **Interaction today:** a real drag. `.care-brush-pad` captures the pointer, the brush emoji
  follows the finger and rotates with travel direction, and each 60px of accumulated travel
  registers one stroke. **3 strokes complete.** The probe's synthetic 12-step drag produced
  `strokesFromRealDrag: 3` at all three viewports — the mechanic genuinely works.
- **What it looks like:** `screenshots/run13/t0/brush-1024x768-f3.png` — the brush sits parked
  at the far left of the stage, small, static, unlabelled, ~200px from the Boo. Nothing
  suggests it should be moved.
- **What feedback it gives:** per stroke — 12 sparkle particles at the stroke point, happy
  eyes, `sfx.ping(n)`, "N of 3 lovely brush strokes". On the third — a gleam sweep and a
  finish.
- **Where it fails (dead-feel, not G8):**
  - **No invitation.** `firstFeedbackMs: null` and `distinctBooClasses: 1` across the whole
    3.1s idle sample: the screen is completely still until the child guesses. The tool does
    not beckon, pulse, or sit near the Boo.
  - **No progress ring** — progress is a sentence, not a shape. `hasProgressRing: false` in
    source, `.care-ring` count 0 in the DOM.
  - The fur itself never visibly changes between strokes (only a one-off gleam at the end),
    so the child cannot see what the brushing *did*.

### 3. Feed — **G8 VIOLATION** (drag is not offered at all)

- **Interaction today:** tap the Treat button. The treat sprite is created *by the code* and
  animates a 600ms arc to the mouth. `treatDraggable: { animatedOnly: true }` — the flying
  treat has no pointer handlers; there is nothing to grab.
- **What feedback it gives:** good, once it starts — nom animation, 8 crumb particles, a
  floating heart, `sfx.pop()`, and personality flavour (cheeky's "vanished mid-flight!" fires
  correctly). Awards 4 points; consumes exactly one treat.
- **Where it fails:** the child's hand does nothing. Under G8 the physical act ("give her the
  biscuit") must be performed by moving the biscuit. `firstFeedbackMs: 1102–1134ms` at all
  three viewports — **the first thing the child sees back arrives over a second after the
  tap**, five times the 200ms feel goal, because the arc runs before the nom.

### 4. Play (peekaboo) — compliant but slow, and the tap target is invisible

- **Interaction today:** taps only, and legitimately so (peekaboo is a tapping game, not a
  physical manipulation — it is not a G8 violation). The Boo ducks behind a sofa and pops out
  at 1200 / 3800 / 6400ms; each pop is tappable via `.care-peek-target`.
- **What feedback it gives:** giggle, confetti, "Peekaboo! Found Inky! (n times)"; ends with
  a wave at 9200ms.
- **Where it fails (dead-feel):**
  - **9.2 seconds is a long time to hold a three-year-old**, and 1.2s of it is dead air
    before the first pop.
  - `.care-peek-target` is an unstyled transparent `<button>` — the child is told "Look!" but
    the thing to tap is not drawn.
  - Only one variant exists, so the second and third visit are identical.

### 5. Bath — **does not exist.** In scope for T1.

---

## Cross-cutting

| Finding | Evidence | Severity |
|---|---|---|
| No progress ring on any action | `hasProgressRing: false`; `.care-ring/.care-progress` count 0 in every action at every viewport | dead-feel (all 4) |
| Two arrow glyphs live in `js/care.js` | `text: '←'`, `text: '→'`; classes `care-scrub left`, `care-scrub right` | **G8** |
| Only 3 pointer handlers in the whole care module | all three are the brush pad | G8 root cause |
| Feed's first feedback is >1s | 1102 / 1110 / 1134ms | dead-feel |
| An action can end without a payoff | Teeth and Brush both idle indefinitely with zero response if the child never finds the right control | anti-pattern |
| Layout is stable at all three viewports | no truncation, no overflow, all controls in-viewport | OK |
| Zero page errors across 12 driven actions | `errors: []` in all 12 records | OK |

**G9 (nothing decays):** clean. A 30-simulated-day absence leaves care state byte-identical —
`before` and `after` both `{"bonds":{"boo_inky":30},"treats":5}`, `identical: true`. No
timer, hunger, dirt or sadness identifier exists in `js/care.js` or `data/care.js`. Bond is
add-only in `addBond()`. **Nothing in the current build needs fixing for G9; T1 must simply
not introduce anything.**

---

## What T1 must therefore change

1. Delete the `←`/`→` `.care-scrub` controls outright and rebuild Teeth as a drag with a
   mouth zone, 40px-per-scrub travel, 4 foam stages, 12-scrub target.
2. Give Feed a draggable treat (keeping tap-to-feed as the accessibility fallback) and move
   its first response inside 200ms.
3. Give every action a progress ring around the Boo, a tool that follows the finger, and a
   payoff that cannot be missed.
4. Add Bath.
5. Add a second Play variant (the ball).
6. Keep every `POINTS` value in `data/care.js` exactly as it is, and keep the 30-day-absence
   assertion green.
