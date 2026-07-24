# Boo Town RUN11: THE SALVAGE AND REPAIR PACK (v1.0)
# Executor: strongest available model, high effort, unattended.
# ALL design thinking is done here. Do not redesign. Numbers, ids and copy are law.
# Evidence base: STATE_AUDIT.md on main (findings F-01..F-11, packet table P0-P23).
# Baseline at authoring: main @ run8v2-p4-20260724, board 69 PASS / 24 FAIL, VERSION 12.

## Read first, in order
CLAUDE.md (house law; binds everything here), STATE_AUDIT.md (the register this pack
executes), PROGRESS.md (current state), then this file in full. RUN10.md remains the
specification of record for packets P8/P9/P14-P17/P21 — when this pack says "to P15
spec", that means RUN10.md's P15 text, which you must read before building.

## Global rules
G1. Work only inside this repo. Zero runtime network requests (the OS share sheet at
an explicit user tap is not an app request). No frameworks, no analytics.
G2. Save law: main is VERSION 12. The salvage source branch codex/run10-resume is
VERSION 7 — NEVER merge that branch, never adopt its js/state.js, never let an
adopted file lower VERSION or bypass migrate(). Any new field = one new migration
step + VERSION bump, lossless, with a test in the era suite (v5..current) that RUN8
established. Run that suite after EVERY schema change.
G3. Cherry-pick discipline: adopt from the resume branch per-file
(git checkout origin/codex/run10-resume -- <path>), then immediately reconcile the
file against main's current APIs (imports, router contract, guide/art/drawer
contracts, VERSION-12 save shape). An adopted file that still references
resume-era state fields must be adapted, not reverted.
G4. sw.js ASSETS[]: every new or adopted js/ and data/ file joins the precache list
in the SAME commit. A packet is not done while its files are missing from ASSETS[].
G5. A packet is NOT complete while any suite it touches is red. "Code shipped, suite
failing" is a FAIL, not a partial. If a suite is genuinely wrong (asserts something
the spec never promised), fix the TEST and say so explicitly in PROGRESS.md with the
reasoning. Never delete a failing test to make a board green.
G6. Blocked twice on the same step → BLOCKED.md with a repro, mark the packet
BLOCKED in PROGRESS.md, move to the next packet. Never idle, never improvise a
different design, never widen scope.
G7. Commit AND push at sub-steps. Deploy gate at each packet end: bump BUILD_STAMP,
push, fetch the live URL, confirm the stamp serves, add a PROGRESS.md row (packet,
verdict, suites red→green counts, evidence paths, 2-line delight note).
G8. Evidence per CLAUDE.md: motion = 6+ frames over 3+ seconds; audio = instrumented
logs; screenshots at 1024x768, 768x1024, 390x844. Working-but-dead is a FAIL.
G9. Privacy law, absolute: no child's real name, age, or family detail may exist in
ANY tracked file or in any string the app can display after Q1. This includes
identifiers, save keys, comments, test fixtures, CHANGELOG and commit messages.
G10. Never touch, delete or push to codex/run10-resume. It is the salvage source and
the historical record.

## Orchestrator
Execute Q1 → Q12 in order. Q1 (privacy) ships first because it is live-facing. The
board must be greener at every gate than the gate before it; report the running
count each time.

================================================================================
## Q1. Birthday feature: retire from the app, preserve in history, purge the names
Decision from the maintainer, implement exactly: the birthday party feature is
finished (the gifts were opened). It leaves the live game, its code stays in the
repo for future reuse, the two Boos people earned STAY OWNED and working, and every
real name and age leaves the tracked codebase.

