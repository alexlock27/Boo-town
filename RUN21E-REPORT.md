# RUN21E — "Every Area a Job"

Branch `run21e`, cut from `main@22b8d40` (`run21f-20260804`). Ships under **`run21e-20260810`**.
Save stays at **VERSION 24** — every key this run adds is additive with a safe default, and
`deepDefaults()` backfills them on load. No migration step was written and none is needed.

**Not merged, not deployed.** The lane's standing override suspends "push to main / fetch the
live URL"; everything else in the deploy gate was done on the branch. The maintainer merges.

---

## What shipped

| Item | Title | Status |
|---|---|---|
| E1 | Riverside — jetty, float sailing, feedable ducks | **NOT BUILT** |
| E2 | Hilltop — train names the hour, kite rack, rain-day sails | **DONE** (17/17) |
| E3 | Beach — tide, shells, persistent sandcastle | **DONE** (19/19) |
| E4 | Playground — tag, ring-a-roses, the notice poster | **DONE** (15/15) |
| E5 | Meadow — the Notice Post, sharing the Today card | **DONE** (7/7) |
| E6 | Funfair — fair day | **DONE** (19/19) |
| E7 | Boo House — the pretend-night lamp | **DONE** (18/18) |
| E8 | Gallery — three pins + Featured Wall | **NOT BUILT** |
| E9 | Surfaces wave two | **NOT BUILT** |
| E10 | Outdoor hang points | **DONE for trees** (9/9); fence half deferred — DEV-47 |
| E11 | Adjacency delights | **DONE** (15/15) |
| E12 | Dead-prop amnesty | **DONE** (22/22) |
| E13 | Acknowledgement wave two | **DONE** (11/11) |
| E14 | Photo mode → postcards | **NOT BUILT** |
| E15 | Per-area growth tracks | **DONE** (20/20) |
| H1 | Verify `pumpWishIdles` re-pointed after the B/C merges | **VERIFIED** |
| H2 | `L_PATH_FULL` names a verb that exists | **DONE** |
| H3 | B1 — Boos visibly use her paths | **DONE — observation passes, entry restored** |
| H4 | RUN21D's debt: the playground invitation | **DONE** |
| F8 | Region leitmotifs | **NOT STARTED** |
| F9 | Twiggy's baked voice | **SKIPPED-GATED** — `NEEDS_ALEX.md` says `VOICE: still HELD` |

**Eleven of the fifteen pack items, and all four handover debts.** Four are not built: E1, E8,
E9 and E14. They are the four largest, and E9 and E14 in particular are new machinery rather than
new content — see "What is left, and what it will cost" below. Nothing is half-built: every item
marked DONE has its ACCEPT pinned in `tests/r21e-jobs.mjs`, and the four not built have no code in
the tree at all.

---

## The honest headline

**Every one of the twelve items I scouted came back DEVIATE**, continuing the programme's
unbroken record (13/13 before this run, 25/25 now). The pack was written before RUN21B/C/D/F
landed and is materially wrong about a premise, a mechanism or a constant in every single item.
The fifty deviations are catalogued in `RUN21E-PROGRESS.md`; the five that would have shipped a
visibly broken feature if followed literally:

1. **E6's box ceremony** consumes a box, rolls the prize at RANDOM, and exits to the hub — it
   cannot grant a named prize and would have walked the child out of her own party. The gift now
   arrives through the wish-arrival ceremony, in the fair, where she is standing.
2. **E4-C's notice poster** is drawn inside a layer that is `pointer-events:none` **by law**, so
   that placement taps fall through it. Tapping it was impossible. It has its own button now.
3. **E11's campfire scene** waits for "2 seated Boos" — Boos are never seated at a campfire;
   there is no socket. It triggers on the night circle role, which is the thing the pack describes.
4. **E15's headline** substituted literally reads "finished the A Little Cairn!" — broken English
   for 9 of the 15 authored names. Both templates strip the article.
5. **E2's kite rack** is authored as `land_kiterack`; no `land_*` id exists anywhere in the game,
   and every toybox/outdoor/stock behaviour keys off `kind` and `free`, not the prefix. All three
   new landscape items ship `deco_*` (DEC-8 — the run initially did both, which the gate check
   correctly called out as incoherent).

**Three defects were found by the tests rather than by reading**, and all three were real:
- **E3's tide line was invisible to a child.** Written to the hint bar, it was reliably replaced
  by the Pulse's own opening beat ("Squish, squish!") ~900ms after first paint. Moved to
  `sayInWorld`, the announced-moment primitive built for exactly this.
- **E5's Notice Post landed on top of her Boo.** 0.02 away in x on the next depth row — legal by
  the app's per-ROW spacing rule, and visually standing on her. `r4p6-growth` has quietly asserted
  that seeded landmarks keep their distance since RUN4 and was right to; the seeder now respects
  every row.
