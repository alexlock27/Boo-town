# Pick up here — RUN21A implemented, FINAL GATE half-run (2 Aug 2026, session ended at usage cap)

Live build: still **run20d-20260731**. Branch **`run21a`** has all 17 items implemented,
committed per item, and pushed. **NOT MERGED — the gate is not passed yet** (pack lifeboat
rule). Branch **`run21f`** has F1–F3 done (tools/asset-preview.html, tools/anchor-tuner.html,
tools/gen-state.mjs + PROJECT_STATE.md), pushed, also unmerged. F4 deferred until after A–E.

Read `RUN21A-PROGRESS.md` (per-item status + 9 logged deviations) and `RUN21A-REPORT.md`
(draft: hints table done, gate sections PENDING) before anything else. The RUN21 packs live
in `RUN21-programme/` (now gitignored, private).

## Where the gate stands

A fresh clone for the gate exists at `..\Boo-town-run21a-gate` (node_modules is a junction
to the main repo's; serve it with `python _serve.py 8001`). 23 affected suites ran there at
3 lanes with `BASE=http://127.0.0.1:8001`; logs in `_gate_logs/` in the clone.

**Passed (13):** r8p1-migrations, m3-pwa, r18a-copyguard, r10p20-wishwell, r12s4-contrast,
r10p5-personalities, r19z2-requests, r18b-buy-confirm, r18b-shop-handoff, r19z6-objectmodel,
r18a-shop-chrome + (check `_summary.txt` for the last five: r6p2-funfair, r4p6-growth,
r13bt8-town-dressing, m3-grownups, r17x4-whatsnew — they were still finishing at handover).

**Failures, triaged:**
1. `r12s1-routes` — the suite DESIGNEDLY fails on new go('shop') param shapes (`from`,
   `fromRoom` from item 9). **Already fixed**: two fixtures added in tests/r12s1-routes.mjs
   (last commit). Pull into the clone and re-run — should pass.
2. `r7p1-funfair` — pins the OLD sequential-24h-builds behaviour on a multi-threshold save.
   RUN21A item 16 explicitly changed that (multi-cross → complete all + one combined
   reveal). **Update the pin to the new contract** (a SINGLE crossing still queues/builds —
   keep that half). Check the pack before "fixing" (PICK-UP lesson #5).
3. `r10p3-buildmode` — "Landscape tab hides outside build mode" pins what item 15 removed.
   **Update the pin** (Landscape now visible outdoors regardless of hammer).
4. `r20-wishlife` — "rocket launches at most ONCE per visit" pins the budget gate item 5
   removed. **Update the pin** (always launches once landed; in-flight guard only).
5. `r18b-wish-arrives` — **REAL INVESTIGATION NEEDED**: "Your wish came true!" verbatim line
   + its visibility assertions fail at both viewports. Suspect item 4's `drawer.close()` in
   wishwell submit() changed layout/timing around the arrival moment. Do NOT assume flake.
6. `r10p2-sockets` (guide-line + momentum/fling/ghost) and `r4p5-town` (seesaw frames) —
   likely 3-lane load flakes (frame-evidence class). **Serial re-run once each**; A/B a
   survivor against main in a worktree before believing it (recipe in the old PICK-UP notes:
   tests hardcode the port; keep one server per tree).

## Remaining gate work (in order)
1. Pull latest run21a into the gate clone; serial re-run the six above; fix/update per triage.
2. ACCEPT sweep per item (pack lists them; deviations/evidence notes in RUN21A-PROGRESS.md).
   `_probe_swing.mjs` at the clone root shows the harness pattern (seed save → go('town') →
   __townLife hooks). Item 14's evidence is DONE: `_evidence/run21a/swing-before/after-*.png`.
3. Pack's scripted regression sweep: place/move/put-away (Meadow + Kitchen), one new-word
   wish arrival, nap + wake, ride seat/unseat, 10 minutes walking all areas, window.onerror +
   unhandledrejection armed, zero console errors.
4. Fill RUN21A-REPORT.md gate sections.
5. Deploy gate: BUILD_STAMP + What's New are ALREADY COMMITTED (`run21a-20260802` — re-stamp
   to the actual merge date if it slips). Merge run21a → main (ff), push, fetch the live URL,
   confirm the stamp serves.
6. Then merge `run21f` (F1–F3) → regenerate PROJECT_STATE.md (`node tools/gen-state.mjs`) →
   update this file → proceed to **RUN21B** (needs F1/F2, now present). Dispatch order after
   B: C → D → E → F5+. F8/F9 remain SKIPPED-GATED (NEEDS_ALEX lines absent).

## Notes for the resuming session
- Boo-town is the repo; the RUN21 dispatch's Fix/Deviate/Block rules apply. Ultracode is
  fine WITHIN packs (scout fan-outs, verify sweeps) — packs stay serial (they all rewrite
  js/town.js; B needs A merged, etc.).
- `npm test` points at missing tests/run.mjs (F4 fixes it; noted, do not repair mid-run).
- The r10p2 "guide line names the area as full" failure ALSO deserves a real look if it
  survives serial: item 2's mount-time renderDecorateTab or item 15's drawer changes could
  plausibly interact with renderDrawer's empty-state timing.
- Old run20 notes (speech cluster, Toddler Stories decision — still AWAITING ALEX) were
  overwritten here; they live in git history of this file and in BLOCKED.md.