1. Preserve first: create the tag `birthday-2026-archive` at current HEAD and push
it (git tag -a birthday-2026-archive -m "birthday feature as shipped, pre-retirement";
git push origin birthday-2026-archive). This is the future-reuse copy. State the tag
name in PROGRESS.md.
2. Remove from the running app: delete the `birthdayparty` route entry in js/main.js
(~line 57) and any hub/rail/Today entry points, any launch conditions, and its
sw.js ASSETS entry. Move js/birthdayparty.js to `archive/birthdayparty.js` (a new
folder excluded from ASSETS and never imported) so the code survives in-repo but
cannot load. Delete its CSS block from css/styles.css if isolated; if entangled,
neutralise selectors and comment why.
3. Keep the two earned Boos, neutralised: in data/catalogue.js the two
`boo_birthday_*` collectibles keep their art and rarity but get neutral ids
`boo_party_gift_a` / `boo_party_gift_b` and neutral display names — author exactly:
"Confetti" and "Ribbon" — with neutral one-line blurbs in the house voice.
4. Migration, VERSION 13, lossless: map owned/shiny/bond/dressup records from the
old ids to the new ones; map any `birthdayParty.opened.*` save state into a single
neutral archived flag; nobody loses a Boo, a bond level, or a trophy. Extend the era
suite: a seeded v12 save owning both old ids must emerge owning both new ids with
bonds and shiny state intact.
5. Purge names and ages from ALL tracked files: js/, data/, css/, tests/, and the
docs — including CHANGELOG.md, PROGRESS.md, STATE_AUDIT.md and any test fixture.
Replace with neutral tokens. Grep-guard test, permanent: a suite that fails if a
name/age pattern list (author it from what you find, plus generic first-name-plus-
age string shapes) appears anywhere in tracked files. Note in PROGRESS.md that git
HISTORY still contains the names (rewriting history is out of scope and forbidden by
G10-adjacent rules); only the working tree is purged.
Assertions: route absent (navigating to it 404s to the hub gracefully); archive file
never fetched (ASSETS + import grep); catalogue ids renamed with art intact; era
suite green including the v12→v13 case with a two-Boo fixture; the grep-guard suite
green; full board count reported.

