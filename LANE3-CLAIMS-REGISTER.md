# LANE 3 — Claims & promises register (harvested 2026-08-10, pre-play)

Sources read in full by harvest agents: HANDOVER-2026-07-31.md, STATE_AUDIT.md, BLOCKED.md,
RECONCILE_REPORT.md, REVIEW-SEED-19-20.txt, RUN21A/B/C/D-REPORT.md, RUN21F*-PROGRESS.md,
data/whatsnew.js (main), PICK-UP-HERE.md. Grades to be filled during play:
CONFIRMED / OVERSTATED / ALREADY-HANDLED / WRONG.

Note: REVIEW-SEED-19-20.txt is a save-seed blob (v23, "Ada", 900 stars), not claims.

## 1. EXPEDITION CLAIMS (Part A grading targets)

| ID | Source | Claim | Verify by | Grade |
|---|---|---|---|---|
| E1 | STATE_AUDIT §2 P15 | Expedition shell MISSING (audit-era, stamp run10) | Find/open the Expedition door | |
| E2 | STATE_AUDIT §2 P16 | Expedition puzzles MISSING (audit-era) | Reach any puzzle node | |
| E3 | STATE_AUDIT F-06 (marked CLOSED) | Attribute engine was not P14-spec; RUN11 Q3 adopted the real engine | Hint behaves as informative-next clue, not random | |
| E4 | STATE_AUDIT §6 | Resume-branch Expedition to-spec: party picker 8–12 w/ variety top-up; 4 named nodes; budgets sneezes[6,6,8,8] huffs[5,6,7,8] failedSails[3,4,4,5] wrongRooms[6,8,10,10]; comedy-wrong; wonder-lines ≤9 words; hint via informativeNext; deviation: L_EXP_* constants inlined not in guideLines.js | Party picker range/top-up; count wrong-budget at tier 1; comedy lines | |
| E5 | RECONCILE §5 | P15–P17 salvaged via RUN8v2/RUN11 Q2–Q7 | Expedition works at all | |
| E6 | BLOCKED (RUN18A H2) | Containment-era: caper unreachable (freshCaper only call site = finishing a full trail); self-resolves when Expedition reopens | Finish a trail → caper opens (notebook, wanted poster, signposts) | |
| E7 | BLOCKED (RUN18C) | Ferry Raft was uncompletable (raftValid counted absent features as shared; 12-in-12 unsolvable); FIXED — 240/240 solvable, pinned r18c-expedition §1 | Play the raft node with starter Boos; solvable | |
| E8 | BLOCKED (E6 aside) | Trail-completion presentation "was never built" (pre-RUN18C claim) | Finish full trail: is there a real completion moment + boo_wander grant? | |

Primary-player verdict on record: "okay, not delighted". Part A must name where okay fails
to become delighted: dead seconds, unclear goals, flat rewards — smallest honest fix each.

## 2. GENERAL FINDINGS (spot-check during play; grade the child-visible ones)

