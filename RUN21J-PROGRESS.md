# RUN21J — "Today in Boo Town" — progress ledger

Branch `run21j` · worktree `..\Boo-town-run21j-wt` · port **8048** · started 2026-08-10.
Pack: `TONIGHT-2026-08-10/RUN21J-DAILY/PACK.md` · governed by GOVERNANCE-TONIGHT.md.

## Save version claim — READ THIS AT MERGE TIME

**This branch claims save VERSION 25** (main + run21f held 24 at branch time).
**Tomorrow's merge may renumber this step against run21e's claim** — if run21e also
claimed 25, whichever merges second renumbers to 26. The step is append-only and
purely additive (one `daily` field whose default IS the migration), so renumbering
is mechanical: bump the number in state.js's header note and in the
r8p1-migrations pin. Nothing else references the number.

## State — BUILD COMPLETE, gate green

- [x] Worktree + branch + port 8048 serving
- [x] Read: governance, lane brief, pack, CLAUDE.md, state.js header, PICK-UP-HERE, BLOCKED
- [x] Scout: hook seams + catalogue pool (two parallel scouts)
- [x] `data/daily.js` (pool + copy) · `js/daily.js` (day logic, doings, pick, parcel, card)
- [x] `sw.js` ASSETS[] — both files, in commit `c899b09`, the SAME commit that created them
- [x] Save v25 + r8p1 pin
- [x] Hooks: results seam / town mount / care completion
- [x] Hub card (a card, not a ninth door — 5 primary buttons at phone width)
- [x] Meadow parcel spawn + claim + ceremony reveal (new `grant` adapter)
- [x] guideLines `L_DAILY_DONE` / `L_DAILY_OPEN`, verbatim
- [x] `tests/r21j-daily.mjs` — six ACCEPTs + no-guilt guard + reachability (37.5s)
- [x] Gate: affected + core, all green (table below)
- [x] Staged What's New (placeholder version until the merge stamps it)
- [x] Delight self-critique (below)

## Commits on `run21j`

| | |
|---|---|
| `c899b09` | data/daily.js + js/daily.js + **sw.js ASSETS in the same commit** |
| `29044b2` | save v25 (one additive `daily` field) + r8p1 pin |
| `cefda97` | the three hooks, ceremony grant adapter, L_DAILY_* lines, hub card, styles |
| `ef0b4cb` | tests/r21j-daily.mjs — the six ACCEPTs |
| `178b413` | r12s1-routes fixtures for the ceremony's new params |
| `835067c` | staged What's New |
| `f63006b` | parcel reachability at three viewports; corrected seed flags |
| `6c641e6` | pin the re-render path (exactly one parcel survives a layout) |
| `cc6c6b4` | pin single-payout + stale-day safety (both recycle-property bugs) |
| `fbe3cc2` | ledger: DEVIATE-with-proof, standing guards |
| `ad235aa` | gate table: the one boot-timeout flake, recorded and cleared |
| `af02d51` | **precache js/playjournal.js** — pre-existing OFFLINE LAW gap (own commit) |

Final confirmation run after the sw.js change: `r21j-daily` 44s PASS · `r8p1-migrations` 1s
PASS · `m3-pwa` 3s PASS · `r18a-copyguard` 14s PASS.

## What was built, at the seams the pack named

| Doing | Seam | Where |
|---|---|---|
| `Play any game` | the single results crediting path | [js/results.js:99](js/results.js:99) — beside `noteQuest`/`noteRequest` |
| `Say hello somewhere new` | town.js's mount, after layout | [js/town.js:868](js/town.js:868) — `READONLY`-guarded |
| `Look after a Boo` | care.js's `complete()` | [js/care.js:702](js/care.js:702) — after `addBond` |

The parcel is a **derived** actor (like the dusk visitor), redrawn from save state by
`renderScenery` — never a placement. It uses the placement grammar for its position
(`PARCEL_SPOT` x=0.15, ground row 2), so it stands on the same ground line as any placed
item and is on camera at default scroll on all three viewports.