- **My own B1 observation measured the wrong ground.** The first fixture wrote path cells at
  `cy: 1` believing that meant depth row 1; `cy` indexes the fine paint grid, so it landed on row
  0 and the Boo could never have stood on the path being scored. A test that measures the wrong
  thing "proves" a feature either way. Row 1 is `cy: 11`.

---

## H3 / B1 — the approved decision, and its condition

The approval was explicitly conditional: prove it with a 90-second observation using RUN21C's own
three-way measurement, and restore the withdrawn What's New entry **only** if it passes.

RUN21C's path pull lived in the micro-wander, which is a minority of a Boo's time and is clamped
to 4.5% of the area — real in the numbers, invisible on screen. The approved fix puts the bias
where goals actually pick destinations: a new `pathwalk` goal, weighted as a peer of `approach`,
that walks to a run and then pads its whole length. RUN21C-5's own machinery is byte-identical.

`tests/r21e-b1-observe.mjs`, 90s per case, fresh context each, criteria written into the file
before the numbers came in:

| case | mean drift | samples standing ON the path |
|---|---:|---:|
| path-left | **−0.0268** | 34.6% |
| no path (control) | +0.0100 | 0.0% |
| path-right | **+0.0879** | 69.8% |

DIRECTION passes (left < control < right). OCCUPANCY passes (both ≥ 25%). **The entry is
restored**, under RUN21E's stamp rather than RUN21C's — where the behaviour that makes it true
actually ships. Evidence: `_evidence/run21e/b1-observation.json` and three frames.

---

## Testing

Affected suites plus the fixed core, per the Board Law. No full board.

