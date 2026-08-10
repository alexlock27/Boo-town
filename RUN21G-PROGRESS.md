# RUN21G — The Band Plays Properly · ledger

Branch `run21g` from main @ 22b8d40 (`run21f-20260804` — the pack's authoring baseline).
Worktree `..\Boo-town-run21g-wt`, port 8045. Pack: `RUN21-programme/TONIGHT-2026-08-10/RUN21G-BAND/PACK.md`.

## Scout results (anchors verified before editing)
- `js/band/shared.js`: `renderLane()` marker math, `renderKeys()` advance-with-modulo,
  `playEvent` (line 27, pack said ~29), `dominantInstrument`, `hit()` — all as the pack describes.
- `css/styles.css`: `.band-sparkle-lane` 3083 (780px box), `.band-lane-marker` 3102 with the
  `bandLaneFall` transform clobber, `.band-playfield` 3119 (820px box), `.p6-keys-row` 3166
  (`repeat(10,1fr)` + 4px gap), `.p6-strum-zone` 3201 — all exact. Root-cause analysis CONFIRMED.
- `js/sfx.js`: `CHORD` at 518, `guitar()` at 525, `fanfare()` EXISTS at 140 (item 2 uses it).
- `js/celebrate.js`: `beatTick` at 61, `celebrate` at 74 — exact.
- `js/band.js`: `playEvent` at 85, `mirror()` role map at 170 — 'pluck' already falls through
  to 'guitarist' (the map's else branch), so the pack's role-map ask is satisfied by reading,
  not editing. Noted for the gate-verifier.
- Routes `band-keys`/`band-guitar`/`band-songs` registered in js/main.js 63–70.
- All four BOO_POP_HITS carry `progression` (item 4 viable); `golden` = Am F C G @116.

## Item 1 — DONE (commit 1c63ef9)
The wanted key carries class `wanted` (halo + ✨ ::after, centred by construction); lane
repurposed to name · next-three peek (`.band-lane-next`) · progress (`.band-lane-count`);
`.band-lane-marker` element + CSS + reduced-motion reference deleted; `beatTick(countEl)` on
every advance; free play untouched.

Evidence (`.tmp/probe-item1.mjs` against :8045, screenshots in `_evidence/r21g/item1/`):
- ACCEPT 1: Δ(badge centre, key centre) ≤ 0.01px at songPos 0/3/7 × 1024x768, 768x1024, 390x844.
- ACCEPT 2: wrong key sings (`key` tag), songPos holds, no wobble/failure classes.
- ACCEPT 3: wanted key advances exactly once; `.band-lane-count` gets `cel-tick` 33ms after the
  press (twinkle's C→C repeat — the pulse IS the visible advance).
- AA: `.band-lane-next` 7.23:1, `.band-lane-count` 17.43:1 over the composited lane backdrop
  rgb(26,17,67) — the pack's authored rgba(255,255,255,.62) passes as-is.
- No transform positioning on the new lane spans (cel-tick animates transform — the old
  marker's clobber class of bug is structurally excluded).

DEVIATE (with proof) — the pack's sanctioned clip fix doesn't work; a scoped alternative ships:
- Pack: "if [the ::after is clipped], the sanctioned fix is `overflow: visible` on
  `.p6-keys-row` only." The clip comes from the PARENT (`.band-playfield { overflow: hidden }`);
  overflow on a child cannot un-clip an ancestor's box, so the sanctioned fix is a no-op.
- Shipped: `.inst-keys .band-playfield { overflow: visible }` — keys scene only; drums/xylo
  keep their clip. Proof: badge top measured 29–34px above the playfield top and RENDERS at
  all three viewports (screenshots); overflow computed `visible` only under `.inst-keys`.

DECISION: progress copy reads `✨ {songPos+1 clamped to total} of {total}` — the note the
sparkle is waiting on, 1-indexed. · WHY: item 2's ACCEPT names "note 1 of 42" as the
play-again state, which fixes the indexing; clamping keeps "42 of 42" (not 43) once done.
· REVERSIBLE: one template string in `renderLane()`.

DECISION: the peek shows the wanted note plus the two after (`wantedKeys.slice(songPos,
songPos+3)`). · WHY: the pack's example `A · A · G` matches twinkle's bars only as
current-inclusive; a peek that excludes the note you're being asked for would disagree with
the sparkle under it. · REVERSIBLE: change the slice start to songPos+1.

## Item 2 — DONE (commit b8824bc)
No modulo: `finishSong()` fires once (guarded by `done`), `celebrate(status, { counter,
sound:'fanfare', line: guideLine('L_BAND_SONGDONE') })`, verbatim status line, both chips
(`btn soft`), keys stay playable, `Play it again` restores note 1 of 42 with ✨ on C,
`More songs ✨` routes. Default keys status copy replaced per pack; drums/guitar/xylo keep
'Tap Record, then play!'. Seam gains `songDone()`.

Evidence (`.tmp/probe-item2.mjs`, screenshots `_evidence/r21g/item2/`): 24/24 —
one celebration per completion (1 then 2 after replay), authored guide line spoken path,
count rests 42 of 42, reduced-motion run still shows line + chips with no cel-pop.

- Scout: `fanfare` EXISTS in js/sfx.js (line 140) → used; the else-branch (`sfx.star()`) not needed.
- DECISION: fanfare rides as `celebrate`'s ack sound (`sound:'fanfare'`) rather than firing
  beside celebrate's default star. · WHY: the pack asks for celebrate AND fanfare; calling
  both as written stacks star+fanfare in the same 100ms, which is two chimes for one moment
  (Celebration Standard: beat 1 is ONE acknowledge). celebrate's `sound` param exists for
  exactly this. · REVERSIBLE: two-line change back to star + explicit fanfare.
- DECISION: `L_BAND_SONGDONE` spoken via `celebrate({line})` → `speakMaybe` — the same
  guideLine path band.js's bandstand announcement uses (js/band.js:391). · WHY: pack says
  "reuse exactly" how screens speak; celebrate-with-line IS the post-RUN18D idiom for
  witnessed moments. · REVERSIBLE: swap to a bare `speakMaybe(guideLine(...))`.

## Item 3 — DONE (commit 3d90ef4)
`band.pluck` added in sfx.js adjacent to `guitar()` exactly as authored (196Hz base, sawtooth
+ triangle octave, `pluck:<semi>` tags); `CHORD` exported as `GUITAR_CHORD_NOTES` (one line).
`renderGuitar()` rewritten: `.p6-strings` with four `.p6-string` rows (≥64px, `touch-action:
none`, inline-SVG ink stroke 4/3.5/3/2.5px top→bottom with a lighter core line), pointer-
captured gesture with `rowAt()` clamped 0–3, crossing-order fill, the authored velocity
formula unchanged, 90ms per-string guard, transform-only wiggle. Chord pads retune
`stringSemis` and flash each string (40ms stagger, vel 0.5); `sfx.tap()` removed. Plucks
record as `{i:'pluck',v:semi,t}`; BOTH `playEvent` dispatches extended; `dominantInstrument`
maps pluck→guitar. `mirror()` unchanged.

Evidence (`.tmp/probe-item3.mjs`, screenshots `_evidence/r21g/item3/`) — all 5 ACCEPTs:
- A1: down = 0→4→7→12 ascending, up = 12→7→4→0 descending; a 2-step flick still fires all four.
- A2: slow (200px/600ms) max vel 0.73; fast (200px/80ms) max vel 1.20. Exposed via the seam.
- A3: G top string = semi 7, Am top = semi 9; retune heard low→high (7 11 14 19) at vel 0.5.
- A4: 8 plucks → layer `instrument:'guitar'`; watch playback fires 8; a seeded PRE-EXISTING
  `{i:'guitar',v:'C'}` jam still plays the full chord voice (C×4, G×4 envTones).
- A5 (feel): critic-judged — see the self-critique section.

Scout finding (no edit needed): js/band.js's `mirror()` role map (line ~170) already routes
anything that is not drum/key/xylo to `'guitarist'`, so `'pluck'` → guitarist holds as
authored without a change. Verified by reading, not assumed.

DEVIATE (with proof) — the authored reduced-motion path for the string feedback is inert:
- Pack: "reduced motion → a 160ms brightness flash on the string's core line instead."
  Implemented as an animation first; measured `animationName: none` under
  `reducedMotion: 'reduce'`. Cause: css/styles.css:163–167 is an app-wide
  `* { animation: none !important }` reduced-motion rule, so ANY animation-based reduced
  path is silenced before it runs.
- Shipped: the flash rides an 80ms `opacity` TRANSITION on `.p6-string-core` (.5 → 1), with
  the `plucked` class removed after 160ms so it has an edge to fall from. Measured under
  reduced motion: wiggle `none`, core opacity 0.5 → 1, `transition-property: opacity`.
  The authored MEANING (a 160ms brightness flash on the core line) ships intact.

## Gate (items 1–3) — GREEN, 8/8, ~5m20s total
`BASE=http://127.0.0.1:8045 node tests/<name>.mjs`, serially, nothing else in flight:
| suite | result | wall |
|---|---|---|
| r21g-band (new, 57 checks) | PASS | 16s |
| r9p6-band (@serial) | PASS | 15s |
| r10p6-bandscenes | PASS | 4s |
| r12s1-routes (core) | PASS | 121s |
| r8p1-migrations (core) | PASS | 0s |
| m3-pwa (core) | PASS | 3s |
| r12s4-contrast (core) | PASS | 144s |
| r18a-copyguard (core) | PASS | 14s |
No flakes, no re-runs needed. Gate green → item 4 authorised by the brief.

Legacy suite changes (one line each, per the brief):
- `tests/r10p6-bandscenes.mjs`: guitar scene selector `.p6-strum-zone` → `.p6-string`
  (the surface it names was replaced; every assertion it makes is unchanged and still runs).

## Item 4 — DONE (commit a12a3c2) — built only after the item 1–3 gate came back green
Strum-along on the chord pads. `strumChords` = the song's `progression`; `playAlong` is now
`'keys' | 'strum' | null` and `songTotal` is `wantedKeys.length` or `STRUM_BARS` (16), so
`renderLane` / `updateWanted` / `finishSong` / the new `advanceSong` serve both modes from one
model rather than two parallel ones. The wanted PAD carries the same `wanted` class, same ✨,
same pulse. Lane reads `♪ bar N of 16` and ticks via `beatTick`. `endGesture()` fires on
pointerup: `gestureRows.size >= 2` AND `chord === wantedChord()` advances one bar — a
single-string pick never does, and a strum on any other chord plays and waits. Bar 16 calls
the SAME `finishSong()` as item 2 (same guide key, same line, same chips). Entry: `Strum it 🎸`
on `band-songs`, rendered only when `song.progression` exists.

Evidence (`.tmp/probe-item4.mjs` + the suite, screenshots `_evidence/r21g/item4/`) — 40 checks:
- ACCEPT: golden (Am F C G): 16 correct strums → `done`, ONE celebration, verbatim line, both
  chips, counter rests at `♪ bar 16 of 16`; a strum on a non-wanted chord plays ≥8 pluck
  envTones and does not advance; strumming after the end never re-celebrates.
- Entry: all four Hits show `Strum it 🎸`; all three Little Boo Songs show nothing at all.
- Badge geometry measured at all three viewports: Δ ≤ 0px from the pad centre, badge inside
  its own pad, always clear of the pad above.
- Free-play guitar proven untouched: no lane, no target, pads keep the UA default padding
  (1px, checked against a bare `<button>` in the same document), status line unchanged.

DEVIATE (with proof) — the pad badge cannot use the key badge's `top: -34px`:
- Pack: "the wanted PAD carries `wanted` (same ::after sparkle, same pulse)". Same glyph,
  filter and keyframe ship. Position could not: `.p6-chord-column` stacks four pads with an
  8px gap, so `top: -34px` puts a ~30px badge entirely in the gap and 26px INTO THE PAD ABOVE.
- Shipped: the badge sits in the pad's own reserved top strip (`top: 3px`), with
  `padding-top: 30px` applied to all four pads via `.p6-chord-column.playalong` so the letters
  never collide with it and the wanted pad does not jump against its neighbours. Reserve is
  scoped to play-along, so free play is pixel-identical. Measured at 1024x768 / 768x1024 /
  390x844: badge top 494.9 vs pad top 491.9 and pad-above bottom 483.9 (and equivalents) —
  inside its own pad, clear of the one above, at every viewport.

BUG FOUND AND FIXED (not in the pack; found by building item 4): the reduced-motion rule at
css/styles.css:163 is `* { animation: none !important }`, and the universal selector does NOT
match pseudo-elements. Measured: with only `.p6-key.wanted::after` named, the chord pad's
badge kept pulsing under `reducedMotion: 'reduce'` (`animationName: r21gWantPulse` vs `none`
for the key). Both badges are now named explicitly. Pinned by the suite.

DECISION: `sel` (selected) and `wanted` (the target) are separate signals — selected is a gold
fill, wanted is a gold ring plus the badge, and `.wanted.sel` gets a white/star double ring.
· WHY: the child chooses a chord and is simultaneously being shown one; collapsing them would
make "the one I picked" and "the one it wants" indistinguishable at the moment they differ,
which is exactly the moment that matters. · REVERSIBLE: two CSS rules.

DECISION: the guitar shows the same `✨ Play-along on` header toggle the keys scene has, but
only in strum-along. · WHY: the pack authored the entry (songs screen) and the exit (chips)
but no way to change song mid-play; the keys scene solves that exact problem with this exact
control, so this is the existing affordance applied consistently, not a new mechanic. Free-play
guitar is unchanged (asserted). · REVERSIBLE: one condition in the header builder.

DECISION: the lane's centre peek shows the next three CHORDS in strum-along, mirroring item
1's next-three-notes peek. · WHY: the pack authored the peek for the lane and the bar counter
for strum-along; leaving the centre empty would make the guitar lane visibly poorer than the
keys lane for no reason. It is a readout, not a mechanic. · REVERSIBLE: one ternary.

DECISION: status copy `{song} — strum on the ✨`, mirroring the authored keys line
`{song} — follow the ✨`. · WHY: the pack created this state but wrote no copy for it; the
parallel construction in the guitar's own verb is the least surprising thing a child can read.
· REVERSIBLE: one string.

## Item 5 — DONE (commit e1f4b91)
- `js/band/songs.js` intro line → `Hear a little preview, then follow the sparkle.` (verbatim
  as authored; the old line named the keys, and the sparkle now rides the chord pads too).
- Keys header toggle `Choose a song` / `✨ Play-along on`: STANDS, text unchanged. (Its
  condition changed from `params.song` to the RESOLVED song object, so an unknown song id now
  correctly reads `Choose a song` instead of claiming play-along is on.)
- Dead-rule sweep, all confirmed gone with their last references: `.p6-strum-zone`,
  `.p6-strum-arrow`, `@keyframes p6Strum`, `.band-lane-marker`, `@keyframes bandLaneFall`.
  Swept every `.p6-*` / `.band-lane-*` / `.band-done-line` / `.band-song-strum` selector in
  css/styles.css against js/ and tests/: zero unreferenced.
- `grep strum` across js/ css/ tests/ — every survivor accounted for:
  - `css/styles.css` `.strum-strip`, `.strum-strip.strummed` and `js/band.js` `guitarUI()`'s
    strum strip: **STAND**. They belong to `band-legacy` (js/main.js:64, "preserved RUN9
    harness"), a separately-registered screen this pack did not touch — item 3 names
    `renderGuitar()` in js/band/shared.js only. Exercised by r6p3-band, r7p1-funfair, r9p6-band.
  - Everything else is RUN21G's own new code or its comments.

DECISION (beyond the pack's named list, on a surface this run rewrote): the lane's empty state
`Choose a song for press-paced sparkles` → `Pick a song and a sparkle will show you the way!`
· WHY: "press-paced" is developer language on a line a nine-year-old reads, and `renderLane()`
is code this run replaced wholesale, so it is squarely the touched surface. Nothing asserted
the old string (checked). · REVERSIBLE: one string.

## Deploy gate (ON THE BRANCH — live-URL steps suspended by tonight's standing override)
- `BUILD_STAMP` → `run21g-20260810` (sw.js).
- What's New block appended NEWEST-FIRST in `data/whatsnew.js`, `version` = the stamp, both
  entries exactly as authored in the pack. Item 4 deliberately adds no third entry (the pack
  caps this run at two, and the songs screen's new button is its own discovery).
  Verified by `tests/r17x4-whatsnew.mjs`: `LATEST_VERSION` is the new block and BOTH routes
  resolve (`band-guitar`, `band-songs`).
- No new files → `sw.js` ASSETS[] untouched (verified: `m3-pwa` PASS).
- No save-schema change → v24 stands (verified: `r8p1-migrations` PASS).
- NOT done, per the override: no merge to main, no push to main, no live deploy.

## End-of-lane gate — GREEN, 8/8
Re-run in full after items 4 and 5 (both touched shared.js/css; item 5 also touched sw.js and
whatsnew.js). Serially, nothing else in flight:
| suite | result | wall |
|---|---|---|
| r21g-band (82 checks) | PASS | 34s |
| r9p6-band (@serial) | PASS | 32s |
| r10p6-bandscenes | PASS | 5s |
| r12s1-routes (core) | PASS (after its fixture, below) | 122s |
| r8p1-migrations (core) | PASS | 1s |
| m3-pwa (core) | PASS | 3s |
| r12s4-contrast (core) | PASS | 146s |
| r18a-copyguard (core) | PASS | 15s |
Plus `r17x4-whatsnew` (What's New law): PASS.

One real failure, caught and fixed at cause: `r12s1-routes` failed
`band-guitar: source passes 'song' and this suite drives it` — correct behaviour by the suite,
because item 4's `Strum it 🎸` made `band-guitar` a param-carrying route for the first time.
Fixed by adding fixtures, not by loosening. Re-verified ONLY r12s1-routes per the board law.

One flake, confirmed and dismissed per the board law's one-serial-re-run rule:
`r17x4-whatsnew` timed out waiting for `.hub` on its first run. Diagnosed before re-running —
`data/whatsnew.js` parses clean (23 blocks, new one well-formed) and a direct hub boot showed
`.hub` visible with ZERO page/console errors — i.e. the known `.hub` boot-timeout flake
(PICK-UP-HERE.md note 2). One serial re-run: PASS.

## Legacy suite changes (one line each)
- `tests/r10p6-bandscenes.mjs`: guitar scene selector `.p6-strum-zone` → `.p6-string` — the
  surface it named was replaced; every assertion it makes is unchanged and still runs.
- `tests/r12s1-routes.mjs`: added a `band-guitar` fixture pair (a Hit → strum-along, and a
  Little Boo Song → falls back to free play rather than throwing) — strengthened, never
  weakened; the suite now drives a route it previously only mounted bare.
- No other legacy suite was edited. `r9p6-band` needed no change (it drives `band-legacy`).

## Seam left for later (noted per the pack's out-of-scope list)
The xylophone can adopt the `wanted` model without new machinery: `updateWanted()` picks its
row from `playAlong`, and `advanceSong()`/`finishSong()` are instrument-agnostic. A xylophone
follow needs only a `playAlong === 'xylo'` branch choosing the bars container and an index
mapping — no changes to the lane, the completion moment, or the celebration.