## Gate — affected suites + the five-suite core

Served from the worktree on **8048**. Board law: affected + core, no full board.

| Suite | Why | Wall | Result |
|---|---|---|---|
| `r21j-daily` | this run's ACCEPTs + guards + critic pins | 87.3s (178 ✓) | **PASS** |
| `r8p1-migrations` | core · save v25 | 0.1s | **PASS** |
| `r12s1-routes` | core · new ceremony params | 122s | **PASS** (294 ✓) |
| `m3-pwa` | core · sw ASSETS | 3s | **PASS** |
| `r12s4-contrast` | core · new card + parcel + banner fix | 143s → 139s | **PASS** ×2 |
| `r18a-copyguard` | core · new authored copy | 15s | **PASS** |
| `p2-rewards` | results.js changed | 9s | **PASS** |
| `r4p3-rewards` | results.js changed | 109s | **PASS** |
| `r12s5-ceremony` | ceremony.js changed | 7s ✓ / 9s ✗ → 10s ✓ | **PASS** (1 flake) |
| `r10p12-care` | care.js changed | 11s | **PASS** |
| `r13t1-care-direct` | care.js changed | 186s | **PASS** |
| `r13t2-care-discovery` | care.js changed | 28s | **PASS** |
| `r5p4-town` | town.js changed | 19s | **PASS** |
| `p3-town` | town.js changed | 11s | **PASS** |
| `r6p1-town` | town.js changed | 27s | **PASS** |
| `r18d-hub-scroll` | hub.js changed · 8-button law | 11s | **PASS** |
| `r17x4-whatsnew` | whatsnew.js changed | 111s | **PASS** |
| `r12s13-a11y` | extra — a new interactive element | 27s ✗ → 94s ✓ | **PASS** (1 flake) |

