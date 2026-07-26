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
- Deploy gate when a task completes: bump BUILD_STAMP → push → fetch the live URL →
  confirm the new stamp serves → update PROGRESS.md (gitignored, keep it current so
  a fresh session can resume from it alone).
- Blocked twice on the same step → write a repro to BLOCKED.md and move on. Never
  improvise an alternative design; never idle; never pause to ask permission
  mid-run unless a brief says otherwise.
- Push auth failure → queue commits, keep building, record the exact ask in
  NEEDS_ALEX.md. (The maintainer holds a fine-grained PAT in their password manager.)

## Testing — THE BOARD LAW (RUN14 U-0, binding on every future run)
- Board: `./_runall.sh` — SHARDED: N worker lanes (default 3, auto 4 on 8+ cores,
  `--workers N`) balanced by tests/lib/board-durations.json, then the `@serial` set
  (frame-sampling, audio-timing, device-simulation suites, tagged `// @serial` in
  their headers) runs ALONE at the end. `--serial` restores the old one-at-a-time mode.
- Packet gates use `./_runall.sh --smoke` (routes + contrast audit + era migrations +
  `SMOKE_EXTRA="…"` for the packets touched this session; target under 5 minutes).
  FULL boards run EXACTLY once per run, at its end gate.
- Never edit any file while any board is running. If a board finds failures: let it
  finish, fix, verify the fixed suites directly, and rerun the board only if product
  files changed materially. Report every board's wall time.
- Budget: the full sharded board completes in 25 minutes or less; no single suite
  exceeds 120 seconds except @serial frame-evidence suites justified in writing in
  tests/board-serial-baseline.md. Any new suite states its expected runtime when added.
- A lone sharded-board failure must reproduce serially before it counts as real
  (parallel load slows rAF cadence several-fold; suites poll with generous ceilings).
- New tests join tests/ so the glob finds them; avoid the excluded prefixes shoot,
  sim-blocks, device-qa.
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
