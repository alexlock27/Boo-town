# TESTFIX-AUG10 ledger — Lane 4, test debt (2026-08-10, overnight)

Branch `testfix-aug10` from main `22b8d40` · worktree `..\Boo-town-testfix-wt` · port 8044.
Brief: `TONIGHT-2026-08-10/LANE-BRIEFS/LANE4-TEST-DEBT.md` under `GOVERNANCE-TONIGHT.md`.
Never touched main. Never merged. Never deployed. Never ran the full board.

---

## RED — real child-facing faults found tonight

**NONE.** Every one of the fourteen failing/hanging suites in this lane was a **stale or
racy TEST**. Stated plainly because the brief asked for the opposite finding to be shouted:

- **The pre-reader's phonics is FINE.** `r16w2-blendit` passes; Blend It sounds every
  grapheme in order then the whole word. The Toddler door is sound.
- **The speech cluster is not four broken games.** All four suites pass individually.
- **The privacy promise HOLDS.** `r17x3-feelings` stores nothing a child chooses.
- **Boo Dash's bonk feedback, the Expedition's first-run state, the Joke Boo's build-mode
  behaviour and Echo Boos' slip handling are all correct** — in three of those cases the
  *test* was asserting a design the product had deliberately moved on from, and in the
  jokeboo case fixing the test PROVED the product right.

One thing genuinely worth a grown-up's eye is in **Deviations**, item D2 (a suite was
silently not testing what it claimed for ~2 weeks).

---

## Item 1 — the speech cluster, each suite verified individually

Verified individually first, exactly as instructed, **before** any fix — `r16w2-blendit`
first because a pre-reader reaches it through the Toddler door.

| Suite | Before (serial, alone) | After hardening | Verdict |
|---|---|---|---|
| `r16w2-blendit` | PASS 25.3s | PASS 21s | test-only race, latent |
| `r16w4-storyorder` | PASS 56.5s | PASS 55s | already correct (see below) |
| `r16w3-rhymetime` | PASS 26.7s | PASS 22s | test-only race, fixed |
| `r17x2-encouragement` | PASS 7.0s | PASS 4.5s | test-only race, fixed |

**Diagnosis.** The 31 Jul failures were the stub-then-assert-fast shape the handover
traced, surfacing under parallel lane load. I did **not** inherit the assumption that all
four shared it — each was read and run separately:

- **`r16w4-storyorder`'s "wrong panel's caption" is not a fault and never was.** It
  already installs its stub **pre-boot** via `addInitScript` (the correct pattern), and its
  read-back sync assertion passed **16/16 samples** tonight. Its own comment records that
  this pattern was written as the fix for `r16w3-rhymetime` — and was never back-ported.
- **`r16w2-blendit` and `r16w3-rhymetime` install the stub AFTER the round-start line has
  gone to the REAL engine.** In headless Chromium a real utterance may never fire `onend`,
  so `js/tts.js`'s `playing` stays occupied forever and every queued line — including the
  one the test clicks for — never reaches the stub. That is the "never read aloud" reading.
  Bare `speechSynthesis.cancel()` does **not** fix it: `tts.js` releases `playing` only
  inside `finish()`, which runs from the utterance's own `onend`/`onerror`.
  **Fix:** install the stub, then call app-level `tts.cancel()` (clears queue *and*
  `playing` synchronously, engine events or not), then reset the capture array. `blendit`
  additionally waits for `queueState()` to drain before snapshotting.
- **`r17x2-encouragement`** had three separate stopwatch races: a synchronous `slice()`
  taken before the stub's own 0ms `onend` macrotask could run, and two fixed 2600ms sleeps.
  Replaced with condition-waits. The absence assertion (a three-star round says nothing)
  now waits for a **positive** completion signal — stars rendered *and* tts queue empty —
  because a sleep-then-assert-absence would silently pass a regression that merely arrived
  late. It also now asserts nothing kind was *spoken*, not just that nothing was shown.

Per the brief, **the timing fixes stand on their own: no suite depends on the interrupt to
pass.** Verified by running all four before the product change went in.

### Approved product change — SAY-AGAIN interrupt

