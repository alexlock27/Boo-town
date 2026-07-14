# P0 delivery audit — truth table before RUN10 fixing begins

Verdict key: **BUILT** = fully realized with real specified motion/juice · **FLATTENED** = exists but
thin, missing specified motion/juice/layout · **MISSING** = not found. Evidence = file+symbol or a
captured/observed behaviour. Source: NEEDS_ALEX.md + CHANGELOG.md (shipped-state context) + live grep
of the repo at commit 6094b17. Fixes nothing; RUN10 packets below fix/extend anything not BUILT.

## RUN9 brief items (Part D acceptance checks, RUN9.md)

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Tidy sweep: drawer (Paint/Collage), 8-button rule on 3 worst offenders | BUILT | `js/drawer.js` `createDrawer()`; Paint Tools/Colours/Stamps tabs, Collage 8 tabs; PROGRESS.md run9-phase1 button-count audit table (11 screens still >8, logged BACKLOG — those are P2's drawer work for Town, not a run-9 gap) |
| 2 | Blocks: sim-justified bands, combos/cascade/all-clear, Boost economy, best-score celebrate | BUILT | `js/games/blocks.js` `starsForBlocks`, `SPECIAL_ORDER`, `boostAwardIdx`; `tests/sim-blocks.mjs`; `window.__blocks` (blocks.js:185) — but RUN10 P10 spec (BAG_TIERS, squeeze pressure UI, tuning to specific medians) is NEW work, not yet present — verified absent by grep for `BAG_TIERS`/`squeeze` in blocks.js: no match |
| 3 | Word Detective: truth-table colouring, mash+giggle, hint caps stars, 90-word lists | BUILT | `js/games/detective.js` `scoreGuess`, `window.__detective` (detective.js:136); `tests/r9p3-detective.mjs`. RUN10 P9's specific `goKey`/`go-ready` CSS pulse + green/orange `::after` badges: grep for `go-ready` and `det-go` in detective.js/styles.css — NO MATCH, so that presentation layer is not yet built |
| 4 | Boo Roll: orientation physics, calibration, drag fallback, holes/flags, medals | BUILT (top-down variant) | `js/games/booroll.js`, `window.__booroll` (booroll.js:135/169/362); `tests/r9p4-booroll.mjs`. RUN10 P7/P8 replace this with a SIDE-VIEW physics rebuild (GRAV/slopes/mechanisms/3 new authored courses) — current implementation is top-down (FW/FH/SENS/FRICTION/LOWPASS per RUN10 anchors), confirmed still top-down by grep: no `slope`/`mechanism` tokens in booroll.js |
| 5 | Echo Boos: sequence grows, mercy-replay, sound-off playable, Toddler cap | BUILT | `js/games/echoboos.js`, `window.__echo` (echoboos.js:97); `tests/r9p5-echoboos.mjs`. RUN10 P11 retunes pacing consts (BASE_GAP 640→440 etc.) + adds Lightning toggle — grep confirms current BASE_GAP=640/MIN_GAP=360/GAP_STEP=26 (pre-P11 values), no `Lightning` token found |
| 6 | Band 2.0: 3-layer jam, xylophone 4th Boo, Little Songs + Golden Boo verbatim, 4 Hits pass validator, Beat uses Hits | BUILT | `js/band.js`, `data/songs.js`, `tests/lib/melody.mjs`, `tests/r9p6-band.mjs`; PROGRESS.md RUN9-phase6-addendum logs candidate scores + winners' full sequences. RUN10 P6 SPLITS this into `js/band/*` scene files (bandroom/drums/keys/guitar/xylophone/songs/jams) with a new sparkle-lane-in-flow layout + bbox-overlap tests — current band.js is a single-file screen, confirmed by `ls js/band.js` (no `js/band/` directory yet) |
| 6b | Voice picker: local-first English voices, preview, persists, hides gracefully | BUILT | `js/voices.js`, `window.__voice` (voices.js:134); `tests/r9p7-garnish.mjs`. RUN10 P11 narrows to en-GB only + adds the "install the voice" tip line — grep confirms current filter is broader (`English` not `en-GB`-only) |
| 7 | Garnish: vibrate patterns gated by toggle, shake-shuffle once/round | BUILT | `js/haptics.js`; `tests/r9p7-garnish.mjs` |
| 8 | Every new game has 3-step intro + "?" replay; full regression + fresh motion pass | BUILT | PROGRESS.md RUN9 phase 8: 74/74 serial regression, audit 16/16 fresh motion pass |

## Older features (pre-RUN9), named in RUN10.md P0 step 1

| Feature | Verdict | Evidence |
|---|---|---|
| Dance Choreographer | BUILT (as placed-item feature, not a standalone screen) | `js/choreographer.js` `openChoreographer()`, `window.__choreo` (line 90); 8 `MOVES`, `MAX_MOVES=8`, live preview loop, saves to `state.routines[stageKeyOf(place)]`. Opened from Town's stage-item popover (`town.js:1219`, guarded `deco==='stage'`), NOT in the `js/main.js` router registry — no dedicated route. RUN10 P18 (Disco Hall) restores it as wall posters that trigger synced routine playback — current code has no Disco Hall integration (grep `discohall` in choreographer.js/town.js: no match) |
| Parade | BUILT, real choreography | `js/town.js:340-376` `startParade()`/`stepParade()` — actors get `.parading` state, move across-screen, confetti bursts; triggered by "Parade 🎺" placed-Boo menu button (town.js:1221) with `sfx.fanfare()`. Debug hook via `window.__townDebug` (paradeUntil/parading count, town.js:1765). No reward attached (by design, per inline comment) |
| Daily hide-and-seek | BUILT, complete with found celebration | `js/delights.js:16-55` `ensureHide()` (once/day, random owned+placed Boo behind random scenery item), `foundHide()` (HIDE_REWARD=2). Render/tap in `js/town.js:299-338` `renderHide()` — peeking-ears sprite, confetti + toast on find. RUN10 P5 replaces this with hidePoints-based peek sprites across 7 item types + a world-map 👀 badge chip spanning ALL areas — current hider is single-area/single-item-class, confirmed by grep: no `hidePoints` token in delights.js/sockets equivalent (data/sockets.js does not exist yet — new in RUN10 P2) |
| Run-7 hub items (Today rail; Jump Back In manners) | BUILT, all 3 manners confirmed | `js/hub.js:111-153` `jumpbackAllowed()` checks `seen.lastPlayDay!==today` AND `seen.jumpbackDismissedDay!==today`; `results.js:42` stamps `lastPlayDay` on every non-golden round finish; hub.js `.tc-x` handler stamps `jumpbackDismissedDay`. No stale chip after completing the suggestion (same stamp path). Test hooks `window.__hub.jumpbackShown()/dismissJumpback()` (hub.js:296-301) |

## Existing QA/debug hooks found (window.__*)

Named in the packet: `__dash` (dash.js:320), `__beat` (beat.js:326), `__bounce` (bounce.js:462),
`__blocks` (blocks.js:185), `__teachme` (teachme.js:152), `__detective` (detective.js:136),
`__bootownHour` (read at town.js:127, override pattern at state.js:220).

Further hooks found (not named in the packet, listed for RUN10 packet authors' use): `__townLife`
(town.js:1778, actor/behaviour QA), `__townDebug`/`__town` (town.js), `__choreo` (choreographer.js:90),
`__build` (buildaboo.js:82), `__band` (band.js:420), `__booquest`/`__booQuestion` (booquest.js),
`__collage` (collage.js:250), `__golden` (golden.js:49), `__boopop` (boopop.js:500), `__paint`
(paint.js:382), `__feedboos` (feedboos.js:280), `__hub` (hub.js:296), `__booroll` (booroll.js:135/169/362),
`__clock` (clockshop.js:205), `__dashCorrect` (dash.js:154), `__intro` (intro.js:140),
`__forceCustomDrop`/`__forceRoll` (rewards.js), `__lastCredit` (results.js:196), `__spell`
(spellboo.js:269), `__echo` (echoboos.js:97), `__bubblepop` (bubblepop.js:298), `__rescue`
(trickypile.js:133), `__voice` (voices.js:134), `__toddler` (toddler.js:269), `__forceShiny` (shiny.js:25).

## Summary for the orchestrator

Every RUN9 acceptance item and every named older feature is **BUILT** at its own (pre-RUN10) spec —
RUN9 shipped clean. RUN10's packets are not fixing gaps in RUN9; they are net-new builds/rebuilds
(Town 4.0 world map, side-view Boo Roll physics, Band scene-split, personality-driven hide-and-seek,
Detective GO-key polish, Blocks squeeze economy, Echo pacing retune) layered on top of a solid base.
No packet in this pack should be skipped on the assumption its target already exists in final form —
each "verify anchors" step below found the RUN10-specific constants/functions absent, confirming real
build work is needed, not just wiring.