**18 suites, ~16 minutes, zero real failures.** No full board (board law). No walk (Lanes 1
and 5 own tonight's two).

**The one flake, recorded rather than hidden.** `r12s13-a11y` failed its first run on a
`waitForFunction(() => window.BooTown)` **boot timeout** in its `open()` helper, on the
second iteration of a two-route loop (`town` with `openWishWell`; the `detective` iteration
before it passed). That is precisely the flake class PICK-UP-HERE names — *"frame-evidence
suites are the flaky ones, plus `.hub` boot timeouts"* — it is not an assertion failure, and
the app under test never reported an error. Board law allows ONE serial re-run to confirm:
it passed clean at 94s, all sections including its own OFFLINE-LAW check. Moved on, as the
law directs. Note this suite is **not** in the pack's gate list — `r12s4-contrast` is the
core's tap-target/contrast slot and passed first time; I ran this one as extra assurance
because the feature adds a new interactive element.

### What the gate actually caught

1. **`r12s1-routes` is a real guard, not a formality.** Its param-coverage check failed on
   `grant` and `shiny` the moment I added them to ceremony.js: every param a screen reads
   from source must be *driven* by a fixture. Fixed by adding two fixtures (a plain item
   and a shiny Boo), which is exactly the coverage it was asking for.
2. **Three of my own assertions were wrong, in the same way.** The parcel's row and x
   asserted against `window.innerWidth/Height`, but the town viewport is *shorter and
   narrower* than the window (587×1008 inside a 768×1024 window). The product was correct
   the whole time. Now measured against `.t-viewport`, which is what town.js itself uses.
   **Worth knowing for any future town geometry assertion — this trap is easy to fall into.**
3. **ACCEPT 5 was passing vacuously.** `after.boxes >= before.boxes` read `0 → 0` and
   passed while proving nothing: the ceremony *consumes* the box it was granted. Replaced
   with an assertion on what came OUT (a new item, an extra copy, or duplicate stardust)
   plus a balance check that the counter returns to where it started.
4. **My seed flags were wrong.** `seen.tourDone` is not a real flag — it is `welcomeTour` —
   so every early screenshot and the phone-width assertion were taken with the onboarding
   tour stacked above the card. Corrected; the card is now measured where a returning
   child actually sees it.

## DECISION blocks

- DECISION: The parcel is a TRANSIENT actor derived from save state (like the dusk
  visitor), positioned with the placement grammar (PARCEL_SPOT x=0.15, row 2), never an
  entry in `town.areas`. · WHY: it is not an owned item; a non-catalogue id inside
  placements would break every renderer/migration that walks them, and "exists whenever
  all-done && unclaimed" is exactly what derived rendering gives — renderScenery redraws
  it from state on every layout, so it can never leak or desync. · REVERSIBLE: swap
  renderDailyParcel for a placement write; the claim path is one function.
- DECISION: The pack's "star bundle" for an exhausted pool is implemented as the FREE BOX
  grant (`boxes += 1` → ceremony). · WHY: the pack's own words are "reuse the chest reward
  path from booquest's `chest` node", and that path grants a box, not stars — there is no
  legal star-grant API outside results.js (RUN5 C0 crediting invariant, enforced by a
  dev-mode throw). A box is also the better gift for a completionist: it can still hold
  unowned catalogue items, and duplicates already pay stardust. · REVERSIBLE: swap the
  three lines in claimParcel for any future sanctioned star-grant.
- DECISION: Two shiny pool variants (boo_comet, boo_gigi), Boos only. · WHY: the pack
  allows shinies only if granting by id is already supported — it is (`grantItem` +
  `addShinyCopy`, the exact pairing rewards.js uses); every shiny READ site is Boo-gated,
  so shiny deco would be invisible. · REVERSIBLE: entries are data.
- DECISION: claimParcel grants BEFORE navigating to the ceremony; the ceremony's new
  `grant` adapter only builds the reveal and never grants. · WHY: a closed tablet
  mid-reveal must not lose the item (saves-never-lost, protected core §4). The chest/box
  paths already work this way ("the box is already opened+applied at mount"). ·
  REVERSIBLE: move the grant into the adapter.
- DECISION: grantMode never chains into pending boxes after the reveal, and the ceremony
  hint says "parcel" in grant mode. · WHY: the parcel was one wrapped thing; auto-opening
  an unrelated box she didn't ask for muddles the moment. · REVERSIBLE: one guard.
- DECISION: Partial rounds tick `play`. · WHY: the pack's seam is "any results/win flow
  firing", and results.js's own philosophy is that a round left early still pays for the
  work done — a doing that un-ticks on a wobbly day would be a guilt mechanic. ·
  REVERSIBLE: `if (!partial)` at one call site.
- DECISION: The first area entered today ticks `visit` (any area not yet visited today,
  the Meadow included). Gallery doesn't tick (own module, not town.js's mount — the seam
  the pack names). · WHY: authored text; trivially-completable is the gentle design. ·
  REVERSIBLE: filter the first area or hook gallerymuseum too.
- DECISION: Post-claim card line and pool-exhausted card line authored here (pack leaves
  copy open): `All done for today! Wasn’t that a lovely parcel? ✨` and `All done for
  today! You've collected every parcel treasure — so today's parcel has a surprise box
  inside. It's waiting in the Meadow 🎁`. No yesterday/tomorrow references anywhere. ·
  REVERSIBLE: data/daily.js strings.
- DECISION: Pool curation (28 entries, commented in data/daily.js): box-only ultras
  including all six costume sets + feet accessories (permanently unbuyable → strongest
  gift signal), the special shelf's three lesson-star items, rare items with verbs, three
  fx Boos + the two shinies. EXCLUDED: boo_dj and boo_twiglet (the game's two secrets
  stay the box economy's magic), all seasonal items (an out-of-season grant reads as a
  glitch), and everything auto-granted anywhere (verified against every inventory write
  site). · REVERSIBLE: data.
