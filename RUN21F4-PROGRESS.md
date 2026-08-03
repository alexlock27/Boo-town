# RUN21F4 — F4 "Documentation truth pass" progress ledger

Branch `run21f4`, cut from main at c25a7a2. Lane: README.md, CHANGELOG.md,
package.json, tests/run.mjs, and stale COMMENT text only. No logic, no
js/town.js logic, no shop/styles/data edits (RUN21B and RUN21C own those).

## Parts

- [x] 1 — README rewritten against live data (PROJECT_STATE.md + direct source counts)
- [x] 2 — CHANGELOG: one entry per run, 11 → 21F, sourced only from the RUN reports
- [x] 3 — Four provably stale comments corrected in js/town.js (comment text only)
- [x] 4 — `npm test` runs the real board: thin `tests/run.mjs` over the existing `_runall.sh`

## Evidence

`npm test -- --smoke` with `SMOKE_EXTRA="m3-pwa"` (the fixed core), BASE 8071:
**SUITES=5 WORKERS=4, parallel 143s + serial 1s = 144s, PASS=5 FAIL=0**, npm exit 0.
m3-pwa 3s · r8p1-migrations 0s · r18a-copyguard 15s · r12s1-routes 123s · r12s4-contrast 143s.
The runner started its own server on 8071 and stopped it again (port free afterwards).
`npm test` with no args was also started: it enumerated the full board and sharded 163
suites across 4 lanes + the `@serial` set, then was stopped deliberately — a full board
proves nothing about a documentation change and the board law forbids one mid-run.

## DEVIATIONS

1. Pack said the stale comment is at `town.js:3762` → it is at **town.js:4308** (the file has
   been rewritten by four packs since the pack was written) → located it by content and fixed
   it there.
2. Pack said "grep for three more stale-constant comments" → only **two** more were provable
   as *constant* claims; the third provable staleness was an out-of-date **enumeration**
   (the drawer tab list) → fixed all three, all with proof, and left every unprovable one alone.
3. Pack/dispatch said missing reports get the line `Run <n> — see RUN<n>-REPORT.md` → RUN18,
   RUN19 and RUN20 reports **do not exist anywhere in the repo** and the RUN18–20 brief bundle
   is gitignored, so that line would be a dangling reference in a PUBLIC document → used the
   pack's other sanctioned option (omit the itemisation) but kept the heading with one honest
   line, so 11 → current is still continuous.
4. There is no `RUN21F-REPORT.md`, so the Run 21F CHANGELOG entry is sourced from the tracked
   `RUN21F-PROGRESS.md` and `RUN21F2-PROGRESS.md` instead. No line was written for 21B, 21C
   (in flight) or 21E (deferred).
5. Dispatch expected RUN21B/RUN21C item additions to show up here and be re-counted at the end
   → they are on **separate branches**, so they cannot appear in this tree. Every README number
   is true of `run21f4` (= main @ c25a7a2). Re-run `node tools/gen-state.mjs` after B and C
   merge and re-check the catalogue line.
6. Adding `tests/run.mjs` put the runner **on its own board** (`_runall.sh` globs `tests/*.mjs`;
   it was sharded into lane_1 on the full-board run). Fixed `_runall.sh` to exclude exactly
   `tests/run.mjs`, and matched `tools/gen-state.mjs`'s exclusion list to the runner's — which
   also fixed a pre-existing off-by-one (it had never excluded `walk`).
7. `package.json`'s `serve` script said `python -m http.server 8000`, which `_serve.py`'s own
   docstring exists to replace → pointed it (and the README) at `python _serve.py 8000`.

## BLOCKED

None.

## Not merged

Branch pushed only. `sw.js` untouched — `tests/run.mjs` is a test file and the offline law
covers `js/` and `data/`. SAVE VERSION unchanged at 23. No child-facing copy changed, so no
What's New block and no BUILD_STAMP bump.