`NEEDS_ALEX.md` → `SAY-AGAIN: APPROVED`; rationale `DECISIONS.md` §3. A child pressing
"again" means **now**. Every child-facing re-speak control passes `interrupt: true` through
`speakMaybe`'s existing option — the Interrupting Boo's proven path, reused, not duplicated.
One line per game:

| File | Control | Note |
|---|---|---|
| `js/games/rhymetime.js` | 🔊 Say it again (word) · 🔊 Read it again (couplet) | both |
| `js/games/storyorder.js` | 🔊 Ask me again ×2 | picture mode + reporter mode |
| `js/games/spellboo.js` | 🔊 Hear it again · speaker icon | `say()` takes opts; bare mount call unchanged |
| `js/golden.js` | speaker icon | same split |
| `js/games/soundsorter.js` | 🔊 Say them again | button only; first-time naming pass + QA hook keep FIFO |
| `js/toddler.js` | the big "Again" speaker | all six `sayAgain` targets |
| `js/a11y.js` | `readAloudButton` | fixes beat + bubblepop + dash at once |
| `js/games/blendit.js` | 🔊 Blend it again | see below |

**First-time speech never interrupts anywhere** — only a repeat the child asked for does.

**`blendit` needed more than a flag, and this is the one worth reading.** Its replay is a
*chain* of per-grapheme utterances. Writing `interrupt: true` at that shared call site
would make every grapheme pre-empt, jumping the queue ahead of any other line. Worse:
`tts.js` fires `onend('interrupted')` on the line it cuts, and the chain's `onend` does not
inspect the reason — so a double-tap would cut tap 1's grapheme *and* advance its chain,
leaving two live chains interleaving cut-off fragments. Fixed with `interrupt: i === 0`
(only the tap pre-empts) plus a **generation token** that abandons a superseded chain.

**Not touched, deliberately:** `js/games/echoboos.js`'s "🔊 Hear it again" is a *melody*
replay, not speech; the grown-ups voice preview is not child-facing; `guide.js`'s `!!opts.interrupt`
coercion is left alone (booleans pass through unchanged, so `r17x1-jokes` stays out of the
blast radius).

**The interrupt is proved behaviourally, not just by green suites.** Because the suites must
pass with or without it, they cannot be the evidence that it works — so
`.tmp/interrupt-probe.mjs` proves it directly, using a stub that **never** fires `onend` so
a line stays stuck "playing" until something cuts it. Rhyme Time's "Say it again", pressed
while that line is stuck:

```
queue before: length=1 playing=3
queue after:  length=1 playing=4      ← the stuck line was CUT and the new one took over
```

The playing id advances and the queue does **not** grow. Queueing (the old behaviour) would
read `length=2 playing=3` — the child's request waiting behind a line that never ends. The
control case confirms the other half: a game mount produces no interrupt storm on its
first-time lines, and only the subsequent "Hear it again" press cuts through.

**Affected-suite gate, each run alone on 8044 — all PASS:** `r16w2-blendit` 21s ·
`r16w3-rhymetime` 22s · `r16w4-storyorder` 55s · `r17x2-encouragement` 4.5s ·
`r12s13-a11y` 92s · `r16w1-soundsorter` 22s · `r18a-soundsorter-modes` 80s ·
`r3p3-golden` 22s · `r12s9-toddler-replay` 60s · `r3p1-spellboo` 31s · `m2-spellboo` 23s ·
`r5p8-toddler` 21s · `r7p4-toddler` 31s.

---

## Item 2 — stale pins

- **`r18d-detective-abc` — no change needed, PASS 6.4s.** The `VERSION is 19` pin had
  already been re-pointed at the live `m.VERSION` constant in an earlier session; it
  compares `r.version === r.currentVersion` (24 vs 24) and cannot go stale again. Verified
  rather than assumed.
- **`p8-frames` — FIXED (test-only), PASS 33.9s** (was 1 FAIL).
  - *"nine lessons"*: already `>=` on main. No change needed.
  - *`fmt is not defined`*: gone — fixed at cause in `dash.js` `tapGate()` on 2026-07-30.
  - ***The heart: diagnosed properly, and it is NOT an ordering fault.*** RUN18B Y7
    (`be09d85`) removed the hearts **row** from every tier on purpose — "it counted down
    while the round carried on regardless, telling a child she was running out of something
    she was not". `shell.dimHeart()` survives as an internal counter with **no DOM**
    (`gameshell.js:150`), so `.heart-ic.on` matches nothing and the pre-tap reading of 0 was
    correct. `m2-feedboos` and `r18b-hearts-chest` already pin the row's absence. The suite
    now asserts the Y7 guarantee — the bonk is tracked **and** zero heart nodes are drawn.
    Strengthened, not weakened.