- DECISION: `grantItem`'s `opened += 1` side effect is kept for parcel grants. · WHY: it
  is the canonical direct-grant API (onboarding uses it), and the parcel IS an opened
  thing; a parallel grant function for one counter would violate engine-reuse. ·
  REVERSIBLE: inline the mutate without the counter.
- DECISION: The suite (and any probe) taps the parcel/gift with the evaluate-click
  pattern. · WHY: Playwright's actionability check never sees a perpetually wobbling
  button as "stable" — r12s5-ceremony/run12probe established the pattern; the real tap
  target is verified separately by elementFromPoint hit-test. · REVERSIBLE: test-side.

## INDEPENDENT REVIEW — a cold gate-verifier and a cold playtest critic

Both ran against the branch with fresh context; the critic played it cold without reading
this ledger. **Between them they found four real defects, two of them mine. All four are
fixed and pinned.** This is the single most valuable thing that happened tonight and it is
why the review step exists — every one of the four was invisible to me.

### The critic's four MUST-FIXes — all fixed

1. **The hub card went stale, and lied.** Boo Care opens as an overlay over a
   *still-mounted* hub, and `createTodayCard` ran once at mount. So she looked after a Boo,
   was told a parcel had arrived, closed the sheet — and the card underneath still said
   "Look after a Boo" unticked, with no "Show me!". The announcement and the signpost
   disagreed at the exact moment the signpost mattered.
   **Fix:** `tick()` now emits `bootown:dailytick` on any change and the card redraws
   itself in place; the listener drops itself once the node is detached, so it cannot leak
   across hub mounts. Pinned: complete a care action from the hub, close it, and the card
   must show the tick, the authored all-done copy, and the "Show me!".
2. **The moment was SILENT outside the Meadow.** `onDailyDone` returned early unless
   `AREA.key === 'meadow'`. Completing the third doing by walking into Riverside — and the
   Town button lands on the map, so five of the six unlocked areas take this path —
   produced nothing on screen at all. With voice off (the default) it was completely
   silent: a gift arrived and she was never told.
   **Fix:** the bubble now lands in whichever area she is standing in. In the Meadow it
   sits beside the parcel (`.at-parcel`, measured **43px above it**, tail pointing at it —
   it used to float in the sky ~200px away); elsewhere it is centred as a signpost, and the
   authored line already names the Meadow. Pinned across riverside, playground and meadow.
3. **My care note repeated the pack's authored line verbatim.** The heading I wrote,
   "All three doings done! 🎁", sat directly above `L_DAILY_DONE` — whose first variant
   opens with *exactly* those words. Half the time she read the same sentence twice, in the
   feature's headline moment.
   **Fix:** the heading is gone; a gift icon carries the moment and the authored line
   speaks for itself. Pinned by sampling the two-line pool six times.
4. **The reveal banner was unreadable — and this one was worse than reported.**
   `dropKind()` returns `boo | accessory | costume | furniture | town`, but the CSS styled
   `.type-deco`, **a value `dropKind` never returns**. So that rule was dead and three of
   the five kinds had no background at all: white text on the cream card, measured
   **1.05:1**. Digging further, `--pop` and `--zing` are *light*, so white-on-them was never
   AA either — `type-boo`, the most-shown reveal in the entire game, measured **2.37:1**.
   **Fix:** light pills take dark ink (the pattern `.shiny-banner` in this very file already
   uses); the dark pills were re-picked to clear the bar with room. Every kind now reads
   **5.42:1 – 7.97:1** against the AA large-text bar of 3:1 (20px bold uppercase). Pinned by
   computing the real ratio for every kind the Daily Pool can produce.
   *Pre-existing and NOT caused by this run* — but this feature routes 20 of its 28 pool
   items through those three kinds, which is how it finally surfaced.

### The verifier's findings — coverage gaps, all closed

