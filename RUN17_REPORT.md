# RUN17 — HEART & HUMOUR: report

**Branch `run17-heart`, off `main` @ `90a1420`. Built in parallel with RUN16 on main.**
**NOT deployed. BUILD_STAMP deliberately NOT bumped — RUN16 owns main and the live URL.**
Ready to merge; expected conflicts only in `sw.js` ASSETS, `CLAUDE.md`, `js/hub.js`,
`js/results.js` and `css/styles.css`.

| Packet | Verdict | New suite | Evidence |
|---|---|---|---|
| X1 Joke Boos | DONE | `r17x1-jokes` (48 assertions) | `screenshots/run17/x1/` |
| X2 Kind words | DONE | `r17x2-encouragement` (28 assertions) | `screenshots/run17/x2/` |
| X3 Feelings Corner | DONE | `r17x3-feelings` @serial (79 assertions) | `screenshots/run17/x3/` |
| X4 What's New | DONE | `r17x4-whatsnew` (54 assertions) | `screenshots/run17/x4/` |
| X5 Gate + report | DONE | — | this file |

**Run-end gate (amended Board Law — affected suites only, NOT the full board):**
**49 suites, PASS=49 FAIL=0, parallel 292s + serial 159s = 7m 31s.**
The affected set = the suites covering my changed files, their genuine dependents, and the
fixed core (`r12s1-routes`, `r8p1-migrations`, `m3-pwa`, `r12s13-a11y`). Full list in
PROGRESS.md. No full board was run; the single programme-end sweep is the maintainer's.

---

## A note on the test environment (matters for RUN16 too)

Port 8000 was already held by the parallel RUN16 agent's server, bound on `0.0.0.0`. Both
servers being up made it possible to be served **the wrong tree**. Everything in this run
was re-run against an isolated server on **port 8017** (`BASE=http://127.0.0.1:8017`), and
X1 — which had first been run under the ambiguity — was re-verified there from scratch.
Recommend the same isolation for any future parallel run.

---

## X1 — the Joke Boo

**All 120 authored jokes implemented exactly.** The literals in `data/jokes.js` were
**generated mechanically from CONTENT_JOKES.md**, not retyped, so no apostrophe, em-dash or
capital could drift. `r17x1-jokes` re-parses the pack at test time and diffs it
character-for-character against the shipped data — a later "tidy" of a punchline is a
failing test, not a silent edit.

### Inventory

| Type | Jokes | Toddler subset (`simple:true`) |
|---|---|---|
| knock | 30 | 1 — knock 3 |
| animal | 30 | 3 — animal 1, 3, 24 |
| silly | 30 | 6 — silly 3, 6, 12, 18, 19, 20 |
| boo | 30 | 3 — boo 2, 4, 5 |
| **total** | **120** | **13**, exactly the pack's authored list |

### Content review checklist (X1 requires this recorded)

Every item verified against all 120 jokes; the machine-checkable ones are asserted in the
suite, the judgement ones were read line by line.

| Constraint | Verdict |
|---|---|
| 30 per type, four types, all typed | ✅ asserted |
| Kid-safe, groan-worthy, clean | ✅ read in full; the target is groan, not clever-clever |
| Nothing about appearance, weight, intelligence or family | ✅ none present |
| No toilet humour beyond the mildest | ✅ none present at all |
| No wordplay requiring adult knowledge | ✅ none; no real people, no brands (the one biscuit is deliberately altered — "Jammie Boo-dger") |
| UK English, UK vocabulary and pronunciation | ✅ pack was authored to this; transcription preserves it exactly |
| Puns must work SPOKEN as well as read | ✅ every joke is spoken through the guide path; "A fsh!" and "W-H-O" are the two that lean on the written form and both still land aloud |
| No repeats until the type's pool cycles | ✅ asserted over 200 draws per type |

### How it plays

Four type cards, then one Boo and one bubble. Setup jokes run **setup → an eyebrow beat →
punchline** on a rimshot (built from the existing drum pads, so all audio still routes
through `js/sfx.js`) and a giggle. Knock knock runs the authored **four-line exchange** on
her taps, so the rhythm is the one she'd use out loud. **The Interrupting Boo fires its
punchline early, over her own "Interrupting Boo wh—"** — that early beat is the joke, so it
lives in the data (`interrupt: true`) rather than as a special case buried in the view.

Toddler draws **only** the 13 simple jokes, is fully spoken, and advances itself on timers —
a three-year-old is never stranded waiting for a tap she doesn't know to make.

A heart keeps a joke in the Journal, where the sticker wears **the joke itself** rather than
an id. The stage is a free Meadow landmark on the Wish Well's exact terms: put it away and
it waits in Build → Landscape.

---

## X2 — kind words

40 X2a + 8 X2b lines implemented exactly and diffed against CONTENT_WARMTH.md.

### Encouragement rules audit

The policy lives in `js/encouragement.js` and is deliberately mean with itself, because a
guide that praises everything praises nothing.

