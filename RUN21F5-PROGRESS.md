# RUN21F-5 — Save v24: placement ids + children ride with parents

Branch `run21f5`, worktree `Boo-town-run21f5-wt`, port 8081.
Only item in scope: F5. The only schema change in the whole RUN21 programme.

## Facts VERIFIED against the code before writing anything
- A placement is `{ zone, x, row, item }` + optional `scale`, `plane`, `y`, `parent`, `slot`,
  `at`. CONFIRMED. Two more optional fields the pack did not mention and which the migration
  must not disturb: `portraitBoo` (care.js best-friend portrait) and nothing else.
- `parent` IS a place-key string `zone:x:item` (`placeKey`, town.js:85). CONFIRMED.
  Same string shape as `itemKeyOf` (town.js:2702, socket occupancy) and `placementIdOf`
  (town.js:4206, sparkles) — three names for one identity, all of which move to the id.
- Sparkles are `{ placementIdOf(place) -> dayStamp }`. CONFIRMED (v22).
- The RUN21C undo stack snapshots whole placements with `JSON.parse(JSON.stringify(t))`, so it
  round-trips any field it is given — including `id` — as long as the matcher stops keying on
  position. It did key on position (`samePlacement`); now it prefers the id.
- `zone` on a placement is the STORAGE key, not the map area: a Kitchen placement's zone is
  `boohouse_kitchen`. So place-keys were globally unique across areas; ids are too.

## Steps
1. `js/state.js` — VERSION 23 -> 24 + ONE migration pass + `nextPlacementId()`. DONE.
2. `js/town.js` + `js/care.js` — id-based parenting, sockets, sparkles, undo; children ride
   with a moving parent; `groundOrphans` only on put-away. DONE.
3. Suites re-pointed, evidence. DONE.

## The migration, in order (js/state.js, after the v6 area backfill so every area key exists)
Shape-detected, not gated on a version number, so it self-heals a partial or hand-edited save
and `migrate(migrate(x))` is byte-identical.
1. `town.nextId` starts from the save's own value (or 1) and is then raised past the highest id
   already present, so a clobbered counter can never re-issue a live id.
2. Every placement in every area, in save order, that lacks a positive-integer `id` gets the
   next one. `town.nextId` is written back.
3. Per area (a child is only ever seated on something in its own area) a `placeKey -> first id`
   map is built and every string `parent` is rewritten to that id — FIRST match wins, which is
   exactly what the renderer's `.find(p => placeKey(p) === child.parent)` did. A `parent` that
   resolves to nothing is grounded (x from the dead key, `plane:'floor'`, `parent`/`slot`
   dropped, PLACEMENT KEPT) — the same thing `groundOrphans` does at the next render.
4. `sparkles` is re-keyed from place-keys to ids. An ambiguous key maps to EVERY placement it
   painted; a key that matches nothing is KEPT (it painted nothing before and still paints
   nothing, and applySparkles prunes it at the day rollover).

## Rich-save counts, before -> after
| save | placements | seats | sparkles |
|---|---|---|---|
| `bootown-qa-seed-code-for-alex.txt` (real v17 BOO1. code) | 5 -> 5 | 0 -> 0 | 0 -> 0 |
| v23 fixture with live seats, an orphan and an ambiguous sparkle key | 7 -> 7 | 2 -> 2 (+1 orphan grounded) | 2 -> 3 (the ambiguous key becomes two) |

Every non-`id` field of every placement in the rich save is byte-identical after the migration,
asserted field-by-field in `tests/r21f5-placementids.mjs`.

## Suites
- Affected + fixed core, `./_runall.sh --smoke` on port 8081: `r12s1-routes r12s4-contrast
  r8p1-migrations r18a-copyguard r19z6-objectmodel r19z5-nouns r10p13-slots r10p2-sockets
  r21a-reach-truth r21d-alive m3-pwa r21f5-placementids` — 12 suites, 426s, 11 PASS then
  `r21d-alive` PASS on the one serial re-run (its failure was
  `net::ERR_NO_BUFFER_SPACE` on `js/hub.js`, socket exhaustion from the parallel phase).
