# CLAUDE.md — Boo Town house law
Read this before touching anything. It applies to every session, every task, every
agent. Where a task brief conflicts with this file, this file wins unless the brief
explicitly says it overrides a named rule.

## What this is
An offline-first educational PWA for children (primary player: 9; a Toddler tier
serves ~3-4), live at https://alexlock27.github.io/Boo-town/ via GitHub Pages from
main. Vanilla HTML/JS/CSS. No frameworks. No build step. ~1MB total.

## Hard laws (never violate, never "temporarily")
- Zero runtime network requests. No fetch/XHR to anywhere, no analytics, telemetry,
  fonts, CDNs, or error reporting. Everything ships in the repo.
- No accounts, no ads, no tracking. All data stays on-device (localStorage save +
  IndexedDB media). Microphone only for the existing opt-in voice feature.
- Kid-safe and gentle: no guilt mechanics. Nothing decays, nothing is sad, nothing
  is lost, nothing punishes absence. Stars never shrink. "Occasional" features are
  hard-capped. Wrong answers are comedy or a soft wobble, never failure states.
- No real-world song melodies (copyright): original compositions only.
- Learning content (word lists, questions, songs, lexicons) is implemented exactly
  as written in briefs — never paraphrased, trimmed, or "improved".
- Never commit secrets, tokens, or personal names. PROGRESS.md, NEEDS_ALEX.md and
  RUN*.md planning docs are gitignored on purpose — keep them so.

## Architecture contracts (use these; do not invent parallels)
- Router: js/main.js `go(name, params)`; screens export
  `mount(container, params, ctx)` returning `{ unmount? }`; register lazily.
- Guide speech: js/guide.js (`createGuideBubble` / `guideLine`); all strings live in
  data/guideLines.js. Speech respects the voice picker and mutes.
- Art: inline SVG via js/art.js render* functions, house "sticker" style. No image
  files, no emoji-as-art in game scenes.
- Trays/tabs: js/drawer.js `createDrawer({tabs:[{id,label,node}]})`.
- Audio: everything routes through js/sfx.js (Web Audio synthesis); obeys the
  independent music/sfx/voice mutes and ducking.
- Save: single localStorage key via js/state.js; ANY schema change = one new
  migration step in `migrate()` + VERSION bump; migrations are lossless. Media in
  IndexedDB via js/idb.js.
- OFFLINE LAW: every new js/ or data/ file must be added to the ASSETS[] precache
  list in sw.js IN THE SAME COMMIT that creates it, or offline silently breaks.
- Performance: transform-only animation; respect the actor/particle caps in
  js/town.js; every animation has a reduced-motion path.

## Working loop (every task)
- Commit AND push at meaningful sub-steps, not just at the end (the PC may be
  switched off at any moment). Small commits, present-tense messages.
- Deploy gate when a task completes: bump BUILD_STAMP → **append a What's New block** →
  push → fetch the live URL → confirm the new stamp serves → update PROGRESS.md
  (gitignored, keep it current so a fresh session can resume from it alone).
  At every RUN's final gate also regenerate PROJECT_STATE.md (`node tools/gen-state.mjs`) and commit it (RUN21F F3).
- WHAT'S NEW IS PART OF THE DEPLOY GATE (RUN17 X4, standing law). Every run that ships a
  child-facing feature appends a block to data/whatsnew.js — `{ version, entries:[{ icon,
  title, blurb, route, params? }] }`, newest FIRST, `version` equal to the BUILD_STAMP it
  ships under. Written for a child, and every `route` must resolve in js/main.js's registry
  (tests/r17x4-whatsnew.mjs resolves them all). A feature the children are never told about
  may as well not have been built — that is the whole reason this rule exists. Never
  advertise anything a grown-up has to switch on.
- Blocked twice on the same step → write a repro to BLOCKED.md and move on. Never
  improvise an alternative design; never idle; never pause to ask permission
  mid-run unless a brief says otherwise.
- Push auth failure → queue commits, keep building, record the exact ask in
  NEEDS_ALEX.md. (The maintainer holds a fine-grained PAT in their password manager.)

## Testing — THE BOARD LAW (amended 2026-07-27; this AMENDED version binds)
The full-board-per-run regime proved too heavy. The regime now is TARGETED:
- **Per packet: `./_runall.sh --smoke` only.** (routes + contrast audit + era migrations
  + `SMOKE_EXTRA="…"` naming the suites for the packets touched. Target under 5 minutes.)