================================================================================
## Q2. F-05 + P9: Word Detective GO key and tile badges
Adopt from resume: js/games/detective.js changes and the .det-go/.go-ready CSS.
Reconcile to main's detective (which has the hardware-keyboard handler from the
reconcile — KEEP that). Then complete to RUN10 P9 spec exactly: goKey handle,
renderCurrent's ready toggle ('GO!' vs '⏎'), goTaught fired once per round via
guideLine, L_WD_GO added to data/guideLines.js (author exactly: ["Tap GO when you're
ready!", "Ready? Hit the big GO!"]), the CSS pulse with its reduced-motion path, and
the ::after badges (green ✓, orange •, grey none).
Assertions: go-ready toggles with row fill and backspace revert; taught line once
per round; reduced-motion computed animation-name none; badge contents verified;
hardware keyboard still works; flip pipeline frames sequential; r10p9 suite green.

================================================================================
## Q3. F-06 + P14: the real attribute engine, side by side
Main's js/attrengine.js is the P19-flavoured helper (oddGrid/flashScene/
flashQuestion) and Odd Boo Out + Brain Bloom depend on it. The resume branch has the
true P14 API (features, featuresOf, partition, genRule, genExclusiveRules, cluesFor,
informativeNext). Do NOT overwrite one with the other.
1. Adopt the resume engine as js/attrengine.js (the P14 API is the canonical
attrengine per RUN10), and move main's P19 helpers into js/brainhelpers.js,
repointing js/games/oddboo.js and the Bloom code to the new path. No behaviour
change for P19 features.
2. Write the P14 truth-table suite from RUN10 P14 exactly (uniform-species party
yields no species rule; thin party falls back or nulls; negation truth table; AND
both-branch minimums ≥3; genExclusiveRules 500-seed cover-and-disjoint; cluesFor
uniqueness by clue 4 over 200 seeds; informativeNext beats random split in sim with
the margin reported).
Assertions: both suites green (r10p19 brain unchanged in behaviour, new r10p14
green); no file imports the wrong module (grep); ASSETS updated.

================================================================================
## Q4. P15 + P16: the Boo Expedition, salvaged and completed
Adopt js/expedition/* (trail.js, puzzle.js, postcard.js) and any data/expedition.js
from resume; reconcile against VERSION 12+ save shape, the router contract, and
main's guide/art/drawer APIs. Then audit the adopted code line-by-line against
RUN10 P15 and P16 and BUILD what is missing or off-spec — the spec wins over the
salvage every time. Non-negotiable spec points to verify individually:
party picker 8-12 with feature chips and guest top-up on genRule null (VISITOR
sash); trail of 4 nodes + camp with cocoa idle; per-node resume; budgets exactly
bridges [6,6,8,8], picnic [5,6,7,8], raft [3,4,4,5], hotel [6,8,10,10]; stars 3
within budget / 2 ≤ budget×1.6 / 1 for finishing; hint via informativeNext capping
that puzzle at 2 stars and never stating a rule; tiers 1-4 stepping on clean solves
only; Wander granted once, never in box rolls (5000-roll guard); Journal stamps and
the two trophies; the Snaffle reveal scene once.
Puzzles to P16 spec: Sneezy Bridges (two disjoint guardian rules, sneeze
choreography, camp return); Picky Grumps' Picnic (the EXACT 8 toppings with their
colour/shape/kind features, plate-of-3 satisfaction, bounce-off feedback); Ferry
Raft (3×4 grid, neighbours share EXACTLY one feature, live edge colours, solvability
guarantee over 500 seeds); Boo Hotel (3 floors × 4 rooms, disjoint covering rules,
tier-4 midChange with its banner). No instructions anywhere; wonder-lines only, as
authored in RUN10.
Assertions: headless solve of every puzzle at all four tiers via engine-derived
play; every choreography beat evidenced in frames; budget→star table test; the
guarantees (raft solvability, hotel coverage) proven by seeded simulation; suites
r10p15/r10p16 green; ASSETS complete.

================================================================================
## Q5. P17: Snaffle's First Caper, salvaged and completed
Adopt js/caper/* (notebook.js, state.js) from resume; reconcile to VERSION 12+ and
current contracts; then complete to RUN10 P17 spec, spec winning over salvage.
Verify individually: caper state in save (open/closed, culpritSeed, cluesEarned,
guesses); the five silly signposts rendering ONLY while open, exact copy — Meadow
"→ THE MOON", Beach "NO SPLASHING (much)", Funfair "→ SNAIL RACES", Hilltop "BEWARE
OF SOCKS", Riverside "PUDDLE HQ" — every one reverting on the unmasking sweep; five
suspects Fig, Biscuit, Nutmeg, Pickle, Waffle with pairwise-distinct features
(engine-checked); clue cards +1 per completed learning round capped 3/day, each a
cluesFor predicate in kid-plain copy, envelope-to-notebook animation; the Detective
Notebook with reversible NOT ME flips; ACCUSE with drumroll, first-guess-right = 3
stars and the full unmasking (kazoo honks, sign sweep, picnic ending, L_CAPER_END),
wrong first guess costs nothing and re-arms, second guess = 1 star; the 24h
regeneration card.
Assertions: 200-seed uniqueness-by-clue-4 and pairwise-distinct suspects; sign
presence/reversion frame-diffed per sign; clue cadence day-sim; both guess paths
choreographed in frames; ending plays once; r10p17 suite green.

================================================================================
## Q6. P8 completion + P7 verification: Boo Roll courses and medals
RUN8 adopted courses.js + booroll.js + boorollphysics.js and the game loads. Now
finish P8 to spec: verify data/courses.js contains the three AUTHORED courses with
their exact geometry and pars from RUN10 P8 (Rolling Meadow world 6000 pars
55/70/90; Windy Hill world 7000 pars 70/90/115; Sunset Ridge world 8000 pars
85/110/140, each with its exact segment list, mechanism positions, flag and star
coordinates). Where the adopted data differs from the spec, the SPEC WINS — rewrite
the data. Then: course-select map showing medals and best times; medals feeding
Trophy Room entries First Medal / All Bronze / All Gold granted once; legacy
run9-era records preserved under booRoll.legacy.
Also verify P7's live behaviour now the game loads: uphill refusal, downhill
runaway, all four mechanisms operating under scripted paddle presses with approach
glow, BONK → dizzy → parachute → checkpoint with the clock penalty, camera follow
plus the course-map strip, both screen orientations mapping correctly, the
sensitivity/invert settings, and the drag-puck fallback completing course 1.
Assertions: course data matches the spec values exactly (unit test comparing to a
table in the test file); scripted competent run per course finishes under gold×1.4;
three stars reachable per course; medal thresholds award at pars; trophies once;
r10p7 and r10p8 suites green.

================================================================================
## Q7. P21: the delight pack
Adopt what exists on resume (delights work in js/delights.js and js/town.js) and
complete to RUN10 P21 spec: expedition postcard auto-composed on trail finish
(scenery band + posed party + trail name + 8°-rotated date stamp) saved to the
Studio gallery within caps; dusk visitor with VISITOR_GAP_H=72, a silhouetted
UNOWNED Boo crossing the far background of a random outdoor area over 12s, tap =
one giggle + one sparkle and nothing else ever; best-friend cameo beside the hub
guide only at bond level 5, absent silently otherwise.
Assertions: postcard snapshot contains party sprites and the stamp; cadence honoured
over a simulated month; unowned-only selection; single-tap idempotence; cameo gated
on L5 with a hub screenshot diff otherwise unchanged; r10p21 suite green.

================================================================================
## Q8. The S2 register: F-03, F-04, F-08, F-11
F-03 Echo Lightning best: give Lightning its own save field per RUN10 P11; Standard
best untouched; both shown on the start card. Migration if the field is new.
F-04 Flash Boos hang: diagnose the flash-scene readiness / question-render path in
js/games/flashboos.js until the r10p19 Flash section completes; the fix must make
the GAME right, not the test lenient (G5 applies: if the test asserts something the
P19 spec never promised, fix the test and justify it in PROGRESS.md).
F-08 RECONCILE_REPORT.md is truncated: rewrite it completely from the git history —
the five reconcile commits, the full adopted-file list, and the two overturned
adoptions (booroll.js → F-01, town.js → F-02) with their outcomes. It is the audit
trail for a three-tool reconciliation; make it whole.
F-11 band melody validator: locate it in js/band/; if absent, implement it exactly
per RUN10 P6's binding rules (16 bars × 4 beats = 64; hook bars 1-2 verbatim at 5-6
and 9-10; bpm 112-124; progression ∈ {I-V-vi-IV, vi-IV-I-V, I-vi-IV-V}; ≥25%
off-beat starts; ≥3 durations, ≤4 consecutive equal; hook has a ≥4th leap AND a
≥3-note stepwise run; peak in bars 9-12; ≥2 rests; ≥60% on-beat chord tones; final
note in final chord; range C4-E5; seamless loop) and run all four Boo Pop Hits
through it, logging the pass/fail per rule per Hit in PROGRESS.md. Any Hit that
fails a rule gets recomposed to pass (3 candidates, best by score, all logged).
Assertions: each finding's suite green; the validator's rule-by-rule report present.

================================================================================
## Q9. The S3 register: F-09, F-10, plus the residual board
F-09 orphaned data: data/puzzles.js (PUZZLES) and data/stories.js (STORIES) are
precached but imported by nothing. Check the resume branch and RUN10 for an intended
consumer; if none, delete both files and their ASSETS entries; if one exists, note
it in PROGRESS.md and leave them.
F-10 the lone fetch(): js/gallery.js's share path fetches a data: URL. Add a guard
that throws if the argument is not a data: URL, plus a comment stating the
zero-network invariant, so the grep stays auditable. Add a test asserting the guard.
Residual board: work through every remaining failing suite from the 24-fail baseline
that Q1-Q8 have not already cleared — the wishwell butterfly frames, interiors
furniture-resize persistence, the m3-pwa offline-reload quirk, and the older RUN3-7
suites. G5 governs: fix the product where the product is wrong; fix the test only
where it asserts something never promised, with the reasoning in PROGRESS.md.

================================================================================
## Q10. P22 for real: the full board
Run ./_runall.sh cleanly (single process, per CLAUDE.md's flake note: re-run any
FAIL directly once before believing it). Target: ZERO failures. Report the final
count against the 69/24 baseline and this pack's per-packet deltas. Any suite that
cannot be made green must appear in BLOCKED.md with a repro and an explicit
one-line reason, and be listed in the final summary — an unexplained red suite is a
failed run.

================================================================================
## Q11. P23 for real: the feel pass
Now that the two biggest surfaces work, do the pass RUN10 could never fairly run.
For each of: the world map, each area's scenery, the Boo House, the Gallery, each
band scene, Boo Roll, the Blocks squeeze, each care action, each Expedition puzzle,
the Caper notebook and endings, the Disco floor, Odd Boo Out, Flash Boos, the Bloom
card, the Wish Well, Word Detective — re-read its feel goals and anti-patterns in
RUN10.md, capture fresh frames at all three viewports, and write an honest delight
critique. Make ONLY presentation-level adjustments (timing, easing, scale, sfx,
copy) where a critique honestly fails. No mechanic changes, no new features. Record
before/after frames and the revised critique in PROGRESS.md.

================================================================================
## Q12. Deliverable and handover
Write RUN11_REPORT.md in the repo root (strictly technical, PII-free per G9): the
packet-by-packet outcome table (adopted / completed / built / blocked, with suite
deltas), the final board count, the F-01..F-11 register with each finding's
disposition, the melody-validator report, the delight critiques summary, and a
"remaining known gaps" list for the next run. Update STATE_AUDIT.md's register with
final dispositions rather than leaving it stale. Bump BUILD_STAMP, push, confirm the
live stamp serves, add the final PROGRESS.md row. Close with a ten-line chat summary:
board count, packets completed, anything blocked, and the single thing you would fix
next.

================================================================================
## Out of scope for RUN11 (do not start)
Boo Garage; further capers or expedition trails beyond the shipped templates;
adjective wishes; a second currency; multiplayer; the boo-speak voice glow-up;
profiles for shared devices; any new game not named in this pack. If a packet
tempts you toward one, log the idea in NEEDS_ALEX.md and move on.

# END OF RUN11 PACK
