# RUN21F Progress

- [ ] F1 — tools/asset-preview.html (local-only SVG preview: 60/120/220px on meadow-green / room-grey / night-navy, silhouette mode, checklist panel)
- [ ] F2 — tools/anchor-tuner.html (drag Boo onto parent, live {dxFrac, yFrac} readout, Copy JSON in sockets/SURFACE_SLOTS shape, arrow-key nudge 0.005)
- [ ] F3 — tools/gen-state.mjs (writes PROJECT_STATE.md: build id, save version, screens, areas, item counts, wishes, dressings, tests, RUN reports, BLOCKED items; add gate line to CLAUDE.md)
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