- **`r11audit` — FIXED (test-only), PASS 6.6s** (was 4 FAILs). Not an app fault. RUN18C C1
  (`1965e44`) rebuilt the party select: the short-party explanation moved out of the
  `.exp-guests` banner (whose "win some stars" copy died with that commit) into the
  `.exp-need` card — authored `NEED_MORE_BOOS` line, pack C6 verbatim, plus a "See my Boos"
  button. The suite was asserting pre-RUN18C selectors, so it read an empty string.
  Now asserts the current state **against the module constant** (so copy drift fails too)
  and is **strengthened**: it clicks the action and verifies it lands on the collection.
- **`r17x3-feelings` — FIXED (test-only), PASS 92.4s** (was 1 FAIL). **The privacy promise
  holds; there is no leak.** Probe (`.tmp/feelings-probe.mjs`) walked the suite's own path
  and named the hit: **`settings.calmMotion`** — RUN18B Y15's *"Calm motion"* grown-up
  switch, "calm" the adjective, nothing to do with the Feelings Corner. The suite seeds a
  v17 save; `migrate()`'s v18 step **adds** the field, the save blob therefore changes, and
  the raw-substring scan matched "calm" inside the switch **name**. Exactly the category as
  `feelingsCorner`, which the guard already excused. Fix: excise the two known grown-up
  switch tokens before the needle pass. Substring strength kept for everything else — a
  novel `feelingToday` key still trips it, and the deliberate-canary self-check still bites.
  All four precise save-walk assertions passed before and after.

---

## Item 3 — the never-complete suites

All eight now finish. **None was a product fault.**

| Suite | Before | After | Cause |
|---|---|---|---|
| `r9p5-echoboos` | 400s timeout | **PASS 20s**, 4→12 assertions | superseded design |
| `m2-full` | died 15s | **PASS 53s** ×3 | fixed sleep vs game lock |
| `r10p1-worldmap` | intermittent 30s timeout | **PASS ×4**, 77 checks, 28–45s | seed race + starved boot |
| `r18a-jokeboo-door` | FAIL | **PASS 34s** ×2, 43 checks | two stale tests |
| `r18b-flashboos` | listed intermittent | PASS 34s | already fine |
| `r4p9-delights` | listed 400s | PASS 15s | already fine |
| `r4p1-nav` | listed intermittent | PASS 12s | already fine |
| `r4p4-trophies` | listed intermittent | PASS 9s | already fine |

**`r9p5-echoboos`.** Asserted RUN9 C5's *automatic* mercy replay. RUN18B Y6 (`f1780e8`)
deliberately replaced it: a slip now **stops the play** and shows a card with two one-tap
ways on ("🔊 Hear it again" / "Keep going") so nothing is lit and nothing is counting while
she decides. The old assertions waited for an `inputPhase` that only a **tap** can now
produce — that wait, not any fault, is why the suite never finished. Rewritten against the
shipped design using the hooks Y6 shipped and **nothing had ever called**
(`offered` / `againUp` / `hearAgain` / `keepGoing`): the offer copy verbatim, both buttons,
Keep going resuming the same tune from the top, Hear it again replaying the same tune and
capping the round at two stars, the warm end at her best length, and Lightning's surviving
automatic mercy (where `mercyUsed` still legitimately lives).

**`m2-full`.** `playFeed` dropped food then slept a fixed 420ms. `feedboos` sets `locked`
during the drop arc, so the next iteration re-grabbed the **same** item; the tray emptied
with `idx` still 0 and results became unreachable. Measured with `.tmp/feed-probe.mjs`:
2 iterations then stuck → **all 12 items fed, 0 wrong drops** once it waits for
`!locked && idx advanced`. Three consecutive PASS at 52–53s.

