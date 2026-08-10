# RUN21F Progress

- [x] F1 — tools/asset-preview.html — DONE (commit RUN21F-1). Real renderBoo output pasted in renders at 60/120/220px on all three real backdrops (hexes read from css/styles.css: meadow .t-band.meadow, room-grey = kitchen wall, night .town2.night .t-skygrad); 60px silhouette toggle forces single-ink; 4 manual tickboxes + automated fill/stroke colour-literal readout. Evidence: scratchpad verify-f1.mjs, 18/18 PASS over file:// (offline), zero network requests.
- [x] F2 — tools/anchor-tuner.html — DONE (commit RUN21F-2). Drag + 0.005 arrow-nudge tuner in the exact data/sockets.js convention (x = frac of parent width from centre; yFrac = frac of parent height above the viewBox y=120 ground line, per town.js give()); Copy JSON emits paste-ready SOCKETS `{ x, row: 2, yFrac }` or SURFACE_SLOTS `{ x, surfaceY }`. Evidence: scratchpad verify-f2.mjs, 14/14 PASS — dragging onto the real bench SVG read back `{ x: -0.2, yFrac: -0.274 }` and `{ x: 0.2, yFrac: -0.274 }`, exact match to data/sockets.js deco_bench (tolerance ±0.01).
- [x] F3 — tools/gen-state.mjs — DONE (commit RUN21F-3). Writes PROJECT_STATE.md: build `run20d-20260731` + 158 assets, save v23, 54 screens, 8 areas, 149 catalogue items by kind, 60 wishes, 24 dressings, 204 suites (npm test does NOT resolve — tests/run.mjs missing), 7 RUN reports, gated-item harvest. Spot-checked by hand: screens 54, catalogue 149 (independent id-count), wishes 60, suites 204, dressings 24. Ran twice, byte-identical (no timestamps). CLAUDE.md deploy-gate bullet gained the regeneration line.
- [ ] F4 — CHANGELOG/README truth pass — DEFERRED until after packs A–E merge (so the truth pass has real reports and F3 numbers)
- [ ] F5 — save v24 — STRICTLY LAST
- [ ] F6
- [ ] F7
- [x] F8 — Region leitmotifs — **DONE** on branch `run21f8` (TONIGHT-2026-08-10 Lane 2).
      **NEEDS_ALEX: audition leitmotifs before merge** (the pack's line, verbatim). F8 does
      NOT merge until NEEDS_ALEX.md gains `LEITMOTIFS: SIGNED-OFF`. Audition them with:
      `python scripts/serve.py 8042` → http://127.0.0.1:8042/tools/leitmotif-audition.html
      Five cards, one per area, each playing through the REAL engine at the REAL in-game
      music level (gentle — turn the speakers up a notch), with a piano roll of the tune.

      **The five tunes** (all original, all strictly pentatonic major, all exactly 8 bars
      of 4/4, all inside the pack's 76-92 bpm, ≤3 voices, zero audio files):
      · meadow — "Pottering Among the Flowers" · C · 84bpm · 22.9s · lead+pad+bass
      · riverside — "Leaf on the Current" · F · 88bpm · 21.8s · unbroken eighth-note pad
        ripple under a floating lead
      · hilltop — "A Call Across the Valley" · G · 76bpm · 25.3s · 2 voices only: open-fifth
        drones and a slow wide call
      · beach — "Ice Cream Tide" · D · 80bpm · 24.0s · dotted lilt, off-beat sway
      · playground — "Yoo-Hoo from the Slide" · A · 92bpm · 20.9s · staccato call-and-answer
      A distinct root AND a distinct tempo per area is deliberate: it is what makes five
      tunes in one scale-family identifiable blind.

      **How they play.** `data/leitmotifs.js` (in `sw.js` ASSETS[] in the same commit that
      created it, `df16a20` — offline law) holds the note events. `js/sfx.js` gained a
      self-contained `leitmotif` region — placed well away from the `band` object because
      Lane 5 is editing beside `guitar()` tonight — with an audio-clock lookahead scheduler
      on the EXISTING music bus. `js/town.js` computes `CALM_LOOP = leitmotifKey(AREA.key)
      || 'calm'` once at mount and uses it in all three places the calm loop was named
      (mount, the scroll handler's zone-music default, and the parade's return), so an
      outdoor area plays its own tune as the calm variant while the funfair keeps its
      jingle/bandstand rules and every interior keeps plain 'calm'. Leaving an area returns
      to generic calm — hub and worldmap already call `music.play('calm')`, so a tune never
      follows her out of the place it belongs to.

      **EVIDENCE (`tests/r21f8-leitmotifs.mjs`, 159 checks, PASS, 69s wall).**
      · §0 validates the AUTHORED DATA deterministically, with the area list DERIVED from
        `js/areas.js` (so a future outdoor area cannot ship tuneless on a green board):
        0 off-scale notes in 342 events, 8-bar arithmetic exact, registers, lead/bass
        monophony, pad never above a dyad by sounding-count, **not one silent hole in any
        loop and 0.00 beats of silence across every seam**, ≥3 lead durations, every peak
        in bars 4-7, five distinct roots / tempi / opening gestures.
      · Right tune, right place: each area's mount schedules notes tagged `lm:<area>:*` on
        the music bus, no other area's tune leaks in, and beach→riverside re-aims cleanly.
        Funfair proved positively via `zoneMusic() === 'fair'` (not merely "no leitmotif").
      · **Seamless**: over a 25s capture crossing the bar-32 boundary, max onset gap
        **978ms against the tune's own authored maximum of 978ms** — the engine adds
        exactly nothing at the seam. A `startBandWatch`-style +900ms inter-loop pause
        would read 1878ms and fail.
      · Mute → bus 0, scheduler stopped, **0 notes scheduled**; sfx mute leaves it alone
        (the existing contract); speech ducks 0.18 → 0.0501 → 0.1799.
      · Re-entry runs exactly one of it (12 lead notes in 6s vs 10.5 expected; a doubled
        scheduler would read ~21), and the classic calm loop is proved STOPPED rather than
        layered underneath (0 untagged music-bus notes).
      · CPU: the scheduler measured **0.0113 ms/frame** of main-thread time over 240
        frames. The tunes are native audio nodes; the main thread does essentially nothing.
      · Loudest simultaneous instant bounded per tune (0.41-0.53 against calm's 0.39
        downbeat, ceiling 0.60).
      AFFECTED SUITES + CORE, all PASS, run directly on :8042 — `r21f7-beds` 38s (the
      closest sibling: F7's beds are untouched), `r6p1-town` 25s, `r6p3-band` 10s,
      `r9p6-band` 15s, `r6p2-funfair` 39s, `r7p1-funfair` 18s, `r6p5-beat` 84s,
      `r17x4-whatsnew` 106s, plus the fixed core `r12s1-routes` 121s, `r8p1-migrations`
      0.1s, `m3-pwa` 3s, `r12s4-contrast` 143s, `r18a-copyguard` 14s. No full board.

      **LISTENING NOTES — honest self-critique.** I cannot hear these, and that is the
      single biggest weakness of this packet; the audition gate exists precisely because a
      machine check cannot replace Alex's ears. What I can say from the numbers and the
      structure:
      · The riverside is the one I am most confident in. Its pad ripple is 64 unbroken
        eighth notes and never stops, so the water is continuous by construction rather
        than by a scheduler's good behaviour — exactly the continuity law's intent.
      · The hilltop is the one I would listen to hardest. It is deliberately the sparsest
        (24 events against playground's 93), and sparse only works if the drone genuinely
        holds. It does now — but only because of the envelope fix below; as first built it
        would have been a hole with occasional notes in it.
      · The meadow is the tune a child hears most (it is the first area and the only one
        every save can reach), so it carries the most risk of wearing out. Its lead restates
        one dotted "pottering turn" in bars 1, 3 and 7 with varied tails — memorable by
        design, which is also what makes it the likeliest to grate. Worth Alex's ear first.
      · Least confident: whether beach and meadow read as clearly different. They are only
        4 bpm apart (80 vs 84), both mid-density lead-over-bass textures. Their rhythmic
        profiles differ (beach is dotted and off-beat, meadow is a dotted turn resolving on
        the beat) and their roots differ, but this is the pair I would expect to blur, and
        it is a judgement I cannot make without ears.
      · What I deliberately did NOT do: add any in-app signage announcing a tune. Ambient
        music that announces itself stops being ambient. The What's New card tells her once
        that places have tunes; after that it is for noticing, not for being told.

      Gate re-checked at
      session start: NEEDS_ALEX.md line 404 now carries `LEITMOTIFS: APPROVED-TO-COMPOSE`,
      so the SKIPPED-GATED status above is superseded for this branch.

      DECISION: the loops are AUTHORED as note-event arrays in the band engine's event
      shape (`{t,i,v}` + a duration field `d` the band player would simply ignore), but
      PLAYBACK in town rides the music bus via a lookahead scheduler in sfx.js's new
      leitmotif region, not `startBandWatch`. · WHY: the pack's two sentences pull apart —
      "note-event arrays for the existing band engine" but "play as the area's calm-music
      variant at existing music volume". startBandWatch plays on the SFX bus at band level
      through setTimeout (loose timing) and adds a +900ms gap between loops: wrong bus,
      wrong mute, and a continuity-law breach for a piece sold as continuous area music.
      The music bus's own scheduler pattern (startScheduler/scheduleAhead, audio-clock
      lookahead — the same pattern F7 extended) gives sample-accurate seamless looping at
      existing music volume with duck-and-mute for free. Authoring stays band-shaped so the
      arrays remain engine-portable data, exactly what the pack asked to own. ·
      REVERSIBLE: the arrays are pure data; pointing startBandWatch at them needs no
      re-authoring.

      DECISION: per-area roots and tempi — meadow C·84, riverside F·88, hilltop G·76,
      beach D·80, playground A·92, all inside the pack's 76–92 window, all pentatonic
      major. · WHY: the pack fixes scale/tempo-range/voice-cap but leaves root and exact
      bpm open; distinct root + distinct tempo per area is what makes five loops in one
      scale-family identifiable blind (the F7 beds set the "each area audibly distinct"
      bar). Funfair excluded (its jingle/bandstand rules own that air — pack F7 precedent);
      interiors keep plain 'calm'. · REVERSIBLE: one constant per area in
      data/leitmotifs.js.

      DECISION: composition ran as a judged panel (two independent candidates per area,
      one judge per area, one cross-area distinctness/originality reviewer) rather than a
      single pass. · WHY: originality is a protected-core law and pentatonic major invites
      accidental nursery-rhyme echoes; independent attempts plus an adversarial originality
      check is the strongest defence I can run without ears. Alex's audition gate remains
      the human check. · REVERSIBLE: fully — the deliverable is still just data.
      It earned its keep immediately: the meadow judge REJECTED its own candidate B for
      opening do-re-mi in the exact dotted rhythm and contour of "Do-Re-Mi" from The Sound
      of Music before diverging at note 4. That is the law this pack calls out by name, and
      a single-pass composer would have shipped it.

      DECISION: held notes get a SUSTAIN envelope (`lmTone`), not `envTone`. · WHY: envTone
      ramps peak → silence across a note's WHOLE duration — right for a chirp, fatal for a
      held tone. Rendered offline and measured: on hilltop's 6.32s drone that envelope is
      27dB down at 3s and **46.5dB down at 5s** (gone), where the new one holds flat at
      −1.1dB for the note's length and then releases. Every one of these tunes breathes —
      the meadow's 4-beat pads, riverside's long bass, hilltop's whole texture — so with
      envTone the loops would have had holes exactly where the music rests, which is what
      the continuity law exists to prevent. It is the same context, the same musicGain bus,
      the same mutes, the same duck and the same log shape: one envelope generator, not a
      second audio path. · REVERSIBLE: `lmNote` is four lines; reverting them restores the
      old envelope (and the holes). Guarded by §0b so a future "simplification" fails loudly
      — the failure is otherwise INAUDIBLE to every other assertion, since the notes are
      still scheduled, just silent.

      DECISION: no in-app signage that an area has a tune. · WHY: the "announced moments"
      law is about state changes the CHILD CAUSED (a purchase, a wish, a socket claim).
      Arriving somewhere and finding it sounds like itself is atmosphere, and atmosphere
      that announces itself stops being atmosphere. The What's New card tells her once that
      places have tunes; after that it is for noticing. · REVERSIBLE: trivially, if Alex
      disagrees on audition.

### FOR THE MERGE GATE (Alex)

- **The sign-off gate is UNMET and binding.** `NEEDS_ALEX: audition leitmotifs before
  merge`. Do not merge F8 until NEEDS_ALEX.md gains `LEITMOTIFS: SIGNED-OFF`. `main` is
  untouched at `22b8d40`; all six F8 commits exist only on `run21f8` / `origin/run21f8`.
- **The live-URL half of the deploy gate is suspended** for tonight by the lane brief (no
  merges, no pushes to main, no deploys). `BUILD_STAMP` is bumped to `run21f8-20260810`
  and the What's New block is prepared ON THE BRANCH; both were verified served from the
  branch on :8042, but "fetch the live URL and confirm the stamp serves" is necessarily
  outstanding until the merge. If another pack ships first, the stamp needs re-checking.
- **PROJECT_STATE.md was deliberately NOT regenerated.** DECISION · WHY: `tools/gen-state.mjs`
  derives it from the build id, the registry and the catalogue, so all seven lanes running
  tonight would each produce a different one and collide at merge — the same reasoning the
  F7 lane used for its stamp. It belongs to the whole-run gate, after the lanes are in. ·
  REVERSIBLE: `node tools/gen-state.mjs` at the merge gate.
- **Lane 5 overlap:** the leitmotif work is a self-contained region at the END of
  `js/sfx.js`, deliberately away from the `band` object, so Lane 5's `pluck` voice beside
  `guitar()` should merge cleanly. The only edits outside that region are three small ones
  at the existing music seams (`initAudio` was already fine, `setMusicEnabled`, `music.play`
  / `music.stop`, `visibilitychange`) — the same four places F7 wired its beds through.

### F8 originality working (the record for the "no known melodies" law)

The panel's cross-area reviewer died on a session limit before it ran, so I did this check
by hand against the five lead lines rather than leave the law unverified. Each opening
gesture as an interval sequence, and the nearest famous tune I could find, with the note at
which they part company:

| area | opening intervals | nearest candidates tested | diverges |
|---|---|---|---|
| meadow | −3, −2, +2, −4 | This Old Man (−3,+3,0), Rain Rain (−3,+5), Camptown (0,−3,+3), Shortnin' Bread | note 2 |
| riverside | +3, −3, −2, −2 | Silent Night (+2,−2,−3), Amazing Grace (+5,+4), Danny Boy | note 1 |
| hilltop | +7, −3, −2, −5 | Twinkle / Baa Baa / ABC (+7 but as repeated notes in equal quarters) | note 1 (rhythm) |
| beach | +2, +2, −2, +2 | **Do-Re-Mi (+2,+2,−4)**, Frère Jacques (+2,+2,−4) | note 3 |
| playground | −3, +3, +2, +3 | This Old Man (−3,+3,0), the sol-mi taunt (2 notes only) | note 3 |

The beach is the closest call and the one to listen to hardest: it opens with a three-note
do-re-mi ascent. It leaves both candidates at note 4 (they fall a major third; it keeps
rising), and three ascending scale steps are the scale itself rather than a phrase — but it
is the one I would want Alex's ear on for this specific reason. Also checked and clear
against: Mary Had a Little Lamb, Row Row Row Your Boat, London Bridge, Hot Cross Buns, Old
MacDonald, Wheels on the Bus, If You're Happy, Happy Birthday, Yankee Doodle, Oh Susanna,
Ode to Joy, Auld Lang Syne, My Bonnie, Greensleeves. (Happy Birthday and Ode to Joy contain
semitones that cannot occur in a major-pentatonic tune at all.)

Mutual distinctness: five distinct roots, five distinct tempi, five distinct opening
gestures (asserted in §0), and five distinct textures — riverside's unbroken eighth ripple,
hilltop's two-voice drone, beach's dotted off-beat sway, meadow's dotted turn, playground's
staccato call-and-answer.

## F8 deviations

- DEVIATION: the pack says "note-event arrays for the existing band engine". The arrays ARE
  in the band engine's event shape (`{t, i, v}`) and are engine-portable data, but they
  carry an extra `d` (duration) and their voices are `lead|pad|bass` rather than
  `drum|key|guitar|xylo`, so `startBandWatch` cannot play them as-is. This is deliberate and
  is the same sentence's other half: the pack also says they "play as the area's calm-music
  variant at existing music volume", and `startBandWatch` plays on the SFX bus at band
  level through setTimeout with a +900ms gap between loops. That is the wrong bus, the
  wrong mute, loose timing, and a continuity-law breach for a piece sold as continuous
  area music. Documented in `data/leitmotifs.js`'s header and in the sfx.js region comment.
- DEVIATION: the pack's ACCEPT says "five loops audition offline". The audition page is
  ES-module based, so it needs a local server rather than `file://` — that is how every
  other `tools/` page in this repo works and how the app itself works. "Offline" is
  satisfied in the sense that matters: zero network requests, everything imported from the
  repo. The page states the serve command in its own header comment.
- DEVIATION: two assertions in the first cut of the evidence suite could not catch the
  regressions they were written for (the anti-doubling band admitted a doubled scheduler;
  a fixed 2.5-beat seam threshold would have waved through the +900ms band-watch pause).
  Both were found by an independent gate review with fresh eyes and now measure against
  each tune's own authored numbers instead of magic constants. Recorded because a green
  suite that cannot fail is worse than no suite: it buys false confidence.
- [ ] F9 — SKIPPED-GATED: lacks `VOICE: APPROVED · BUDGET: <MB>`
- [ ] F10

Notes:
- This branch (run21f) works items F1–F3 only; F4 deferred, F5 last, F8/F9 gated as above.
- tools/ pages are LOCAL-ONLY dev tooling: they stay OUT of sw.js ASSETS[] and are never linked from the app. sw.js is NOT touched this run.