| Rule | How it is enforced | Proof |
|---|---|---|
| ≤ 3 kind words per session | `SESSION_CAP`, checked before anything else | simulated week: 7 sessions, 21 lines, never >3 in one |
| Never two in a row | a `justSaid` latch declines the very next eligible moment | asserted over the whole simulated week |
| **Never after a round she aced** | enforced in the POLICY, not at the five call sites, so no caller can get it wrong | 3-star and 3-star-above-comfort both return silence |
| Once-only moments fire once | `returning` and `longSession` carry `once` | asserted per day across the week |
| Right pool for the moment | hard round → X2b, everything else → X2a | asserted |
| Routes through the guide speech path, obeys mutes | `speakMaybe` / `gb.sayText` | voice on → spoken; voice off → line still shown, nothing spoken |

### The effort-not-ability rule (X2 requires this recorded)

Machine-checked in the suite as well as read, because this is the one rule a well-meaning
future edit would break without noticing — "you're so clever!" feels kind.

| Check | Verdict |
|---|---|
| No line praises ability (clever/smart/genius/talented/gifted/a natural) | ✅ 0 of 48 |
| No line compares her to anyone | ✅ 0 of 48 |
| No line mentions a streak, a number or a score | ✅ 0 of 48 |
| No line implies she should have found it easy | ✅ 0 of 48 |
| Every X2b line names the difficulty honestly | ✅ 8 of 8 |
| All 48 lines distinct | ✅ |

The guards are proved to bite (they catch a planted offender) **and** proved not to
over-fire: "Not an easy round, that" is an X2b line doing exactly its job, and a naive
`/easy/` check condemned it. The check now matches the offending *claim*, not the word.

### The five moments

`results.js` supplies the hard round (above-comfort, 1 star), the first-ever try of a game,
and a completed Tricky Pile rescue. `hub.js` supplies coming back after a break and a long
session's pause.

**One thing worth flagging for future runs:** "returning after a break" reads
`seen.lastPlayDay`, **not** `save.lastPlayed`. `lastPlayed` is restamped by every
`commit()`, including the one the router makes while the app is still booting, so by the
time any screen could ask it, it always says "just now". Counting whole days from the day
key is also the truer reading of "2+ days" for a child.

---

## X3 — the Feelings Corner: the privacy proof

**G17 in one line: it names a feeling, offers ONE calm activity, and stops.**

### The privacy proof

The promise made in writing to a grown-up, in the toggle's own authored copy, is that
nothing chosen here is saved or shown to anyone **including them**. That is enforced three
ways, not one:

**1. Structurally.** `js/feelings.js` imports **no writer at all** — no `mutate`, no
`stampJournal`, no `noteQuest`, no `idb`, nothing from `rewards`, `quests` or `trophies`.
There is no code path from this screen to storage because the functions that could write
are not in the module. The only memory that exists is one module-level integer
(`heavyCount`) for the third-time rule, discarded when the tab closes.

**2. By schema absence.** There is **no save default and no migration** for the switch.
Absent means off, so the feature does not appear in a save at all until a grown-up turns it
on. (This also avoided a `state.js` VERSION bump — which would have been a needless merge
conflict with RUN16 — because `deepDefaults` preserves unknown keys.)

**3. By test.** `r17x3-feelings` walks **every path** — all six feelings, all three offers,
a full breathing cycle, past the third-time line — forces a `commit()`, then diffs
`localStorage` and **every IndexedDB object store** before and after.

| Guard assertion | Result |
|---|---|
| No feelings value reaches localStorage or IndexedDB | ✅ 0 leaks |
| The save has no top-level feelings field | ✅ none |
| The only feelings key in the entire save is the grown-up's own switch | ✅ `settings.feelingsCorner` |
| No feeling she chose appears anywhere in the save | ✅ none |
| **The guard detects a deliberately written feelings value** | ✅ **bites** |
| No grown-ups screen displays anything about what she chose | ✅ checked across every tab |

That last-but-one row is the one that makes the rest mean anything: a probe that silently
found nothing would look identical to a feature that stored nothing.

### Gating

| Save state | Chip | Route |
|---|---|---|
| no setting at all (default) | absent | refuses → hub |
| explicitly off | absent | refuses → hub |
| on, Toddler | absent | refuses → hub |
| on, Light | absent | refuses → hub |
| on, Medium | present | opens |
| on, Full | present | opens |

When it is off there is no chip, no greyed card and no explanation. **A corner she is not
meant to find has no door.**

### The script

All six feelings render their three beats with the authored words: the Boo mirrors the
feeling in **face and posture** (the face is a real drawn overlay — 11 SVG marks for `sad` —
not just a data attribute), one validating line, one optional offer. Breathing measured
against a real clock: **in 4053ms, hold 2008ms, out 6033ms, four cycles, then "There.
That's better."** — stoppable from its very first frame. "Sit a while" has no timer, no
meter, no progress and asks her nothing.

The third-time line appears on the third heavy feeling, **once**, appended to that feeling's
own line with nothing after it, and never again that session — verified across five heavy
choices. Six happy choices in a row never trigger it.