**Green:** `r21e-jobs` (new, **179** assertions), `r12s1-routes`, `r8p1-migrations` (334),
`m3-pwa`, `r12s4-contrast`, `r18a-copyguard`, `r17x4-whatsnew` (122 after the final What's New pass; 116 before it), `r18a-buildstamp`,
`p3-town`, `r4p6-growth`, `r7p1-funfair`, `r6p2-funfair`, `r18d-funfair-scenery`, `r7p2-zones`,
`r10p1-worldmap`, `r13bt8-town-dressing`, `r10p4-interiors`, `r13t4-furniture`,
`r13bt7-room-identity`, `r13t3-house-rooms`, `r19z4-acknowledge`, `r19z6-objectmodel`,
`r21f5-placementids`, `r10p3-buildmode`, `r15v-economy`, `r10p2-sockets`, `r10p21-delights`.

Every figure above is recorded with its wall time in `RUN21E-PROGRESS.md`.

**Flakes, confirmed by one serial re-run each (board law):** `r20-wishlife` (a `.hub` boot
timeout — the handover names this mode) and `r19z5-nouns` (the shared hint bar had been
overwritten; E13 writes no hints, proved by running it with my `js/town.js` stashed and again
restored — both PASS).

**`ERR_NO_BUFFER_SPACE`** appears in `r21d-alive` and `r21a-reach-truth`. It is this box's socket
exhaustion with seven lanes serving at once — the lane brief names it by name. Both suites are
functionally clean: 209/209 and 73/73 assertions pass; only the console-health check fails.

**One pre-existing failure, proved not mine three ways** — `r19z3-moments`, a napping Boo's eyes
land 4px below the pillow's top edge. Identical on two runs, identical with my working files
stashed, and identical on a **pristine `main` checkout served on its own port**. Logged to
`BLOCKED.md` with the repro and a diagnosis. 36 other assertions in that suite pass.

**Stale pins re-pointed with equal rigour, never weakened** (all three are things this run
deliberately changed):
- `r21d-alive:125` — the playground invitation, which IS the H4 debt.
- `r21d-alive` `PROOF.zone` — gained the four new goal kinds; still proves a real goal running or
  a real prop on screen.
- `p3-town:17` `SEEDED_LANDMARKS` — gained `deco_noticepost`, so "what SHE put down" still
  excludes what the town gave her.

**Pre-merge walk:** `tests/walk.mjs` on port 8041. Two viewports completed clean before the first
attempt hit a shell timeout (tablet-landscape and tablet-portrait, 6 laps each of all 10 stops, 10
distinct places, 51 real-mouse handles, zero console/page errors). Re-run to completion; result in
`RUN21E-PROGRESS.md`.

---

## Save

`VERSION` stays **24**. Five additive keys with safe defaults, by two mechanisms — stated
precisely, because the first draft of this section claimed one mechanism for all of them and the
gate check was right to call it (GC-5). `deepDefaults()` can only backfill a key that exists in
`freshSave()`'s base:

| key | shape | why |
|---|---|---|
| `beach` | `{tideDay, tideSeen, shellsDay, shellsTaken[], castle}` | E3's tide news, the day's shells, the surviving castle (fractions, never pixels) |
| `seen.areaBusyAck` | `{areaKey: true}` | E13-1 is first-time-per-area, ever |
| `seen.noticePostSeeded`, `seen.fairPrizeDay` | flag, day key | E5's gift landmark; E6's one prize a day |
| `delights.newItemAckDay` | day key | E13-3's "once per day" across reloads |
| `townGrowth.catchup` | `[idx]` | E15's multi-cross rule, mirroring `funfair.catchup` |

`beach` and `townGrowth.catchup` are declared in `freshSave()` and are therefore genuinely
backfilled on every existing save. The three `seen.*` / `delights.*` keys are NOT — their parents
are empty objects — and they are safe because every read site guards (`(st.seen||{})`,
`(st.delights||{})`). `r8p1-migrations` passes 334 assertions with these present, and
`r21f5-placementids` confirms the v24 parent resolution stays byte-idempotent.

---

## What is left, and what it will cost

**E1 · Riverside.** Medium. Needs a `deco_jetty` catalogue+shop+art+`ACT_SIZE` entry with two
fishing sockets (the fish role is keyed by item id, so it is a data add), a render-time FLOAT
branch for boat/duck on the river band, and a duck-feed check in SCREEN space — the scenery ducks
are viewport-fixed CSS, not world objects, so "within 15% x" changes meaning with every pan. Note
the pack's ACCEPT says "bread near ducks": there is no bread. The FOOD class is exactly
cake/apple/pizza/banana/carrot/cheese/cookie.

**E8 · Gallery pins.** Medium. The Gallery has no cards of its own — a plinth tap navigates to
`collection.js`'s dialog, and postcards live in `gallery.js`'s viewer. Needs one shared pins
helper attached to both, a Featured Wall in `gallerymuseum.js` using NEW classes (`r18d-gallery`
asserts `plates.length === plinths`), and a top-level `gallery: { pins: [] }` in `freshSave()`.

**E9 · Surfaces wave two.** LARGE, and the largest single risk in the pack. Built-in parents are
NEW machinery: every current surface parent is a placement with an id, and two independent
mechanisms destroy any child whose parent is not one — `groundOrphans` on every render, and the
un-gated v24 parent resolution on every load (whose byte-idempotency `r21f5` pins). It needs a new
additive child field (`builtin:'lounge:mantel'`), not `t.parent`. Budget it as its own packet.

**E14 · Photo mode.** LARGEST. `composePostcard` renders a hard-coded expedition scene from state;
it takes no viewport and cannot composite one. There is no offline way to screenshot the live DOM
(SVG-with-foreignObject taints the canvas in Chromium and kills `toDataURL`). It needs a new
`composeTownPostcard(snapshot, date)` built from a snapshot `town.js` assembles, plus a kind-scoped
cap split in `studio.js` — the store's single cap is 20 across ALL artworks, so a 24-postcard cap
cannot exist inside it.

**F8 · Leitmotifs.** `LEITMOTIFS: APPROVED-TO-COMPOSE` is present, so composing five 8-bar
pentatonic loops and building `tools/leitmotif-audition.html` is in scope; SHIPPING them into the
game needs a second sign-off (`LEITMOTIFS: SIGNED-OFF`) after the maintainer has heard them. Worth
telling him first: F7's per-area ambient beds already give each area its own sound, so F8's
marginal gain is smaller than when the pack was written.

---

## The independent gate check

A read-only verifier cold-read the pack against the tree after the run was otherwise closed, and
returned **six findings — five of them mine, four of them real defects**. All six are fixed and
catalogued in `RUN21E-PROGRESS.md` under "Independent gate check":

- **E4-C shipped with 3 of the pack's 4 seeded poster states tested** — the fair-day and request
  lines were asserted nowhere. Now all five states are pinned with exact strings.
- **`Ding!` never shipped** and was not logged. It is now a visible pip, like `Mmm!`.
- **Two contradictory id conventions** in one run (`deco_kiterack` vs `land_lantern`), each with a
  deviation arguing the opposite of the other. Resolved to one convention.
- **The report claimed two suites green that the ledger never recorded**, plus three stale counts.
- **The save-mechanism claim was wrong for 4 of its 5 rows** — `deepDefaults()` cannot add a key
  its base lacks. Fixed both in the code (`catchup` now declared) and in the prose.
- **`js/playjournal.js` is missing from `sw.js` ASSETS[]** — inherited from main, not this run,
  but `js/main.js` imports it statically, so the app shell has a hard dependency on an unprecached
  module. Fixed here (DEC-7) because offline-first is protected core and this is the branch about
  to merge. **Worth checking the other in-flight branches for the same omission.**

## Rules changed tonight

**None.** Nothing in `CLAUDE.md` blocked a better experience for the children, so nothing there
was amended. Every decision recorded in `RUN21E-PROGRESS.md` sits inside the existing laws.

The governance file's already-relaxed clause on learning content was not needed either: this pack
adds no lessons, word lists or questions.
