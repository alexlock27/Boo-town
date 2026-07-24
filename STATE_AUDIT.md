# STATE_AUDIT.md — Boo Town main-branch audit

Audit of `main` at stamp `run10-final-20260724`. Evidence-based (static anchors, the
`tests/` assertion suites, a headless console-error smoke, and git archaeology). This
document is strictly technical and contains no personal data. "SHIPPED-TO-SPEC / PARTIAL
/ MISSING" verdicts are against the RUN10 Build Pack; severities are S1 (broken) / S2
(weak or off-spec) / S3 (polish); effort is S/M/L.

Method note: a static HTTP server + Playwright (chromium) were used. The 13 RUN10 packet
suites in `tests/` plus a 35-route console-error smoke were run against the live tree.
Two runtime regressions (F-01, F-02 below) break town/area rendering and Boo Roll, which
also blocks fair motion-evidence capture for those surfaces — noted where it applies.

---

## 1. Prioritised findings register

| ID | Sev | Effort | Finding | One-line fix direction |
|----|-----|--------|---------|------------------------|
| F-01 | S1 | M | **Boo Roll is fully dead.** `js/games/booroll.js:9` statically imports `{ COURSES, getCourse }` from `data/courses.js`, which does **not exist on main** (404). Boo Roll is lazy-loaded (`main.js:30`), so the dynamic import rejects → the whole game fails to mount, online and offline. No fallback `COURSES`/`getCourse` is defined anywhere. Confirmed by `r10p7-booroll2` (times out on `.roll2-start`) and the console smoke (404 + "Failed to fetch dynamically imported module"). `e8ec1e3` removed `courses.js` from the sw.js ASSETS manifest but left the import — a band-aid that masked the manifest symptom, not the break. | Restore `data/courses.js` and re-add it to `sw.js` ASSETS. NB: the resume branch's `courses.js` exports only `COURSES` (keyed by `.key`) and drops `getCourse`; its `booroll.js` was rewritten to match — adopt the two as a **pair**, or add a `getCourse` export. |
| F-02 | S1 | S | **Town/area rendering throws `ReferenceError: clearRarityFx is not defined`.** `js/town.js:693` calls `clearRarityFx(wrap)` but the import at `js/town.js:26` is `{ applyRarityFx, rarityRank, RARITY_TOWN_CAP }` — `clearRarityFx` is omitted. Reconcile commit `0a96d5e` added the call without the import. Throws inside the town render loop when an item's rarity fx must be cleared, aborting area-scenery rendering. Confirmed by console smoke (`town` route pageerror) and cascades through most town-touching packet suites (P1–P5, P12, P13, P20). | Add `clearRarityFx` to the `./rarityfx.js` import list in `js/town.js:26` (the function is already exported from `js/rarityfx.js:22`). |
| F-03 | S2 | S | **Echo Boos Lightning best is not stored separately from Standard.** `r10p10-p11` confirms Lightning uses its 330/200 pace correctly, but "Lightning best persists separately and does not overwrite Standard" fails — the Lightning best-streak shares/overwrites the standard field. | Give Lightning its own save field per the P11 spec; keep Standard best untouched. |
| F-04 | S2 | S/M | **Flash Boos assertion hangs.** `r10p19-brain`: Odd Boo Out and Brain Bloom pass every assertion, but the Flash Boos section times out on a `waitForFunction` — the flash scene/question flow never reaches the awaited state. | Investigate the flash-scene readiness / question-render path in `js/games/flashboos.js`. |
| F-05 | S2 | S | **P9 (Word Detective GO key + tile badges) is absent on main.** No `goKey`/`.det-go`/`go-ready` in `detective.js`/`styles.css`; `L_WD_GO` missing from `guideLines.js`. The feature exists only on `codex/run10-resume`. | Adopt the P9 detective + CSS changes; add `L_WD_GO` to `guideLines.js`. |
| F-06 | S2 | L | **P14 attribute engine on main is the P19-flavoured engine, not the P14-spec API.** `js/attrengine.js` exports `oddGrid`/`flashScene`/`flashQuestion` etc., **not** the specified `partition`/`genRule`/`genExclusiveRules`/`cluesFor`/`informativeNext`. The full-spec engine and its consumers (P15/P16 expedition, P17 caper) are absent on main (present, and higher-quality, on `codex/run10-resume`). | Adopt the resume attrengine + expedition + caper set (see §6). |
| F-07 | S2 | M | **Child PII on a public site.** Real children's first names and an explicit age string are committed across `js/birthdayparty.js`, `data/catalogue.js`, `js/state.js` (save keys + VERSION comment) and `css/styles.css`, and are served live via GitHub Pages. This appears to be **intentional personalised content** (a birthday-gift feature), so it is flagged for a maintainer decision rather than unilaterally rewritten. | If neutralisation is wanted: rename identifiers/keys to neutral tokens and neutralise display copy, with a **lossless v12 save migration** mapping `birthdayParty.opened.*` and the two `boo_birthday_*` inventory ids. Out of this audit's product-scope. |
| F-08 | S2 | S | **`RECONCILE_REPORT.md` is truncated.** It begins at "## 3", has no §1–2 and no explicit adopted-file list, weakening the reconcile audit trail (the real adoption set had to be reconstructed from the five `reconcile(antigrav)` commits). | Restore/rewrite the report with the full adopted-file list and rationale. |
| F-09 | S3 | S | **Orphaned data files.** `data/puzzles.js` (`PUZZLES`) and `data/stories.js` (`STORIES`) are precached in `sw.js` ASSETS but imported by nothing — dead weight in the offline bundle. | Remove both files + their ASSETS entries, or wire the intended consumer. |
| F-10 | S3 | S | **Only `fetch()` in app code is `js/gallery.js:41`** (`await fetch(a.png)` where `a.png` is a `data:` URL used to build a Blob for share/download). No network egress, so it honours the zero-network law, but it is the sole `fetch()` in `js/` and reads as a hazard in a grep. | Add a guard/comment asserting the argument is always a `data:` URL, to keep the zero-fetch invariant auditable. |
| F-11 | S3 | M | **P6 band melody-validator unverified.** Band scenes ship and `r10p6-bandscenes` passes, but the binding 16-bar/hook/progression validator described in P6 was not located in `js/band/`. | Confirm the validator exists (or add it) and log a candidate-scoring pass per spec. |