It confirmed the copy **byte-identical** (it `od -c`'d the pack against the shipped strings
rather than eyeballing glyphs — em dash, U+2026 ellipsis, straight apostrophes, the 🎁
codepoint), the pool clean against every inventory write site, the seams correct and
READONLY-guarded, no listener leak, and 5 primary buttons at phone width. Its substantive
point was **coverage**: three shipped code paths that no test executed.

- `.result-daily-done` (the results-card note) — **now driven**, and asserted to render
  above the star meter as its own beat.
- The live `parcel-pop` and the arrival bubble — **now driven**; this is the *witnessing*
  half of the feature, and "working-but-dead is a FAIL" applies to it most of all.
- ACCEPT 3's recycle proof was near-tautological (`stillEligible` could not fail) and one
  assertion (`day === DAY || day === NEXT_DAY`) was a **no-op that passed on either value**.
  Replaced with a real **negative control**: owning a pool item must remove it, must move
  the day's pick, and must restore it when un-owned — proving the filter is real, not that
  the pool never filters.
- It also noted ACCEPT 1 simulates the spellboo round at the seam rather than playing it.
  I tried a full playthrough; it cost ~30s and would only prove that *one* game arrives.
  **DECISION:** replaced with a stronger, cheaper check — read all 15 game modules and
  require every one to route through `ctx.go('results')`, plus assert `results.js` calls
  `noteDailyPlay` exactly once. That is the actual claim behind hooking a single seam, and a
  game that ever grew its own ending now fails loudly instead of silently never ticking.

### Critic suggestions NOT taken, with reasons

- *"The doing rows look tappable and swallow a tap."* Fair, and I left them. The pack is
  explicit that the card is not a door; adding navigation would make it one, and restyling
  the rows to look inert is a visual-design call better made in daylight against the rest of
  the hub. Logged for POLISH, not improvised at 3am.
- *"Persist an unclaimed parcel through the date roll."* **Deliberately refused.** The
  parcel being derived from today's doings is exactly what makes the recycle mechanic
  bookkeeping-free, and persisting the *object* is the first step toward "open it now or
  lose it" — the precise instinct the feel gate exists to prevent. The item itself is never
  lost, which is the property that matters.
- *"Two daily three-task lists on one hub (this, and the pre-existing Quests)."* A real
  observation and a genuine design question, but merging two features is a pack-level
  decision, not an executor's. Raised for the morning report.
- *"Mark the Meadow on the town map while a parcel is due."* Good idea, out of scope
  tonight (worldmap.js is untouched by this run). Logged for POLISH.

## FOUND IN PASSING — an OFFLINE LAW violation on `main`, fixed here (one line)

**`js/playjournal.js` was not in `sw.js` ASSETS[], and `js/main.js` imports it STATICALLY.**
Pre-existing; NOT caused by this run. `BLOCKED.md` is gitignored and lives in the main tree
(which this lane must never touch), so the durable record is here.

*Repro (static, definitive):*
```
node -e "const fs=require('fs');const sw=fs.readFileSync('sw.js','utf8');
const seg=sw.slice(sw.indexOf('const ASSETS'),sw.indexOf('];',sw.indexOf('const ASSETS')));
const A=new Set([...seg.matchAll(/'([^']+)'/g)].map(m=>m[1]));
const walk=(d)=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(d+'/'+e.name):[d+'/'+e.name]);
console.log([...walk('js'),...walk('data')].filter(f=>f.endsWith('.js')).filter(f=>!A.has(f)));"
```
*Repro (empirical):* load `http://app.localhost:<port>/index.html` (plain `localhost`
unregisters the worker — the trick `m3-pwa` uses), wait for install, then enumerate
`caches`. Before the fix the real cache held **161 entries with `js/playjournal.js`
absent**; `js/daily.js` and `data/daily.js` were both present, so this run's own offline
obligation was already met.

