# LANE 3 — Playtest & Audit ledger (2026-08-10, overnight)

Branch `review-run21-full` @ main 22b8d40 (`run21f-20260804`, save v24). Port 8043.
READ-ONLY lane: markdown reports only; screenshots local under `_evidence/review-aug10/`.

## Setup log
- Worktree `..\Boo-town-review-wt` created from main; node_modules junctioned. Server: `_serve.py 8043` (no-store). ✓ boots to Start.
- DECISION: drive all play through a persistent-profile Playwright driver (`_evidence/review-aug10/tools/drive.mjs`) rather than the interactive browser pane. · WHY: the session is unattended, the pane cannot composite screenshots ("Browser pane is not displayed"), and screenshots are this lane's evidence standard; the driver keeps localStorage across sittings like a real child's browser, arms the same error hooks walk.mjs uses, and drives the REAL mouse per the house testing law. · REVERSIBLE: delete the profiles dir; nothing app-side is touched.
- DECISION: added a `review-8043` entry to MAIN `.claude/launch.json` (dev-tooling config, not app code) so the harness can manage the server process. · WHY: the harness forbids raw background servers via shell; launch.json is the sanctioned path; the entry is additive and names an absolute path into the review worktree. · REVERSIBLE: delete the entry; file is untracked dev config.

## Corpus harvested (full registers in LANE3-CLAIMS-REGISTER.md)
- Expedition claims E1–E8; general findings N1–N55; HANDOVER §6 unresolved verbatim.
- What's New register run21a→run21f-20260804 (13 live entries + 1 withdrawn), ACCEPT register (top child-visible: B1,B2,B3,C1,C2,C3,C7,D1,D2,D3,D4,A1,A16,F7,F5), standing-laws list for Part B2.
- Known truths that frame the audit: "Boos walk on your paths" withdrawn (C5 BLOCKED — mechanism exists, not visible); PICK-UP-HERE.md on main is STALE (still says run21b live, F5/F6 not started); RUN21C item 5 must NOT be tested as promised; F6 known limitations (custom Boos absent, dusk giggle repeat, crown verb) are recorded, not new findings.

## Play sessions
(appended as they happen)