- Wider dependents (everything that creates or round-trips a placement): `r10p3-buildmode
  r10p4-interiors r10p20-wishwell r13t1-care-direct r13t3-house-rooms r4p3-rewards r5p4-town
  p3-town r19z2-requests r19z3-moments r20-wishlife r21f7-beds r12s7-sockets r13t4-furniture`
  — 18 suites, 362s, 16 PASS. `r10p4-interiors` PASS on a serial re-run (a `.town2` timeout
  under load). `r19z3-moments` FAILS — and fails IDENTICALLY (`eyes 456, pillow 460`) with
  `js/` and `tests/` checked out at the RUN21C tip `4eaa473`, so it is a PRE-EXISTING failure,
  not F5's. Both baseline and current logs are in `_evidence/run21f5/logs/`.

## Stale pins re-pointed (all re-pointed with EQUAL or greater rigour; none weakened)
- `tests/r8p1-migrations.mjs:96` — "the Lounge's placements are BYTE-IDENTICAL". v24 adds one
  field to every placement, so the literal claim is now a pin on the old schema. SPLIT into two
  claims that together say strictly more: every field EXCEPT `id` is byte-identical, AND the
  added ids are positive integers, unique, and all below `town.nextId`. A new per-era assertion
  block also demands that no placement is left holding a `zone:x:item` parent string, and a new
  `v23 -> v24` era block counts placements/seats/sparkles across the step.
- `tests/r19z6-objectmodel.mjs:94` — `mig.version === 23` -> `24`. Same claim ("this save
  reaches the current version"), re-pointed at the current version.
- `tests/r19z5-nouns.mjs:341` — `s.sparkles['meadow:0.2:deco_bench']`, a literal of the OLD key
  form, which would silently have stopped matching the bench. Now reads the bench's real id via
  `__townLife.idOf('deco_bench')` — stronger, because it can never go stale again.

## New file
`tests/r21f5-placementids.mjs` (~55s). Not a `js/` or `data/` file, so no `sw.js` ASSETS entry
is owed. BUILD_STAMP and `data/whatsnew.js` deliberately untouched (batched final deploy).

## DEVIATIONS
- `DEVIATION: pack says "migration on the RICH QA save preserves every placement, seat and
  sparkle" -> the rich QA save (`bootown-qa-seed-code-for-alex.txt`) is a **v17** code with 5
  placements, 0 seats and 0 sparkles: it pre-dates both features by five and six versions, so it
  cannot exercise either -> ran it anyway (5/0/0 in, 5/0/0 out, every non-id field byte-identical)
  AND built a v23 fixture that does have seats and sparkles, in `tests/r21f5-placementids.mjs`,
  and held THAT to the same before/after equality.`
- `DEVIATION: pack says "every child `parent` key is resolved ONCE against current placements" ->
  it is silent on a `parent` that resolves to NOTHING (a save whose table was removed by an older
  build, or a hand-edited one) -> the migration grounds it exactly as `groundOrphans` would on
  the very next render: x from the dead key, `plane:'floor'`, `parent`/`slot` dropped, placement
  KEPT. Doing it one frame earlier loses nothing and leaves no un-followable string in the save.`
- `DEVIATION: pack says "sockets/sparkle keys move to id-keyed" -> socket keys are not save data
  at all; `socketUse` / `benchCooldown` / `seatWaiters` are Maps in the town mount's closure ->
  moved them to the id anyway (via `itemKeyOf`), which is what stops a moved bench dropping the
  Boo sitting on it, and needs no migration because nothing is persisted.`
- `DEVIATION: an AMBIGUOUS sparkle place-key (two same-item placements at the same x in different
  depth rows share `zone:x:item`) painted BOTH items under v23 -> a naive rewrite to one id would
  silently stop sparkling one of them -> the stamp is copied to EVERY placement it painted.`

## BLOCKS
None.
