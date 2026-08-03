# RUN21D — "Alive on Arrival" progress ledger

Branch: `run21d` (from main @ fec9641). Worktree: `Boo-town-run21d-wt`. Port 8011.

## Items
- [x] 1 — The Pulse Director
- [x] 2 — Requests you can find
- [x] 3 — Landmark dots
- [ ] 4 — Signposting the fair's best rooms
- [ ] 5 — The hider gets a fair chance

## Deviations
- **Item 1 — "rotating daily per area".** Pack said the 9s invitation rotates daily per area,
  then authored EXACTLY ONE string per area (and copy ships exactly as written, so there is
  nothing to rotate and nothing I am allowed to invent to rotate with). → What was true:
  seven areas, seven fixed lines. → What I did: one authored line per area, verbatim; the
  Playground uses the pack's own stated stand-in `Try the swings…` until RUN21E lands tag.
  If a later pack wants rotation it must author the extra lines.

- **Item 3 — "tapping dot 4 in the funfair lands the bandstand in view".** Pack said four
  dots at the four screen centres (12.5/37.5/62.5/87.5%) AND that dot 4 lands the bandstand.
  → What was true: `BANDSTAND_X` is 0.68, which sits inside screen 3 (0.50–0.75), so a dot
  panning to 0.875 shows the helter-skelter and never hands the music over — the two halves
  of the spec cannot both hold with the fair as built. → What I did: kept the four screen
  centres for all 23 other dots and gave the funfair's fourth dot a single documented
  target override, `BANDSTAND_X`. Its label is then true, the ACCEPT passes (bandstand
  centred ±20%, `zoneMusic() === 'band'`), and the filled-dot rule — nearest dot target to
  the view centre, derived from scrollX — stays coherent on all four funfair screens
  (asserted). Moving the bandstand instead would have broken band/funfair layout contracts
  well outside this pack.
- **Item 3 — "ink at 35%".** Pack specified the unfilled pip as ink (#2A1B4E) at 35%.
  → What was true: the dot strip sits on the app's own dark chrome (--sky-deep #1E1550), so
  ink at 35% is dark-on-dark and literally invisible — photographed at 390x844 before the
  fix. → What I did: kept the pack's 35% dimness and moved the colour to the card
  (#FFF8F0) at 35%, which measures 3.0:1 against --sky-deep (the non-text contrast floor)
  and still reads as "not this one". Filled = pink, 12px, ≥44px hit target, all as specced.

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
- **Bug found and fixed while proving item 2's ACCEPT:** the Pulse's own pan could yank the
  camera back off a target the child had just asked to see with "Show me" (or had dragged
  to), because both wrote scrollX and the later one won. town.js now carries
  `cameraClaimed`, set by every deliberate camera move she makes (drag, "Show me", and from
  item 3 the landmark dots / item 4 the fair signs); the Pulse never pans once it is set.
  Same principle as reveals winning.
- The map 💭 chip folds the Boo House's three room storage keys into the one `boohouse`
  badge (`HOUSE_ROOM_KEYS`). A future pack adding room-level map entries must revisit that.
