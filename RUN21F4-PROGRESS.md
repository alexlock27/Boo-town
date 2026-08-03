# RUN21F4 — F4 "Documentation truth pass" progress ledger

Branch `run21f4`, cut from main at c25a7a2. Lane: README.md, CHANGELOG.md,
package.json, tests/run.mjs, and stale COMMENT text only. No logic, no
js/town.js logic, no shop/styles/data edits (RUN21B and RUN21C own those).

## Parts

- [ ] 1 — README: counts from live PROJECT_STATE.md; feature list refreshed
- [ ] 2 — CHANGELOG: one line per run 11 → current, sourced from RUN reports only
- [ ] 3 — Stale constant comments: town.js "20% of taps" → 45%, plus 3 more provable
- [ ] 4 — package.json `test` executes something real (drives the existing _runall.sh)

## Notes

- PROJECT_STATE.md must be regenerated at the END too: RUN21B/RUN21C add items
  while this runs, so every README number is re-checked against a fresh generation.
- CHANGELOG covers only what is on main: A, D, F1–F3, F7/F10. B and C are in
  flight and E is deferred — no lines for those.