*Provenance:* added by `5cc6569` "RUN21F-10B: play journal behind the QA flag". Absent from
`main`'s `sw.js` too (`git show main:sw.js | grep -c playjournal` → 0). Imported at
`js/main.js:13` (`noteScreen`) and `js/grownups.js:23` — so it is app-shell code, not a lazy
route.

*Why it had not bitten:* the fetch handler runtime-caches any same-origin GET it did not
precache ("defensive", `sw.js`). So a single online boot pulls it in and it works offline
thereafter. The exposure is a genuinely cold install that goes offline before the shell has
ever been fetched — which is exactly the case the OFFLINE LAW exists to cover.

- DECISION: **fixed it**, one additive line in `sw.js`, in its own commit. · WHY: CLAUDE.md
  states the offline law as absolute and I had positive proof of a violation in app-shell
  code; governance §1 retires parking, and the escalate-instead list (money/accounts,
  children's privacy, deleting a child-visible feature, unverifiable licence) does not cover
  it. The change is additive and cannot regress anything — worst case it precaches a file
  that would otherwise have been runtime-cached. I was already editing this exact list. ·
  REVERSIBLE: delete one line. If another lane fixed the same thing tonight the merge shows
  a duplicate line — drop either. · VERIFIED: every one of the 151 modules on disk is now
  precached, zero ASSETS entries point at a missing file, `m3-pwa` still PASS.

## DEVIATE-with-proof — three pack premises that had drifted

The lane brief's instruction is explicit: *"if a seam has drifted, DEVIATE-with-proof and
hook the true one."* Three of the pack's named seams do not exist as described. In each
case I hooked the true one and the deviation is small; none changes what gets built.

1. **"reuse the gift/box visual language the onboarding present uses (scout js/art.js for
   the box render)".** There is no box/gift render in `js/art.js` — no `renderBox`,
   `renderGift`, `present` or `parcel` anywhere in that file. And **onboarding has no
   present**: `js/onboarding.js` goes splash → name → age → creator → three bubbles →
   `firstPickStep()`, which renders three *Boo* cards and grants on tap. The gift visual
   language that genuinely exists is `giftSVG(size)` in `js/ui.js:198` (the hub's box
   button and the results screen's box flourish) and `bigGift()` in `js/ceremony.js:197`
   (the ceremony's tappable box — the same anatomy at 200×200).
   **What I did:** the Meadow parcel uses `giftSVG` from `ui.js` — the same present art
   the hub already shows her — and the ceremony it opens into uses `bigGift()` unchanged.
   That is the reuse the pack was asking for, at the address where the art actually lives.
   Nothing was redrawn.
2. **"the parcel contains a star bundle instead (reuse the chest reward path from
   booquest's `chest` node)".** `runChest()` at `js/booquest.js:201` grants **a box**, not
   stars: `sfx.fanfare()` · `st.boxes += 1` · `ctx.go('ceremony')`. There is no legal
   star-granting path outside `js/results.js` at all — the RUN5 C0 crediting invariant is
   enforced by a dev-mode throwing assertion, and booquest's own star payouts route
   through `ctx.go('results', …)` with a comment saying exactly that.
   **What I did:** followed the *named seam* rather than the word "star", so the exhausted
   pool grants a free box through those same three lines. Recorded as a DECISION above.
3. **The ceremony has no "reveal this specific item" entry point.** `ctx.go('ceremony')`
   opens whatever is in `state.boxes`; the only precedent for adapting it is
   `chestResult()`. **What I did:** added a `grantResult()` adapter directly beside it,
   in the same shape, gated on `params.grant`. `r12s1-routes` immediately demanded
   fixtures for the two new params — which is the guard working, and both are now driven.

## RULE CHANGED blocks

None. CLAUDE.md is untouched on this branch. Nothing in the pack or the build needed a
standing rule relaxed: the two governance relaxations already granted (real audio samples,
authored-content fidelity) are not this lane's territory, and every law this feature
touches — no-guilt, offline ASSETS, lossless saves, reachable targets, the 8-button hub,
reduced-motion paths — was satisfiable as written.

## The six ACCEPTs, evidenced

Every one is asserted in `tests/r21j-daily.mjs` and screenshotted to `_evidence/r21j/`
(gitignored — evidence, not source).

1. **Fresh save at day D.** Card shows three unticked doings and the authored sub-line;
   *looking at it writes nothing to the save*. A spellboo results round ticks `play` ONLY
   (visit and care stay false); entering riverside ticks `visit` and records the area; a
   completed care action ticks `care`. The parcel then EXISTS in the Meadow at feet
   535.1px against the row-2 ground line at 534.2px, x within 2px of 0.15 of the area
   width, fully on camera at default scroll, and the guide line fired **exactly once**
   (asserted against both authored `L_DAILY_DONE` variants).
   → `_evidence/r21j/card-fresh-{1024,768,390}.png`, `parcel-{1024,768,390}.png`
2. **Claiming.** Exactly ONE item granted — asserted as a set difference on inventory keys,
   and asserted to equal the deterministic pick. The reveal card flipped in, the guide said
   an authored `L_DAILY_OPEN` line, `delivered: true`, the parcel is gone, and
   `stars.total` is unchanged (no stars invented outside the results seam).
   → `_evidence/r21j/reveal-1024.png`
3. **Date rolls to D+1** (mid-session, no reload — as a tablet left open past midnight
   does). Card resets to three unticked with the fresh-day sub-line and no stale "Show
   me!". The hub's full `innerText` contains neither the old date nor
   yesterday/missed/streak/in-a-row. The unclaimed D item is **still in the eligible pool**,
   and forcing D's hash on the new day returns *the very same item* — proving nothing was
   consumed. The save carries at most one day and has no `streak`/`lastDay`/`missed` key.
4. **A pre-v25 save loads unchanged.** Migration half pinned in `r8p1-migrations`
   (byte-preserved placements, empty `daily`, idempotent, live same-day field round-trips).
   Live half here: a real v24 save boots, keeps stars/stardust/boxes/meter/inventory/
   nickname/bond/placement, gains an empty `daily`, sees three unticked doings, and ticks
   normally on its first round.
5. **Pool exhausted** (all 28 entries seeded owned, shinies included). Eligible pool is 0;
   the parcel holds a box; the card copy switches to the surprise-box wording and never
   frames a complete collection as an ending; claiming pays out something real and the
   ceremony names the prize.
6. **Reduced motion** (`reducedMotion: 'reduce'` context). The parcel still appears, at
   full size, with `animation-name: none`; the reveal still lands and still says what she
   won; exactly one item granted and `delivered: true` — the outcome is identical, only
   the motion is dropped.

Plus three standing guards beyond the six ACCEPTs:

- **No-guilt guard.** The feature's own source, with comments stripped (so the comments
  that *discuss* the ban cannot satisfy the check), contains no `streak`, no `yesterday`,
  no `missed`.
- **Reachability.** The parcel is 98×101px — well over the 56px law — on camera at default
  scroll, with all four probe points landing on the parcel itself, at 1024×768, 768×1024
  and 390×844. Four points rather than one because the Wish Well stands near the authored
  spot, so "is anything drawn over it" is a real question.
- **Single payout, and never on a stale day.** Both are recycle-property bugs rather than
  cosmetics, and both are now pinned:
  · three rapid taps (a child's real double-tap) grant exactly ONE item and one copy;
  · if midnight passes while an unclaimed parcel is still drawn, tapping it grants no
    item, no box, and never marks itself delivered — because that item now belongs to the
    pool again, and taking it would be taking it twice. The pool reads 28 eligible after.
- **Re-render.** A layout pass leaves exactly one parcel, still tappable, with the area's
  placed items rendered alongside it — a missing remove-first guard would show as two.

## Delight self-critique — the parcel moment

**Working-but-dead would be a FAIL here, so this is the part I pushed hardest on.**

*What it is now.* The third doing ticks wherever she happens to be. The guide speaks the
line immediately (tts *queues*, so it follows the screen's own line rather than cutting
it), and the same moment lands **visibly where she is standing**: a note inside the care
overlay if she was caring, a row on the results card if she had just finished a round.
A `bootown:dailydone` event goes out, so if she happens to be *in the Meadow* when it
completes, the parcel pops in live with a spring-scale and a speech bubble beside it —
she watches it arrive rather than finding it later. The hub card switches to "All done for
today! Your parcel is waiting in the Meadow 🎁" with a **"Show me!"** that goes straight
there. Tapping the parcel runs the full signature ceremony — three taps, confetti, the
gold ULTRA glow, the item's own art and blurb, an authored guide line, and the standard
"Put Star Projector Lamp somewhere?" follow-through that routes furniture to the Boo House
and everything else to the Meadow.

*Honest verdict: the moment is alive, and here is the specific reason I believe it.* Motion
(the parcel pops or wobbles), a line (spoken and written), and a place to look (a wrapped
present drawn 98px tall on the grass, next to the Wish Well, on camera at default scroll on
every viewport). It is not a toast and it is not silent state. The screenshots show a real
present with a bow, not a placeholder.

*Where it is weakest, honestly.*
- **The arrival is only *witnessed* if she is in the Meadow or on a screen I hooked.**
  Complete the third doing on, say, the collection screen and the announcement is the
  spoken line plus the hub card — real, but quieter than the live pop. I judged hooking
  every screen to be worse (a global overlay that can land mid-anything is exactly what
  RUN17 X4 and RUN18B Y16 deliberately avoided), so the compromise is: speak always,
  show live where she is, and always leave the card pointing at it.
- **The parcel sits close to the Wish Well.** They do not overlap and all four hit-test
  points land on the parcel, but on a save where the well took x≈0.12 the two are near
  neighbours. It reads as "a present left by the well" rather than a collision, and I
  verified it at all three viewports before accepting it.
- **The reveal's kind-banner ("FOR THE HOUSE!") renders slightly clipped at its top edge**
  in the 1024 screenshot. This is **pre-existing ceremony CSS**, identical for any
  furniture box drop, and not touched by this run — noted here because a reader of the
  evidence will see it and should know it is not new.

*What I would do next if this run continued:* give the parcel a one-second arrival sparkle
using the existing `sparkleAt` primitive (currently it pops but does not sparkle), and
consider a soft `rq-ring` on it when she arrives from "Show me!", reusing town.js's
existing `showMeTarget` ring rather than writing anything new.

## Wall times

Recorded per suite in the gate table above. Total gate ≈ 14 minutes across 17 suites.
Build + gate + evidence, end to end, in one unattended session.

## For the merge (read this first tomorrow)

1. **Save version.** This branch claims **25**. If `run21e` also claimed 25, whichever
   merges second renumbers: the number in `js/state.js`'s VERSION line, the v-note text,
   and the title of the `r8p1-migrations` pin. Nothing else references it — the pin's
   assertions are all shape, not number.
2. **`sw.js` ASSETS[].** Lanes 1 and 6 also appended tonight. Mine are the two lines
   `js/daily.js` and `data/daily.js` immediately before the `assets/` block. Mechanical.
3. **What's New.** The staged block's `version` is the placeholder `run21j-STAGED`. It
   MUST be changed to the real BUILD_STAMP at the deploy gate, or the hub will compare
   against a version that never ships.
4. **`js/hub.js`** is also touched by Lane 4 (Toddler door removal). Different regions —
   mine is one import and one seven-line block inside `hub-specials`.
5. **`data/guideLines.js`** — `L_DAILY_*` keys are this lane's alone, added at the top of
   `LINES`.