Net: **2 S1** (both reconcile-introduced regressions), **6 S2**, **3 S3**. The two S1s
mean the tree is **not** all-green despite the "run10-final" stamp.

---

## 2. Packet conformance (P0–P23)

Evidence keys: `anchors` = named constants/copy/symbols grep-verified against RUN10;
`suite` = `tests/r10*.mjs` result; `absent` = not on main (present on `codex/run10-resume`).

| Packet | Verdict | Evidence / gaps |
|--------|---------|-----------------|
| P0 Delivery audit | SHIPPED | `tests/audit_run9.md` present (tracked). |
| P1 World map + areas | SHIPPED-TO-SPEC (code) / runtime-blocked | `AREA_W_VIEWPORTS=4`, 8 `AREAS` with exact keys + thresholds `40/100/180`, `MAP_POS`, `L_MAP_LOCKED`/`L_PLAYGROUND_NEW`. `r10p1` **FAILS** solely via F-02 (scenery not rendered). |
| P2 Sockets/capacity/drawer | SHIPPED (code) / runtime-blocked | `AREA_CAP=24`; `data/sockets.js` `deco_seesaw` etc. exact; `L_AREA_FULL`. `r10p2` fails via F-02 (+ a `deco_bench` seat-gap 28px that can't be trusted until F-02 is fixed). |
| P3 Build mode/paths/fishing | SHIPPED (code) / runtime-blocked | build mode, path brush, landscape kinds, `FISH` + comedy-boot, `L_PATH_FULL`. `r10p3` fails via F-02. |
| P4 Interiors (House + Gallery) | SHIPPED (code) / runtime-blocked | `js/gallerymuseum.js` route; furniture kinds; `L_NOT_INDOORS`/`L_NOT_OUTDOORS`/`L_GALLERY_SEED`. `r10p4` fails via F-02. |
| P5 Personalities + hide 2.0 | SHIPPED (code) / runtime-blocked | `PERSONALITIES` (6) + all six catchphrases verbatim; `hidePoints`. `r10p5` fails via F-02 ("one repeated ghost" is a likely render-abort artifact). |
| P6 Band scenes | SHIPPED (validator unverified) | `js/band/*` (7 files); `r10p6` **PASSES**. Melody-validator not located → F-11. |
| P7 Boo Roll physics | PARTIAL → **BROKEN** | Constants exact (`GRAV=0.55`,`SENS=0.85`,`FRICTION=0.985`,`BOUNCE=0.45`,`MAX_SPEED=15`,`BONK_IMPACT=11`) and all four mechanisms present, but the game does not load (F-01). |
| P8 Courses + medals | **MISSING** | `data/courses.js` absent on main (on resume). Directly causes F-01. |
| P9 Word Detective GO | **MISSING** | F-05. |
| P10 Blocks squeeze | SHIPPED | `BAG_TIERS` present; `L_BLOCKS_SQUEEZE`; squeeze/boost flow. |
| P11 Echo pace + UK voices | PARTIAL | Pace constants exact (`BASE_GAP=440/250/32`, `LIGHTNING 330/200`, Toddler untouched); **Lightning best persistence bug** (F-03). |
| P12 Boo Care | SHIPPED (code) / runtime-blocked | `POCKET_CAP=5`, `LEVELS=[0,10,25,45,70]`, `POINTS.feed=4`; `L_CARE_NOTREATS`/`L_CARE_BFF`. `r10p12` fails via F-02 (care tap enters town render). |
| P13 Costumes/slots | SHIPPED (code) / runtime-blocked | hat/face/feet slots; Police/Builder/Chef/Explorer sets; rollerskate `glide`/welli `stomp`. `r10p13` fails via F-02 (glide locomotion null = render-abort artifact). |
| P14 Attribute engine | PARTIAL (off-spec) | Engine present but P19-flavoured, not the P14 API (F-06). |
| P15 Expedition shell | **MISSING** | no `js/expedition/`, no `data/expedition.js`, no `L_EXP_*` (on resume). |
| P16 Expedition puzzles | **MISSING** | absent (on resume). |
| P17 Snaffle caper | **MISSING** | no `js/caper/`, no `L_CAPER_END` (on resume). |
| P18 Disco Hall | SHIPPED | 6×4 tiles (`length:24`), personality→move map, `choreographer.js` import; `r10p18` **PASSES**. |
| P19 Brain pack | PARTIAL | Odd Boo Out + Brain Bloom SHIPPED (bloom's 5 petals + display names exact; negative-lexicon guard clean; assertions pass). **Flash Boos** assertion hangs (F-04). |
| P20 Wish Well | SHIPPED-TO-SPEC (code) / runtime-blocked | `WISH_WORDS` = the exact 60-word lexicon; `LIVING_WISHES=[butterfly,fish,frog]`; `L_WISH_OPEN`/`L_WISH_NEARLY`. `r10p20` fails via F-02 (well renders in the meadow scene). |
| P21 Delight pack | **MISSING** | dusk visitor / postcard / best-friend cameo absent on main (on resume). |
| P22 Full regression | **NOT MET** | board is not green — F-01/F-02 cascade + F-03/F-04. |
| P23 Feel pass | UNVERIFIABLE | presentation polish cannot be fairly judged while F-01/F-02 break the two biggest surfaces. |

Shipped-on-main packets: P0,P1,P2,P3,P4,P5,P6,P10,P12,P13,P18,P20 (code-complete),
P11/P19 partial, P7 present-but-broken, P14 off-spec. Absent on main (live only on
`codex/run10-resume`): P8, P9, P15, P16, P17, P21.

---

## 3. Adoption re-verification (the 28 Antigravity adoptions)

The 28 adopted files were reconstructed from the five `reconcile(antigrav)` commits
(`70f6dc4`, `67ba6c2`, `0a96d5e`, `44b0566`, `642202f`) plus the release commits
(`e641c7e`, `e8ec1e3`). Each re-checked against the CLAUDE.md conformance gate.

| Reconcile group (files) | Verdict | Note |
|---|---|---|
| Game mechanics — `beat, booroll, bubblepop, detective, feedboos, flashboos, oddboo, spellboo, teachme` | MOSTLY CONFIRM; **OVERTURN `booroll.js`** | `oddboo.js` gains a real wrong-tap lockout (fixes audit F1-A); `detective.js` gains a hardware-keyboard handler (fixes F1-C). But `booroll.js` retains a static import of the excluded `courses.js` → F-01. |
| Economy/state — `ceremony, collection, rewards, state` | CONFIRM | Duplicate→box economy loop is closed: duplicates grant `stardust` (`rewards.js:141`), `DUPLICATE_POINTS` removed, `state.js` adds `stardust`/`shinies` (fixes audit F1-B/F2-B). Save-safe. |
| Town/hub — `gallerymuseum, hub, main, town, ui, worldmap` | **OVERTURN `town.js`**; rest CONFIRM | `town.js` introduces F-02 (`clearRarityFx` call without import). Others clean. |
| Hardware IO — `art, care, gallery, paint, sfx, speller, wishwell` | CONFIRM (one note) | `paint.js` adds `devicePixelRatio` scaling (fixes F1-F); `wishwell.js`/`speller.js` add keyboard handlers; `gallery.js` share path uses `fetch()` on a `data:` URL only → see F-10. |
| Styling/caching — `css/styles.css, index.html` | CONFIRM | Presentation-only; no gate impact. |
| Release — `e641c7e` (tests/sw/changelog/reconcile), `e8ec1e3` (sw) | **OVERTURN `e8ec1e3`** | Removing `data/courses.js` from ASSETS treated the manifest symptom while leaving `booroll.js`'s import dangling (F-01). |

**Conclusion:** Antigravity's self-approval was mostly justified and its fixes closed
several *real* audit findings — but it missed **two self-inflicted S1 regressions**
(`town.js` F-02, `booroll.js`/`e8ec1e3` F-01). The "self-approved, unverified" suspicion
is vindicated: 26/28 sound, 2 broken and shipped.

---

## 4. Health sweep

- **Test board (`./_runall.sh`, full):** **PASS=50, FAIL=38** (88 suites after the
  `shoot`/`sim-blocks`/`device-qa` exclusions). The failure set is dominated by the two
  S1 regressions: ~14 of the fails are town-rendering suites cascading from F-02
  (`r10p1/p2/p3/p4/p5/p12/p13/p20`, `p3-town`, `r4p5-town`, `r5p4-town`, `r6p1-town`,
  `r7p2-zones`, …) and 2 are Boo Roll via F-01 (`r9p4-booroll`, `r10p7-booroll2`);
  `r10p10-p11` (F-03) and `r10p19-brain` (F-04) fail independently. Passing RUN10 packet
  suites: `r10p6-bandscenes`, `r10p18-disco` (+ `birthday-twins`). A residue of the fails
  are frame-sampling suites (`r4p10-phone`, `r5p5-phone`, `r6p9-perf`, `r7p4-toddler`,
  `m3-pwa`, …) that CLAUDE.md flags as batch-load-flaky and that warrant a direct re-run
  before being treated as real; the 38 is therefore an upper bound, but the town/Boo Roll
  core is a genuine, deterministic break. **Bottom line: the tree is not all-green.**
- **sw.js ASSETS completeness:** **clean** — 102 `js/`+`data/` files on disk, 102
  precached, 0 missing, 0 stale. (`e8ec1e3` already removed the phantom `courses.js`
  entry; note the offline gap is now F-01's missing *file*, not a manifest miss.) No
  ASSETS additions were needed this session.
- **Save-migration chain (`js/state.js`):** **lossless.** `migrate()` is convergent
  (shape-detection + `deepDefaults` over `freshSave()`), idempotent and robust to partial
  states rather than a strict per-version chain; covers v1→v11 with no dead branches; new
  v9–v11 objects (care/bonds/birthdayParty) default in without loss. `VERSION=11`.
- **Zero-network grep:** **clean** across `js/` except `gallery.js:41` (`data:` URL, no
  egress → F-10). No CDN/font/analytics/XHR/WebSocket references anywhere.
- **Privacy grep (all tracked files):** child PII in the birthday feature (F-07);
  incidental references sanitised this session (see §7). `data/puzzles.js` "Mum/Nan" are
  generic maths-problem characters, not personal data.
- **Contract adherence (files since `6094b17`):** **clean.** All new router screens
  (`worldmap, gallerymuseum, discohall, band/*, oddboo, flashboos, birthdayparty`) export
  `mount()` and are registered in `main.js`; `wishwell`/`care` correctly use the
  drawer/overlay pattern (not routes). Guide speech goes through `guideLine`/
  `createGuideBubble`; no raw-innerHTML-SVG, `new Image`, or emoji-as-art violations.
- **Orphan scan:** `data/puzzles.js`, `data/stories.js` (F-09). All other `js/`+`data/`
  files are imported/routed.
- **Console-error smoke (35 routes):** **33 clean, 2 dirty** — only `town` (F-02) and
  `booroll` (F-01). Every other route loads without console/page errors.

---

## 5. Per-screen sweep (phone width 390×844)

Automated: primary-button-like element count and horizontal-overflow per route.

- **Horizontal scroll:** **none** on any of 19 sampled routes (`scrollWidth ≤ viewport`).
  A clean pass on the CLAUDE.md "no horizontal scroll at phone width" rule.
- **8-button rule:** the raw element counts exceed 8 on `hub` (28), `collection` (39),
  `paint` (31), `grownups` (25), `oddboo` (19), `bubblepop` (15), `worldmap` (13). These
  are dominated by **non-option** elements — gameplay grids (the Odd Boo Out / Flash Boos
  Boo tiles are the puzzle), collectible tiles, tool/colour palettes, settings toggles,
  and the scrolling launcher — not "primary option buttons" on a start card. Run 10's
  "tidy sweep" reportedly enforced the 8-rule on busy start cards; the counts here do not
  contradict that. A precise primary-option-button audit needs per-screen classification
  and is left as a manual follow-up.
- **First-run / empty states:** the guide-line anchors for empty states are present in
  code (`L_GALLERY_SEED`, `L_PLAYGROUND_NEW`, Wish Well/care first-tap lines).
- **Motion evidence:** full 6-frame motion capture per screen was **not** completed this
  session. F-01/F-02 block the town/area and Boo Roll surfaces outright; the working
  surfaces (band, disco, games) load clean but were not exhaustively frame-sampled.

---

## 6. `codex/run10-resume` assessment (read-only — nothing adopted)

Diverged branch: `git diff origin/main...codex/run10-resume` = **75 files, +2802/−556**
(the P7–P21 work). Crucially, `origin/main..codex/run10-resume` shows main carries a v11
"birthday" line that resume does not — **resume is `VERSION 7`, main is `VERSION 11`**. A
branch **merge would downgrade the save schema 11→7 and revert main's birthday feature —
destructive.** All recommendations below are **selective cherry-pick only.**

| Area (packet) | Quality vs spec | Gate | Recommendation | Conf |
|---|---|---|---|---|
| `data/courses.js` + rewritten `js/games/booroll.js` (P8) | Courses exact (C1/C2/C3 worlds 6000/7000/8000, pars 55·70·90 / 70·90·115 / 85·110·140; schema, 3 stars/2 flags/finish, four mechanism types). | zero-net ✓, kid-safe ✓ | **ADOPT-WITH-FIXES** — adopt as a **pair** (resume drops `getCourse`, keys by `.key`; main's importer uses `getCourse`+`.id`). This is the fix for F-01. | high |
| Word Detective GO (P9) `detective.js`+CSS | `goKey`='det-key wide det-go', `go-ready` toggle, `.det-go`/`goPulse`, `.det-tile.green::after '✓'`/`.orange '•'`, reduced-motion. | ✓ | **ADOPT-WITH-FIXES** — add `L_WD_GO` to `guideLines.js` (copy is inlined; 2nd line missing). | high |
| `js/attrengine.js` (P14) | Full spec API present and correct: `features/featuresOf/partition/genRule/genExclusiveRules`(real exact-cover solver)`/cluesFor/informativeNext`. DOM-free, deterministic. | ✓ | **ADOPT** — highest-quality file in the set. | high |
| `js/expedition/*` + `data/expedition.js` (P15/P16) | Party picker 8–12 with variety top-up; 4 nodes named exactly; budgets exact (`sneezes[6,6,8,8]`,`huffs[5,6,7,8]`,`failedSails[3,4,4,5]`,`wrongRooms[6,8,10,10]`); discovery-only, wonder-lines ≤9 words, comedy-wrong, hint via `informativeNext`. | ✓ (routes/art/ui contracts met; defensive save writes) | **ADOPT-WITH-FIXES** — add `L_EXP_GUESTS/HINT/SNAFFLE`; copy is inlined. | high |
| `js/caper/*` (P17) | 5 signposts verbatim; suspects Fig/Biscuit/Nutmeg/Pickle/Waffle; `cluesFor`; notebook + ACCUSE; `L_CAPER_END` copy present inline; 3/day cap (lives in `results.js`). | ✓ kid-safe (no penalty) | **ADOPT-WITH-FIXES** — add `L_CAPER_END` constant. | high |
| Delights (P21) `delights.js` + `expedition/postcard.js` + hub cameo | Dusk visitor exact (`VISITOR_GAP_H=72`, unowned-only, single-tap idempotent); best-friend cameo at bond `70` (=level 5); postcard composed on an offscreen canvas via `data:` SVG (no upload). | zero-net ✓ (`data:` only), kid-safe ✓ | **ADOPT** | high |

Two systematic deviations across the resume work: (a) the `L_*` guide-line constants were
never added to `data/guideLines.js` (copy is inlined via `shell.react`/`textContent`), and
(b) `data/courses.js` lacks the `getCourse` export the P8 contract names. Both are small
fixes. **Overall: ADOPT-WITH-FIXES via selective cherry-pick — never a branch merge.**
Do not delete or force-push this branch.

---

## 7. Cross-check of the two prior audit files

The two `AUDIT_23.07.26*` files (Antigravity live-runtime + AI-Studio) cited a
`Boo-town - Backup` tree. Against ground truth on main:

- **Right, and since FIXED:** Odd Boo Out no-lockout exploit (F1-A) → lockout added;
  end-game duplicate→box economy loop (F1-B/F2-B) → duplicates now grant stardust; Retina
  paint blur (F1-F) → `devicePixelRatio` scaling added; no hardware keyboard (F1-C/F2-A)
  → `keydown` handlers added in detective/spellboo/wishwell. The audits correctly
  identified real defects that the reconcile then closed.
- **Off-spec / outdated:** "Boo Roll should be a 3-floor vertical DK-style maze" (F1-P0-1)
  contradicts the RUN10 P7/P8 spec, which is explicitly a **side-view tilt roller**;
  ironically Boo Roll is now broken for an unrelated reason (F-01).
- **Unverifiable from main (render-blocked by F-02):** "Teach Me void" (F1-P0-2) and
  "Gallery Museum question-marks" (F1-P0-3) describe a pre-P4 state; `gallerymuseum.js`
  was rebuilt in P4, but a clean visual re-verification is blocked while F-02 aborts town
  render.
- **Internal inconsistency:** the "synthesis" file lists many findings (town flatness,
  WCAG, delta-time, SVG escaping) **not present** in the AI-Studio source it claims to
  synthesise, and both used stale economy math (52 items vs the current 70). Treat the
  synthesis file's extra findings as lower-confidence.

---

## 8. Housekeeping performed this session (PART 1)

- `git pull --ff-only origin main` (after pruning a corrupt local `refs/codex/turn-diffs`
  checkpoint ref that blocked fetch).
- Copied working-state docs DONOR→HOME (PROGRESS.md, NEEDS_ALEX.md byte-identical no-ops;
  two audit files copied fresh); added them + BLOCKED.md to `.gitignore` (leak-prevention).
- Committed the CLAUDE.md house law; deleted remote branches `antigrav-fixes` (had pushed
  gitignored private docs publicly) and `codex/run10-recovery` (a strict ancestor of main).
  `codex/run10-resume` left untouched.
- Integrity sweep (SHA-256, exclusions applied): **clean** — only expected deltas
  (`FULL_PROJECT_CONTEXT.txt` donor dump, resume-only `data/courses.js`, this-session
  `CLAUDE.md`/`.gitignore`). DONOR renamed to `Boo-town - Backup - SAFE TO DELETE`.
- Sanitisation (allowed): neutralised incidental maintainer-name/PAT prose in CLAUDE.md
  and the sw.js build-stamp comment; untracked the accidentally-public `RUN4.md`. The
  deeper birthday-feature PII is F-07 (out of product-scope).
