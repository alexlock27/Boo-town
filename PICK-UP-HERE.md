# Pick up here — RUN21A shipped; RUN21B is next (3 Aug 2026)

Live build: **`run21a-20260803`** at https://alexlock27.github.io/Boo-town/
`main` carries RUN21A ("Reach & Truth", 17 items) and RUN21F F1–F3 (the two art tools + the
PROJECT_STATE generator). Both branches merged; nothing uncommitted.

Full detail: `RUN21A-REPORT.md` (per-item ACCEPT evidence, the hints table, three FIXes and
nine deviations) and `RUN21A-PROGRESS.md` (the ledger). The programme packs live in
`RUN21-programme/` (gitignored, private).

---

## THE ONE THING TO DO FIRST

**Start RUN21B — "Look & Feel"** (`RUN21-programme/RUN21B-pack.md`). Its prerequisites are
now met: RUN21A is merged, and `tools/asset-preview.html` + `tools/anchor-tuner.html` exist.

Branch `run21b` from main, ledger `RUN21B-PROGRESS.md`, commit `RUN21B-<n>: <title>`, push
after every commit. Seven items; item 1 is the big one — **60 standalone wish artworks** to
replace the single gold star medallion every wish currently shows (see
`_evidence/run21a/item3-gold-readable.png` for what that medallion looks like today).

Item 1 is the one place in this programme where wide fan-out genuinely pays: the 60 SVGs are
independent, each has a one-line binding brief in the pack, and the style guide is explicit
(ink `#2A1B4E`, stroke 6 at a 120 viewBox, round caps, white sticker halo, flat fills,
readable at 60px). Confirm the palette hexes against `css/styles.css` custom properties
first — the pack says vars win. Everything else in the pack is sequential.

---

## Testing notes this session paid for

1. **Two lanes, not three.** At 3 lanes the affected-suite board produced 4 false failures;
   at 2 lanes, 2; serially, 0. Every "flake" was confirmed by ONE serial re-run, per board law.
2. **Frame-evidence suites are the flaky ones** — `r4p5-town` (seesaw wants ≥5 distinct
   frames, got 4 under load, 7 serially) and `.hub` boot timeouts (`r10p5-personalities`).
3. **A green assertion can be green for the wrong reason.** `r10p2-sockets` asserted "the
   25th item is refused" and passed — while the click that should have been refused was
   being swallowed by a bug. The assertion that actually caught it was the *guide line*.
4. **Seed Boos on-camera.** An outdoor area is FOUR viewports wide, so at the default
   scrollX anything above x ≈ 0.25 is off the right edge, where `stepActors` skips it as
   offscreen and a real mouse click cannot reach it. A test that "passes" with an offscreen
   actor is usually proving nothing.
5. **`npm test` still does not run** — `package.json` points at a missing `tests/run.mjs`.
   RUN21F F4 owns that; do not fix it mid-run. Invoke suites directly:
   `BASE=http://127.0.0.1:8001 node tests/<name>.mjs`.

## The gate recipe that worked

```
git clone --branch <branch> --single-branch . ../Boo-town-<b>-gate
cd ../Boo-town-<b>-gate && cmd //c "mklink /J node_modules ..\Boo-town\node_modules"
python _serve.py 8001
for s in <suites>; do BASE=http://127.0.0.1:8001 node tests/$s.mjs; done
```

## RUN21 programme state

| Pack | State |
|---|---|
| **A** Reach & Truth | **SHIPPED** `run21a-20260803` |
| **F1–F3** tools + PROJECT_STATE | **SHIPPED** (merged with A) |
| **B** Look & Feel | **NEXT** — prereqs met |
| **C** Build Dissolved | after B (needs A; B/C/D order is the maintainer's call from play notes) |
| **D** Alive on Arrival | after B (needs A) |
| **E** Every Area a Job | after B/D (needs A) |
| **F4** doc truth pass | deferred until A–E merged, so CHANGELOG/README have real reports |
| **F5** save v24 | strictly LAST, after A–E |
| **F6, F7, F10** | any time after their prereqs (F6 completes A item 11's Visit-a-Town) |
| **F8** leitmotifs · **F9** Twiggy voice | **SKIPPED-GATED** — NEEDS_ALEX.md lacks `LEITMOTIFS: APPROVED-TO-COMPOSE` and `VOICE: APPROVED · BUDGET: <MB>` |

## Still open, unchanged by this run

- **Toddler Stories is too hard for 3–4s** — awaiting the maintainer's decision (three
  options in git history of this file; recommended: remove the Stories door from the Toddler
  hub, one line in `js/hub.js`). Not actioned: it removes a game.
- The pre-existing speech-cluster failures and the other known-broken suites listed in
  `BLOCKED.md` are untouched by RUN21A.
- One judgement call worth a glance: `RUN21A-PROGRESS.md` and `RUN21A-REPORT.md` are
  COMMITTED (public repo), matching the seven existing tracked `RUN*_REPORT.md` files.
  They carry no names, no secrets. Gitignore them if you would rather they stayed private.