**`r10p1-worldmap`** — two distinct causes, both fixed:
1. `goto → setItem → reload` booted the app **twice**. The first boot has no save at all,
   so it starts a brand-new player whose own autosave can land **after** the seed is
   written; the reload then restores that fresh-player save, the creator holds the screen
   and `.hub` never appears. Now seeded via `addInitScript` — one boot, save already there.
2. Under ~25 sequential contexts in one process a boot occasionally never paints. The app
   is **not** at fault: 40 sequential boots of this exact fixture in isolation all landed
   inside 6s (`.tmp/wm-probe.mjs`, 0 failures). So `bootSeeded` retries **once** in a clean
   context — recovery from a starved harness, not a mask over a product bug — and if the
   retry also fails it reports **what was on screen** and FAILS, instead of dying on a bare
   30s locator timeout with nothing to diagnose. Run 2 of 4 used the retry and said so.

**`r18a-jokeboo-door`** — two stale tests, and fixing the first **proved the product right**:
1. It entered build mode by hunting for a **🔨 button RUN21C-1 deleted** (the drawer carries
   that intent now; `r10p1-worldmap` pins the hammer's absence on every area). `if (b)
   b.click()` failed **silently**, so build mode was never entered and the assertion ran
   against a play-mode tap. Now uses `__townLife.toggleBuild()` — the alias RUN21C-1 kept
   for exactly this — and **asserts the state really changed**, so a silent no-op can never
   masquerade as a product fault again. With build mode genuinely on, the product behaves
   correctly: the tap does not leave the town.
2. Behind it (previously unreachable) the retro-award check snapshotted "did she see it"
   at `delay` ms, then compared it against state written **after a navigation round-trip** —
   so at delay=150 the hub's ~400ms timer could fire while she was demonstrably still on
   the hub, after the snapshot said "not seen". The product rule was right; the measurement
   was wrong. A `MutationObserver` armed before the hub paints now records whether the
   ceremony **ever** attached while the hub was the live screen — the condition the rule is
   actually about.

`tests/lib/board-durations.json` updated with **23 measured serial runtimes**. Nothing
touched exceeds the 120s budget; the only entries above it are the pre-existing
`r12s12-bubble-containment`, `r13t1-care-direct`, `r13t5-cosmetics`.

---

## Item 4 — the approved one-liner outside the lane

`NEEDS_ALEX.md` → `TODDLER-STORIES: APPROVED`; rationale `DECISIONS.md` §4.
**The Stories door is removed from the Toddler hub** — one entry in `js/hub.js`, nothing
else in that file. `params.toddler` does restrict Story Order (captions off, no peek), but
`playToddler()` serves the two shortest stories and **the shortest in `data/stories.js` is
four panels**; a 3–4 year old was asked to sequence four wordless pictures and consistently
could not. No setting shortens it and shorter content does not exist.

Story Order itself is untouched: it still opens for Medium from the main hub, and the
restricted **mode** is retained and still routes. Reversible in one line the day two
3-panel stories are authored. **Pinned** in `r7p4-toddler` (`and no Stories door`) so it
cannot come back without the content, and `r12s1-routes`' entry re-worded to say the mode
is kept while the door is gone. **No What's New entry** — nothing announces a removal.

Proved with the affected toddler-hub suites only: `r7p4-toddler` PASS 31s (new pin
asserting), `r5p8-toddler` PASS 21s, `r12s1-routes` PASS 120s. Additionally
`r19d-endtoend` PASS 80s — it drives `storyorder({ toddler: true })` directly and plays it
to results, so the restricted mode is proved still working, not merely still registered.

---

## End gate — affected suites + the five-suite core

Proportionate QA per `GOVERNANCE-TONIGHT.md` §3. **No full board.** Serial, on 8044.

**Core — all PASS:** `r12s1-routes` 120s · `r8p1-migrations` 1s · `m3-pwa` 2s ·
`r12s4-contrast` 142s (0 violations across all routes and viewports) · `r18a-copyguard` 15s.

**Offline law:** no new `js/` or `data/` file was created, so `sw.js` `ASSETS[]` needs no
change; `r12s13-a11y` independently re-confirms `js/a11y.js` is in the precache.

**Every suite touched or affected tonight, final state: PASS.** 27 suites, 0 failing.

---

## DECISIONS (governance §1 — decided, not parked)

**DECISION D1: rewrite `r9p5-echoboos` §4 against the shipped design rather than log it.**
*WHY:* the brief's own rule is that a suite asserting a design the product deliberately
moved past is a stale test, not a defect, and RUN18B Y6's commit message states the intent
plainly. Deleting the section would have lost real coverage; the rewrite instead exercises
the hooks Y6 shipped and nothing had ever called, taking the section from 4 assertions to
12 including the two-star cap and Lightning's surviving mercy. *REVERSIBLE:* the whole
section is one contiguous block in one test file; `git revert` restores the old wait.

**DECISION D2: `r10p1-worldmap` gets ONE bounded retry, not a widened timeout.**
*WHY:* widening a timeout hides a starved boot as slowness; a retry that **announces
itself** and, on second failure, reports what was on screen keeps the signal. Justified by
evidence rather than convenience: 40 isolated boots of the same fixture, 0 failures — so
the app is sound and the pressure is the harness's. BLOCKED.md's standing warning ("do not
widen the tolerance to make it green") is honoured: nothing green was made greener; a suite
that could not finish now finishes and still fails loudly if the app really breaks.
*REVERSIBLE:* `bootSeeded`'s loop bound is a single `attempt <= 2`.

**DECISION D3: pin the Toddler Stories removal in a test.**
*WHY:* the brief asked only for the one-line removal, but an un-pinned removal is one
merge from silently returning, and the reason it was removed (four-panel content) is not
visible from the hub code alone. The pin names the condition for restoring it.
*REVERSIBLE:* one assertion; delete it with the door when the stories exist.

**DECISION D4: strengthen `r11audit` beyond re-pointing it.**
*WHY:* the brief says "strengthen, never weaken". Re-pointing the selectors alone would
still not have proved the first-run state *works*, only that a node exists — so it now
compares against the exported constant (catching copy drift) and clicks through to the
collection. *REVERSIBLE:* test-only.

**No rules were changed.** Nothing in `CLAUDE.md` obstructed this lane. Nothing was
escalated: no item touched money, accounts, children's privacy (the one privacy assertion
was verified intact), wholesale feature removal beyond the pre-approved Toddler door, or an
unverifiable licence.

---

## Deviations / notes worth a grown-up's eye

- **D2 — a suite was silently not testing what it claimed, for about two weeks.**
  `r18a-jokeboo-door`'s build-mode check hunted for a 🔨 button and swallowed its own miss
  (`if (b) b.click()`), so from RUN21C-1's hammer deletion onward it exercised play mode
  while reporting on build mode. Not harmful here — the product turned out correct — but
  the *shape* is worth knowing: a test that locates a control by emoji and shrugs when it
  is gone reports success for a check it never made. I added an explicit
  `assert(softened === true)` so this instance cannot recur; a sweep for other
  `if (node) node.click()` patterns is a sensible follow-up but is outside this lane.
- **Two commit messages lost a backtick-quoted phrase** to shell substitution
  (`0077929`: "feedboos sets `locked` during the drop arc" and "`if (b) b.click()` failing
  silently"). Content is otherwise intact and the full wording is above; not force-pushed,
  because rewriting a pushed commit is worse than a two-word gap in a message.
- **`p8-frames`, `r11audit`, `r18d-detective-abc` had all drifted the same way**: a screen
  was rebuilt (Y7 hearts, RUN18C C1 picker, RUN21C-1 hammer) and its suite kept asserting
  the old selectors. The common cure is what several of these now do — assert against an
  **exported constant** or a **state hook** rather than a hard-coded selector or string.
- `BLOCKED.md` gained nothing tonight: no item in this lane resolved to a product fault.

## Files changed

`tests/` — `p8-frames`, `r11audit`, `r17x3-feelings`, `r16w2-blendit`, `r16w3-rhymetime`,
`r17x2-encouragement`, `r9p5-echoboos`, `m2-full`, `r10p1-worldmap`, `r18a-jokeboo-door`,
`r7p4-toddler`, `r12s1-routes`, `lib/board-durations.json`.
`js/` — the approved say-again change (`rhymetime`, `storyorder`, `spellboo`, `golden`,
`soundsorter`, `toddler`, `a11y`, `blendit`) and the approved one-line `hub.js` removal.
Nothing else. No `css/`, no `data/`, no `sw.js`.
