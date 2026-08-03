# RUN21D — "Alive on Arrival" progress ledger

Branch: `run21d` (from main @ fec9641). Worktree: `Boo-town-run21d-wt`. Port 8011.

## Items
- [x] 1 — The Pulse Director
- [ ] 2 — Requests you can find
- [ ] 3 — Landmark dots
- [ ] 4 — Signposting the fair's best rooms
- [ ] 5 — The hider gets a fair chance

## Deviations
- **Item 1 — "rotating daily per area".** Pack said the 9s invitation rotates daily per area,
  then authored EXACTLY ONE string per area (and copy ships exactly as written, so there is
  nothing to rotate and nothing I am allowed to invent to rotate with). → What was true:
  seven areas, seven fixed lines. → What I did: one authored line per area, verbatim; the
  Playground uses the pack's own stated stand-in `Try the swings…` until RUN21E lands tag.
  If a later pack wants rotation it must author the extra lines.

## Blocks
(none yet)

## Notes
- Item 1's five beats are a priority ladder with a per-day, per-area, SESSION-only seen-set
  (module scope in town.js, never the save), so a second visit the same day prefers a beat
  that area has not shown.
- The Pulse defers to RUN21A-8's reveal queue by reading `revealShowing`/`revealQueue.length`
  at the 900ms mark; when a ceremony is up the whole pulse (beat AND invitation) skips that
  mount. `__townLife.pulse().beat === 'skipped:reveal'` records it.
- New shared primitive `panToPx/panToFrac/fracOnScreen` in town.js — every RUN21D pan goes
  through it rather than each item growing its own easing loop.
