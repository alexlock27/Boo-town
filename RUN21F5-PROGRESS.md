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
1. `js/state.js` — VERSION 23 -> 24 + one migration pass + `nextPlacementId()`. DONE.
2. `js/town.js` + `js/care.js` — id-based parenting, sockets, sparkles, undo; children ride
   with a moving parent; `groundOrphans` only on put-away. DONE.
3. Suites re-pointed, evidence. DONE.

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
