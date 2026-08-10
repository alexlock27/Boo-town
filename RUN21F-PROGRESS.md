# RUN21F Progress

- [x] F1 — tools/asset-preview.html — DONE (commit RUN21F-1). Real renderBoo output pasted in renders at 60/120/220px on all three real backdrops (hexes read from css/styles.css: meadow .t-band.meadow, room-grey = kitchen wall, night .town2.night .t-skygrad); 60px silhouette toggle forces single-ink; 4 manual tickboxes + automated fill/stroke colour-literal readout. Evidence: scratchpad verify-f1.mjs, 18/18 PASS over file:// (offline), zero network requests.
- [x] F2 — tools/anchor-tuner.html — DONE (commit RUN21F-2). Drag + 0.005 arrow-nudge tuner in the exact data/sockets.js convention (x = frac of parent width from centre; yFrac = frac of parent height above the viewBox y=120 ground line, per town.js give()); Copy JSON emits paste-ready SOCKETS `{ x, row: 2, yFrac }` or SURFACE_SLOTS `{ x, surfaceY }`. Evidence: scratchpad verify-f2.mjs, 14/14 PASS — dragging onto the real bench SVG read back `{ x: -0.2, yFrac: -0.274 }` and `{ x: 0.2, yFrac: -0.274 }`, exact match to data/sockets.js deco_bench (tolerance ±0.01).
- [x] F3 — tools/gen-state.mjs — DONE (commit RUN21F-3). Writes PROJECT_STATE.md: build `run20d-20260731` + 158 assets, save v23, 54 screens, 8 areas, 149 catalogue items by kind, 60 wishes, 24 dressings, 204 suites (npm test does NOT resolve — tests/run.mjs missing), 7 RUN reports, gated-item harvest. Spot-checked by hand: screens 54, catalogue 149 (independent id-count), wishes 60, suites 204, dressings 24. Ran twice, byte-identical (no timestamps). CLAUDE.md deploy-gate bullet gained the regeneration line.
- [ ] F4 — CHANGELOG/README truth pass — DEFERRED until after packs A–E merge (so the truth pass has real reports and F3 numbers)
- [ ] F5 — save v24 — STRICTLY LAST
- [ ] F6
- [ ] F7
- [ ] F8 — IN PROGRESS on branch `run21f8` (TONIGHT-2026-08-10 Lane 2). Gate re-checked at
      session start: NEEDS_ALEX.md line 404 now carries `LEITMOTIFS: APPROVED-TO-COMPOSE`,
      so the SKIPPED-GATED status above is superseded for this branch.

      DECISION: the loops are AUTHORED as note-event arrays in the band engine's event
      shape (`{t,i,v}` + a duration field `d` the band player would simply ignore), but
      PLAYBACK in town rides the music bus via a lookahead scheduler in sfx.js's new
      leitmotif region, not `startBandWatch`. · WHY: the pack's two sentences pull apart —
      "note-event arrays for the existing band engine" but "play as the area's calm-music
      variant at existing music volume". startBandWatch plays on the SFX bus at band level
      through setTimeout (loose timing) and adds a +900ms gap between loops: wrong bus,
      wrong mute, and a continuity-law breach for a piece sold as continuous area music.
      The music bus's own scheduler pattern (startScheduler/scheduleAhead, audio-clock
      lookahead — the same pattern F7 extended) gives sample-accurate seamless looping at
      existing music volume with duck-and-mute for free. Authoring stays band-shaped so the
      arrays remain engine-portable data, exactly what the pack asked to own. ·
      REVERSIBLE: the arrays are pure data; pointing startBandWatch at them needs no
      re-authoring.

      DECISION: per-area roots and tempi — meadow C·84, riverside F·88, hilltop G·76,
      beach D·80, playground A·92, all inside the pack's 76–92 window, all pentatonic
      major. · WHY: the pack fixes scale/tempo-range/voice-cap but leaves root and exact
      bpm open; distinct root + distinct tempo per area is what makes five loops in one
      scale-family identifiable blind (the F7 beds set the "each area audibly distinct"
      bar). Funfair excluded (its jingle/bandstand rules own that air — pack F7 precedent);
      interiors keep plain 'calm'. · REVERSIBLE: one constant per area in
      data/leitmotifs.js.

      DECISION: composition ran as a judged panel (two independent candidates per area,
      one judge per area, one cross-area distinctness/originality reviewer) rather than a
      single pass. · WHY: originality is a protected-core law and pentatonic major invites
      accidental nursery-rhyme echoes; independent attempts plus an adversarial originality
      check is the strongest defence I can run without ears. Alex's audition gate remains
      the human check. · REVERSIBLE: fully — the deliverable is still just data.
- [ ] F9 — SKIPPED-GATED: lacks `VOICE: APPROVED · BUDGET: <MB>`
- [ ] F10

Notes:
- This branch (run21f) works items F1–F3 only; F4 deferred, F5 last, F8/F9 gated as above.
- tools/ pages are LOCAL-ONLY dev tooling: they stay OUT of sw.js ASSETS[] and are never linked from the app. sw.js is NOT touched this run.
