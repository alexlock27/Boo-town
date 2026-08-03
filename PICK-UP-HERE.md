# Pick up here — RUN21 programme, mid-flight (3 Aug 2026)

Live build: **`run21b-20260803`** at https://alexlock27.github.io/Boo-town/
`main` carries **RUN21A**, **RUN21B**, **RUN21D** and **RUN21F F1–F4, F7, F10**. RUN21C is at its gate; RUN21E is deferred to a separate session (see `RUN21-programme/RUN21E-HANDOVER.md`).

Reports on main: `RUN21A-REPORT.md`, `RUN21D-REPORT.md` (+ their `*-PROGRESS.md` ledgers).
Packs live in `RUN21-programme/` (gitignored, private).

---

## State of every pack

| Pack | Branch | State |
|---|---|---|
| **A** Reach & Truth | merged | **LIVE** |
| **D** Alive on Arrival | merged | **LIVE** |
| **F1–F3** tools + state gen | merged | **LIVE** |
| **B** Look & Feel | `run21b` | items 1,2,4,6,7 DONE; **3+5 in flight** (agent); then gate + merge |
| **F7 + F10** beds, QA walk, journal | `run21f2` | complete, main merged in, **gating now** |
| **C** Build Dissolved | `run21c` | **in flight** (agent), branched from main@6f50a46 |
| **E** Every Area a Job | — | not started; needs B (art sizes) + D (pulse) |
| **F6** Visit a Town | — | not started; completes A item 11. Touches town.js — run AFTER B and C merge |
| **F4** doc truth pass | — | not started; deliberately AFTER A–E merge so CHANGELOG/README have real reports |
| **F5** save v24 | — | not started; **strictly last** |
| **F8** leitmotifs / **F9** voice | — | **SKIPPED-GATED** — NEEDS_ALEX.md lacks `LEITMOTIFS: APPROVED-TO-COMPOSE` and `VOICE: APPROVED · BUDGET: <MB>` |

## The merge order that has been working
Packs branch from current `main`, and **main is merged INTO the branch before its gate**, not
the other way round — reconciling while both sides are fresh. Doing this for D→B immediately
exposed a real defect (see below). Expect every pack after the first to need one.

## What the gates have actually caught (why they are not a formality)
- **A:** the drawer transition shield was swallowing the child's placement tap, and the fair
  catch-up celebration was firing in the Meadow instead of the fair. Also: an assertion that
  was passing *for the wrong reason* (nothing placed because the click never landed).
- **B:** the slot glow was never wired to the gesture children actually use; `cls` is the tap
  dispatcher so the pack's idle classes would have deleted tap verbs; the disco's real
  overlap source was the spotlight, which the pack never mentions.
- **D→B merge:** `playOnce` queued an unconditional class removal, so tapping the instant a
  pose ended let the OLD timer strip the NEW pose. Unreachable until A stopped budget-gating
  taps. Both timers now carry tokens.
- **Every one of the 13 pack items scouted so far came back DEVIATE.** Verify before building.

## Testing notes this programme paid for
1. **Two lanes, not three.** 3 lanes gave 4 false failures; 2 gave 2; serial gave 0. Confirm
   any flake with ONE serial re-run (board law), never by re-running until green.
2. **Frame-evidence suites are the flaky ones**, plus `.hub` boot timeouts. `ERR_NO_BUFFER_SPACE`
   means socket exhaustion on this box — serve the baseline on a fresh port to prove it.
3. **Drive the REAL mouse.** Synthetic PointerEvents have no active pointer, so the app's
   `setPointerCapture` throws and the harness then blames the app for its own error.
4. **Seed placements ON-CAMERA.** An outdoor area is FOUR viewports wide, so anything above
   x≈0.25 is off the right edge at default scroll, where `stepActors` skips it as offscreen
   and a real click cannot reach it. A test that "passes" with an offscreen actor proves nothing.
5. **The drawer is CLOSED at mount** — a chip having a bounding rect does not mean you can
   press it, and its tab panel may be `hidden` (0×0) until selected.
6. **Dismiss `.overlay.growth-reveal`** on mount: multi-threshold fixtures legitimately open
   with a combined celebration now.
7. `npm test` still points at a missing `tests/run.mjs` — **RUN21F F4 owns that**, do not fix
   it mid-run. Invoke suites directly: `BASE=http://127.0.0.1:<port> node tests/<name>.mjs`.

## Ports in use (one per worktree, never share)
8000 main · 8003 main-tree probes · 8011 run21d-wt · 8012 run21f2-wt · 8021 run21b (items 3+5)
· 8031 run21c-wt

## The gate recipe
```
git clone --branch <b> --single-branch . ../Boo-town-<b>-gate
cd ../Boo-town-<b>-gate && cmd //c "mklink /J node_modules ..\Boo-town\node_modules"
python _serve.py <port>
for s in <affected + core>; do BASE=http://127.0.0.1:<port> node tests/$s.mjs; done
```
Core is always: `r12s1-routes`, `r8p1-migrations`, `m3-pwa`, `r12s4-contrast`, `r18a-copyguard`.

## Still open, unchanged by this programme
- **Toddler Stories is too hard for 3–4s** — awaiting the maintainer's decision (recommended:
  remove the Stories door from the Toddler hub, one line in `js/hub.js`). Not actioned: it
  removes a game.
- The pre-existing speech-cluster failures and other known-broken suites in `BLOCKED.md`.
- `RUN21*-PROGRESS.md` and `RUN21*-REPORT.md` are COMMITTED to the public repo, matching the
  seven existing tracked `RUN*_REPORT.md` files. Checked for names/secrets. Gitignore them if
  you would rather they stayed private.