- **Per run-end gate: ONLY THE AFFECTED SUITES.** The suites covering the files that run
  changed, plus their importers/dependents, plus a fixed small core: routing
  (`r12s1-routes`), save/era migration (`r8p1-migrations`), the sw asset manifest
  (`m3-pwa`), one contrast/tap-target check (`r12s4-contrast` or `r12s13-a11y`), and the
  template-leakage guard (`r18a-copyguard`, RUN18A H6 — in the core, and in `--smoke`,
  precisely because the leaks it catches are never in the files you edited).
  **NOT the full board.**
- **After a fix: re-verify ONLY the changed/affected suites, directly.** Never re-run a
  broad board for a small fix.
- **Known flaky suites are flakes on sight**: at most ONE serial re-run to confirm, then
  move on. (Standing examples: rAF/ceremony-paced waits under parallel load — `m2-full`,
  `r3p1-spellboo`, `r10p3-buildmode`, `r6p8-booquest`.)
- **NO full 130-suite board during a run.** One dedicated full-board sweep runs ONCE at
  the very end of the whole programme, after RUN17 ships live, as a standalone job.
- Never edit any file while any suite run is in flight. Report wall time for what you run.
- Budget: no single suite exceeds 120 seconds except @serial frame-evidence suites
  justified in writing in tests/board-serial-baseline.md. Any new suite states its
  expected runtime when added.
- Runner mechanics (unchanged): `./_runall.sh` shards across N worker lanes (default 3,
  auto 4 on 8+ cores, `--workers N`) balanced by tests/lib/board-durations.json, then runs
  the `@serial` set alone at the end; `--serial` forces one-at-a-time.
- **PRE-MERGE SMOKE (RUN21F F10): `tests/walk.mjs`.** Before any branch merges to main,
  run the walk: `BASE=http://127.0.0.1:PORT node tests/walk.mjs`. It walks every area and
  every room at 1024x768, 768x1024 and 390x844 for ten minutes total with the error hooks
  armed (console, pageerror, window.onerror, unhandledrejection, non-aborted request
  failures), screenshots every stop to `_evidence/walk/<date>/`, and exits non-zero on any
  one of them. `WALK_MIN=n` shortens it while iterating. It is minutes long by design, so
  it is NOT a board suite — `walk` is an excluded prefix in `_runall.sh` and it runs alone.
- New tests join tests/ so the glob finds them; avoid the excluded prefixes shoot,
  sim-blocks, device-qa, walk.
- Pitfalls: seed saves in a FRESH browser context (live autosave overwrites seeds);
  hub fixtures need `ageAsked:true`; frame-sampling suites can flake under batch
  load — re-run a FAIL directly once before treating it as real.
- Evidence standards: motion is proven by 6+ frames spanning 3+ seconds (stills
  fail even if logic passes); audio behaviour by instrumentation logs; screenshots
  at 1024x768, 768x1024 and 390x844.
- Phones: layout changes are CSS-first inside the ≤600px media queries; tablet
  screenshots must stay pixel-identical or the change is reverted and logged.

## Quality bar
Working-but-dead is a FAIL. Features carry feel goals in their briefs; iterate
against them and write an honest delight self-critique with before/after frames in
PROGRESS.md. Every game teaches itself: first-play intro (3 short steps, skippable)
plus a "?" replay in the shell. No screen shows more than 8 primary option buttons
at phone width. Empty and first-run states are part of every screen: warm one-line
guide copy + the single most useful action, never a bare blank.

## Experience laws (2026-07-27)

- **Engine reuse.** Every Build Pack states, per feature, which existing
  engine/system it reuses (music: sfx/band/beat-groove · seating & poses: sockets ·
  speech: guide/tts · trays: drawer · placement: town grammar · adaptivity:
  comfort/ledger) — or a one-line justification why none fits. An executor who
  finds an unlisted parallel system mid-build logs it to BLOCKED.md rather than
  building a second one.
- **No dead props.** Every NEW placeable ships with at least one of: a socket, a
  tap reaction, an idle animation, a surface slot, or a scheduled moment. A pack
  adding items lists each item's verb. Scenery sold as a toy is a defect.
- **Continuity.** A continuous experience (music, dancing, weather, wandering) is
  implemented continuously — no N-second silences or freezes between samples of
  it. If a performance loop already exists, use it. "One event per bar" patterns
  need explicit sign-off in the pack.
- **Announced moments.** A state change the child caused or would care about (a
  purchase, a wish, a socket claim, a nap, a milestone) lands as a witnessed
  moment — motion + a line + a place to look — never solely as a toast, a drawer
  entry, or silent state.
- **Curriculum mapping.** Every lesson or learning-content pack maps its hardest
  item to the National Curriculum appendix line it serves, in the pack itself.
  Levels named for a tier deliver that tier.
