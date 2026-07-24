# RECONCILE_REPORT.md — the three-tool reconciliation of Run 10

Rewritten in full from git history (RUN11 Q8 / finding F-08). The original file began at
"## 3", carried no §1–2 and no adopted-file list, which left the audit trail for a
three-tool reconciliation incomplete. Nothing here is new work: it is the record of what
was reconciled onto `main`, reconstructed from the commits themselves.

## 1. What happened, and who did what

Run 10 was built by three different tools against the same Build Pack (`RUN10.md`):

| Tool | Where it worked | What survived |
|---|---|---|
| A Claude session | `main` | Packets P0–P4, then the P1–P5 recovery baseline |
| The OpenAI Codex tool | `main`, then `codex/run10-resume` | Continued many packets on main; the resume branch holds the unmerged remainder |
| Google Antigravity | a retired working copy ("DONOR") | Fixes reconciled onto `main` file-by-file — the subject of this report |

Antigravity did not merge a branch. Its changes were brought over **per file**, grouped
into five thematic commits, all dated 2026-07-24. This report is the list of those files,
plus the outcome of each group once it was independently re-verified.

## 2. The adopted files (28 across five commits)

**`70f6dc4` — reconcile(antigrav): game mechanics and physics fixes** (9 files)
`js/games/beat.js`, `js/games/booroll.js`, `js/games/bubblepop.js`, `js/games/detective.js`,
`js/games/feedboos.js`, `js/games/flashboos.js`, `js/games/oddboo.js`,
`js/games/spellboo.js`, `js/games/teachme.js`

**`67ba6c2` — reconcile(antigrav): economy and state stardust logic** (4 files)
`js/ceremony.js`, `js/collection.js`, `js/rewards.js`, `js/state.js`

**`0a96d5e` — reconcile(antigrav): town rendering and hub navigation fixes** (6 files)
`js/gallerymuseum.js`, `js/hub.js`, `js/main.js`, `js/town.js`, `js/ui.js`, `js/worldmap.js`

**`44b0566` — reconcile(antigrav): hardware IO, input, and particle polish** (7 files)
`js/art.js`, `js/care.js`, `js/gallery.js`, `js/paint.js`, `js/sfx.js`, `js/speller.js`,
`js/wishwell.js`

**`642202f` — reconcile(antigrav): styling, caching, and manifest updates** (2 files)
`css/styles.css`, `index.html`

Two release commits followed: `e641c7e` (test fixes for v11, sw.js bump, the original
truncated version of this report) and `e8ec1e3` (removed `data/courses.js` from the sw.js
cache manifest).

## 3. What the adoptions actually fixed

Independent re-verification (STATE_AUDIT.md §3) confirmed these were real defects, correctly
closed:

- **Odd Boo Out brute-force exploit** — a wrong tap now locks the board for 1.5s and
  reshuffles, so a child can no longer tap all nine tiles in seconds. (`oddboo.js`)
- **End-game economy collapse** — duplicates now grant Stardust instead of feeding the
  meter→box loop; `DUPLICATE_POINTS` was removed and `stardust`/`shinies` added to the save.
  (`rewards.js`, `state.js`, `collection.js`)
- **Retina/high-DPI blur in Paint** — the canvas backing store is now multiplied by
  `devicePixelRatio` and the context scaled to match. (`paint.js`)
- **No hardware keyboard** — physical A–Z / Backspace / Enter now work in Word Detective,
  Spell Boo and the Wish Well, which matters on a tablet with a folio keyboard.
  (`detective.js`, `speller.js`, `wishwell.js`)

## 4. The two overturned adoptions

Antigravity self-approved all 28 files. Twenty-six held up. Two shipped regressions that
were caught later by audit and fixed in RUN8 v2:

| File | Finding | What went wrong | Outcome |
|---|---|---|---|
| `js/town.js` (in `0a96d5e`) | **F-02** | The commit added a `clearRarityFx(wrap)` call at the town render loop but did not add `clearRarityFx` to the `./rarityfx.js` import list. Every town/area render threw `ReferenceError`, aborting scenery rendering and cascading through ~14 suites. | **FIXED** in RUN8 v2 phase 1 — the import was completed. Town cascade green. |
| `js/games/booroll.js` (in `70f6dc4`), compounded by `e8ec1e3` | **F-01** | The adopted `booroll.js` kept a static `import … from '../../data/courses.js'`, but that file was never adopted. `e8ec1e3` then removed `courses.js` from the sw.js manifest — treating the manifest symptom while leaving the dangling import. Boo Roll failed to load at all, online and offline. | **FIXED** in RUN8 v2 phase 1 — `data/courses.js`, `booroll.js` and `boorollphysics.js` were adopted together as the real dependency closure (the audit's "pair" was a trio). |

The lesson recorded for future reconciliations: a per-file adoption must be checked for its
**dependency closure** (imports it introduces, files it expects to exist), not just for
whether the file itself looks correct.

## 5. `origin/codex/run10-resume`

A diff of `origin/codex/run10-resume` against `main` showed several unmerged features
(~2,800 insertions across ~75 files): P8 Boo Roll courses, P9 Word Detective GO, P14 the
attribute engine, P15–P17 Expedition and Caper, and P21 delights.

The original report recorded these as "superseded … NOT adopted". That characterisation was
wrong: they were unbuilt on main, not superseded. They were subsequently salvaged
per-file — never merged — across RUN8 v2 (P8 courses) and RUN11 Q2–Q7 (P9, P14, P15–P17,
P21), each reconciled to main's current APIs and save VERSION.

**The branch is the historical record and the salvage source. It is never merged, never
deleted, and never pushed to.** It sits on `VERSION 7` while `main` is far ahead; a merge
would downgrade the save schema and revert later work.

## 6. Untracked / gitignored files at the time of the reconciliation

Excluded from the merge and left in the working directory only:
`AUDIT_23.07.26 ai studio v2.md`, `AUDIT_23.07.26.md`, `FULL_PROJECT_CONTEXT.txt`,
`sw.js.bak`, `temp_zip_extract/`, `zip (1).zip`.
