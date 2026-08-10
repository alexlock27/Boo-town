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

## State

- [x] Worktree + branch + port 8048 serving
- [x] Read: governance, lane brief, pack, CLAUDE.md, state.js header, PICK-UP-HERE, BLOCKED
- [ ] Scout report (seams + pool) — in flight
- [ ] data/daily.js (pool + copy)
- [ ] js/daily.js (day logic, doings, pick, parcel)
- [ ] sw.js ASSETS[] (same commit as the two files above)
- [ ] Save v25 + r8p1 pin
- [ ] Hooks: results seam / town mount / care completion
- [ ] Hub card
- [ ] Meadow parcel spawn + claim + reveal
- [ ] guideLines L_DAILY_*
- [ ] tests/r21j-daily.mjs (six ACCEPTs)
- [ ] Gate: r21j-daily + r8p1-migrations + p2-rewards + r4p3-rewards (if affected) + core
- [ ] Staged What's New
- [ ] Delight self-critique of the parcel moment

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

## RULE CHANGED blocks

None — CLAUDE.md untouched on this branch.

## Wall times

(recorded per suite)