### Copy audit

Exactly **two** question marks exist in the whole flow, and both are authored: the opening
question and the third-time line. No advice, diagnosis, interpretation or score anywhere;
the toggle copy is gender-neutral throughout (they/them, no gendered pronoun) and states the
privacy promise plainly. All guards proved to bite.

---

## X4 — What's New

**21 entries across 5 version blocks**, newest first, latest `run17-heart-20260727`.

Every entry X4 names is present: the world map, the Boo House, the Gallery, Boo Care, the
funfair, the Band Room, the Disco Hall, the Expedition, Snaffle's Caper, the Wish Well, Odd
Boo Out, Flash Boos, Brain Bloom, safety copies — plus RUN13B's three rooms and dressed
town, RUN14's six Boo Roll courses and improved Boo Beat, RUN15's shop and Lesson Stars, and
RUN17's Joke Boo. **All 21 routes were walked for real in the browser and all 21 land.**

**The Feelings Corner is deliberately absent.** It is grown-up-gated, so advertising it to a
child would be both wrong under G17 and broken (the route would bounce to the hub).

**Manners:** one card, in the hub's own `specials` flow — asserted *not* a modal, with no
overlay present. It cannot appear mid-round structurally, because the hub is its only
caller; verified absent inside a game and on the results screen. Seen or dismissed once, it
never returns for that version, and that survives a reload.

**CLAUDE.md now carries the standing requirement**: appending a What's New block is part of
every future run's deploy gate, `version` equal to the BUILD_STAMP it ships under, every
route resolving, written for a child, and nothing grown-up-gated advertised.

### ⚠ RUN16 has no block, on purpose

`data/whatsnew.js` contains **no RUN16 entries**. RUN16 is in flight on main and I cannot
see its final feature set or its routes; inventing entries would have shipped "Show me!"
buttons that go nowhere — the exact failure this packet exists to prevent. Under the law
this packet just added, RUN16's block is RUN16's own deploy-gate obligation. **It must be
appended before the programme ships live.**

---

## Two real bugs found and fixed

1. **The results title took `--ink` on the night sky** (1.07:1 against a required 3:1) —
   caught by `r12s4-contrast`, fixed by taking the cream ink the rest of the app uses there.
2. **`markSeen()` left the What's New flag to the 2s autosave debounce**, so closing the
   tablet just after opening the card lost it and the same "new" things came back tomorrow.
   It commits immediately now — the same reasoning as the round-end commit in `results.js`
   (RUN11 Q9).

A third was a test-side defect worth recording: `p3-town` counted a *second* seeded Meadow
landmark as one of her own placements. The suite now names seeded landmarks in one place
rather than special-casing the Wish Well.

## One suite tagged @serial at birth

`r17x3-feelings` (~95s) is inside the 120s budget but measures a deliberately unhurried
48-second breathing rhythm against a real clock — precisely the cadence parallel load
starves. Tagged `@serial` and justified in `tests/board-serial-baseline.md` **before** it
had a chance to flake, rather than after.

---

## Every file touched (for the merge)

**New (9):** `data/jokes.js` · `js/jokeboo.js` · `js/encouragement.js` · `js/feelings.js` ·
`data/feelingsLines.js` · `js/whatsnew.js` · `data/whatsnew.js` · `RUN17_REPORT.md` ·
4 test suites (`tests/r17x1-jokes.mjs`, `r17x2-encouragement.mjs`, `r17x3-feelings.mjs`,
`r17x4-whatsnew.mjs`)

**Modified (12):**

| File | Change | Conflict risk with RUN16 |
|---|---|---|
| `sw.js` | +6 ASSETS entries. **BUILD_STAMP untouched.** | expected |
| `CLAUDE.md` | the standing What's New requirement in the deploy gate | expected |
| `js/hub.js` | X2 moment, X3 chip, X4 card, 3 imports | expected |
| `js/results.js` | X2 moments + `sayKindly`, 1 import | expected |
| `css/styles.css` | four appended blocks (X1–X4) + `.gu-note-off` | expected (all appended at EOF) |
| `js/main.js` | 2 registry lines (`jokeboo`, `feelings`) | low |
| `js/town.js` | Joke Boo Meadow seed + one `onTap` line | low |
| `js/art.js` | `jokestage` deco case + `renderFeelingFace` | low |
| `js/quests.js` | `joke_` Journal stamps + 1 import | low |
| `js/grownups.js` | the Feelings Corner card + 2 imports | low |
| `data/catalogue.js` | 1 landscape item (`deco_jokestage`, `free`) | low |
| `data/guideLines.js` | `encourageEffort` (40) + `encourageHardRound` (8) | low |
| `tests/p3-town.mjs` | seeded-landmark list | low |
| `tests/board-serial-baseline.md` | the @serial justification | low |

**Deliberately NOT touched:** `js/state.js` (no VERSION bump, no migration needed — the two
new save keys live under `settings` and `seen`, both of which `deepDefaults` preserves), and
`sw.js`'s `BUILD_STAMP`.
