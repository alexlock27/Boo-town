# RUN21F Progress

- [x] F1 — tools/asset-preview.html — DONE (commit RUN21F-1). Real renderBoo output pasted in renders at 60/120/220px on all three real backdrops (hexes read from css/styles.css: meadow .t-band.meadow, room-grey = kitchen wall, night .town2.night .t-skygrad); 60px silhouette toggle forces single-ink; 4 manual tickboxes + automated fill/stroke colour-literal readout. Evidence: scratchpad verify-f1.mjs, 18/18 PASS over file:// (offline), zero network requests.
- [x] F2 — tools/anchor-tuner.html — DONE (commit RUN21F-2). Drag + 0.005 arrow-nudge tuner in the exact data/sockets.js convention (x = frac of parent width from centre; yFrac = frac of parent height above the viewBox y=120 ground line, per town.js give()); Copy JSON emits paste-ready SOCKETS `{ x, row: 2, yFrac }` or SURFACE_SLOTS `{ x, surfaceY }`. Evidence: scratchpad verify-f2.mjs, 14/14 PASS — dragging onto the real bench SVG read back `{ x: -0.2, yFrac: -0.274 }` and `{ x: 0.2, yFrac: -0.274 }`, exact match to data/sockets.js deco_bench (tolerance ±0.01).
- [x] F3 — tools/gen-state.mjs — DONE (commit RUN21F-3). Writes PROJECT_STATE.md: build `run20d-20260731` + 158 assets, save v23, 54 screens, 8 areas, 149 catalogue items by kind, 60 wishes, 24 dressings, 204 suites (npm test does NOT resolve — tests/run.mjs missing), 7 RUN reports, gated-item harvest. Spot-checked by hand: screens 54, catalogue 149 (independent id-count), wishes 60, suites 204, dressings 24. Ran twice, byte-identical (no timestamps). CLAUDE.md deploy-gate bullet gained the regeneration line.
- [ ] F4 — CHANGELOG/README truth pass — DEFERRED until after packs A–E merge (so the truth pass has real reports and F3 numbers)
- [ ] F5 — save v24 — STRICTLY LAST
- [ ] F6
- [ ] F7
- [ ] F8 — SKIPPED-GATED: NEEDS_ALEX.md lacks `LEITMOTIFS: APPROVED-TO-COMPOSE`
- [ ] F9 — SKIPPED-GATED: lacks `VOICE: APPROVED · BUDGET: <MB>`
- [ ] F10

Notes:
- This branch (run21f) works items F1–F3 only; F4 deferred, F5 last, F8/F9 gated as above.
- tools/ pages are LOCAL-ONLY dev tooling: they stay OUT of sw.js ASSETS[] and are never linked from the app. sw.js is NOT touched this run.