Town: N1 lamp floats on table (RUN21B claims fixed — HANDOVER demands screenshots at several
scales); N2 wish-chip medallion (RUN21B claims 60 artworks); N3 balloon OUTDOOR_ONLY vs
SKY_WISHES mismatch (unfixed); N4 seated/sleeping Boo tap target (run20b fix); N5 sleeper
z's/bubble under bed (run20b fix); N6 sky wishes not greyed indoors (run20b fix); N9 disco
soles (fixed pre-RUN21).
Ceremony: N15 short party ends with EMPTY guide line + no follow-up (OPEN; "most
child-visible standalone bug").
Literacy/speech cluster (all OPEN, none touched by RUN21): N17 Blend It graphemes possibly
not sounded in order (CHECK FIRST — toddler phonics); N18 Rhyme Time "hear it again" queues
(likely test timing); N19 Story Order 8/16 spoken lines wrong panel ("may well be real");
N20 encouragement line never spoken; N22 queue-vs-interrupt product question (Alex's call);
N23 Toddler Stories 4-panel minimum, too hard for 3–4s (Alex's call); N25 Word Detective ABC
keys ~34px wide at 390px (authored layout, decision left).
Maths: N27 Bounce last-resort guard fires with no sparkle-hop (unfixed); N28 Dash wrong-gate
crash fixed; N29 Dash hearts may never render (.heart-ic.on matches nothing — OPEN); N30
Teach Me lesson-count pin stale (test-side).
Boo Roll: N33 course clock runs at 2× real time (OPEN, deliberate, NEEDS_ALEX).
Grown-ups/privacy: N37 one feelings value reaches device storage w/ feature off (OPEN);
N38 child-PII purge (CLOSED; git history still has them).
A11y/perf: N47 a keyframe animates a layout property (OPEN); N49 primary-button audit left
manual.
Meta: N53/N54 prior external audits overclaim — verify each claim individually.

## 3. WHAT'S NEW SINCE run21a — truth targets (Part B)

run21f-20260804: table-carries-lamp (F5). run21c-20260803: tray-any-time (C1); Path Pot
(C2); shop path styles (C4); Undo (C7). run21b-20260803: 60 wish artworks (B1); wishes
alive/idles (B2); furniture fits Boos (B3); bigger train (B6). run21f-20260803: per-area
sound beds (F7). run21d-20260803: 💭 map chip (D2); four dots (D3); fair signs (D4); hider
nudge (D5). run21a-20260803: seated-Boo hop-off (A1); gold letters land readable (A3);
Town Postcard (A11+F6); rocket always listens (A5-adjacent).
WITHDRAWN precedent: "Boos walk on your paths" (07c6977). Hunt for others in its category
(entries describing behaviour a child cannot actually see).

## 4. HANDOVER §6 unresolved (Part B explicit targets)

- Lamp-on-table at several scales — RUN21B says fixed; DEMANDS screenshots at several
  scales, not another measurement. Do exactly that.
- Bounce last-resort sparkle-hop — no fix found; verify in code + play.
- Balloon OUTDOOR_ONLY/SKY_WISHES — no fix found; verify chip copy indoors.

## 5. Standing laws inventory for Part B2 (harvest complete)

CLAUDE.md hard laws + architecture contracts + board law (amended) + experience laws;
whatsnew-as-deploy-gate; never advertise switch-on features; PROJECT_STATE at final gates;
walk.mjs pre-merge; five-suite core; merge main INTO branch; two lanes + one serial re-run;
real mouse; on-camera seeds; fresh-context seeding; drawer closed at mount; dismiss
growth-reveal; stale pins re-pointed never weakened; cameraClaimed; one pan primitive;
Pulse defers to reveal queue + cameraClaimed only; worldSoftened() as the arranging gate;
copy ships exactly as authored; Fix/Deviate/Block discipline; announced moments; engine
reuse; OFFLINE LAW; one port per worktree; resize contract 0.70–2.00 indoors; B=74.36px
measured; truth-in-What's-New outranks completeness.

## 6. Deploy-state facts (Part B)

- main sw.js stamp `run21f-20260804`, SAVE VERSION 24 (F5 only schema change).
- PICK-UP-HERE.md on main is STALE (says run21b live, C at gate, F5/F6 not started).
- RUN18/19/20 reports do not exist anywhere (honest CHANGELOG omission, F4 dev 3).
- Known deferred: C5 path-following (blocked, entry withdrawn); RUN21E whole pack; F8/F9
  gated; playground invitation stand-in copy; empty outdoor area has no opening beat;
  L_PATH_FULL names retired Erase control; wall clock/photo frame un-shrunk; flipped-corner
  resize drag sign; r19z3-moments pre-existing fail; Toddler Stories decision.
- F6 recorded limitations: custom Boos render as nothing in a visit; dusk visitor giggle
  repeats; crown wish verb crowns nobody; rides beyond Carousel not carried.
