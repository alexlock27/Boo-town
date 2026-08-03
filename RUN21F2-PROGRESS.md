# RUN21F2 Progress

This branch (`run21f2`) carries **ONLY F7 and F10** of the RUN21F pack. F1–F3 are already
shipped on main; F4 is deferred until packs A–E merge; F5 is strictly last; F8 and F9 are
SKIPPED-GATED (NEEDS_ALEX.md lacks their approval lines). Nothing else in the pack is
touched here.

- [x] F7 — per-area ambient beds (beach · riverside · hilltop · meadow · playground) — DONE
      (commit `RUN21F-7`). Five synthesised beds in `js/sfx.js`, zero audio files, on a new
      `bedGain` bus wired through the SAME three places the existing day/night ambient bus
      is wired through: `initAudio()`, `setMusicEnabled()` and `music.duck()`. Started by
      `bed.play(AREA.key)` at the town mount and stopped by `bed.stop()` at unmount, beside
      the existing `ambient.play/stop` calls. The BEDS table decides who gets one, so the
      Funfair (its jingle/bandstand rules already own that air) and every interior are
      silent by construction, not by a special case.
      · beach — noise wash through a lowpass at 820 Hz on an 8s LFO cycle + gull cries ≤2/min
      · riverside — noise wash through a lowpass at 380 Hz with a 0.22 Hz sine wobble on the
        filter corner (the burble)
      · hilltop — noise through a bandpass at 700 Hz swelling on a 0.08 Hz LFO (~12.5s wind)
      · meadow — three-note birdsong motifs, ≤3/min
      · playground — bandpassed babble swells, ≤2/min
      Caps are enforced across mounts (`bedLastEvent` is module-level), so re-entering an
      area cannot be used to beat the per-minute limit.
      EVIDENCE (`tests/r21f7-beds.mjs`, 41 checks, PASS): five distinct synthesis
      signatures in one capture — `beach=wash:lowpass@820+event:gull ·
      riverside=wash:lowpass@380 · hilltop=wash:bandpass@700 · meadow=event:birdsong ·
      playground=event:babble`; bus gain 0.12 (pack cap ≤0.12); `music.duck(true)` → 0.04,
      released → 0.12; music mute → gain 0, 0 nodes, scheduler stopped, 0 events scheduled;
      sfx mute leaves it alone (the existing ambient contract); funfair + 3 house rooms +
      gallery report `{area:null, nodes:0, scheduling:false}`; leaving an area stops it.
      CPU: frames with the bed on mean 16.59ms / p95 16.70ms vs off mean 16.64ms / p95
      16.70ms (Δ −0.05ms and 0.00ms), and the scheduler itself measured 24 ticks totalling
      0.200ms over 240 frames = **0.0008 ms/frame** — the continuous layer is native audio
      nodes and costs the main thread nothing at all.

- [x] F10 — QA farm + play journal — DONE (commits `RUN21F-10A`, `RUN21F-10B`).
      **A · `tests/walk.mjs`** — every area and every room (10 stops), at 1024x768,
      768x1024 and 390x844, ten minutes total, error hooks armed (console.error, pageerror,
      window.onerror, unhandledrejection, non-aborted requestfailed), screenshots to
      `_evidence/walk/<date>/`, non-zero exit on any of them. Documented in CLAUDE.md as
      THE PRE-MERGE SMOKE. RUN21A's throwaway probe was the model: it drives the REAL mouse
      (synthetic PointerEvents have no active pointer and make the app's setPointerCapture
      throw), dismisses `.overlay.growth-reveal`, and seeds every placement at x ≤ 0.25 so
      it is on camera in a four-viewport-wide area.
      ACCEPT — **passes on current main (fec9641)**: 10.2 min, 6 laps × 3 viewports, 30
      screenshots, 155 real-mouse handles, **0 errors**.
      **B · play journal** — `js/playjournal.js`, behind the EXISTING QA flag
      `window.__bootownQA` (the same seam `js/town.js`'s `?hour=` override uses; there is no
      other QA flag in the repo and no second one was invented). Toggle
      `Session notes for grown-ups` + `Download notes` in the Grown-ups panel's Backup &
      data tab, built ONLY when the flag is set. Screens and dwell come from `main.js`'s
      `go()` — the one router — and taps from a capture-phase listener installed only while
      recording. Memory only: no settings key, no localStorage, no migration, so "never
      persisted on" is structural rather than promised. The download is a Blob + object URL,
      so nothing leaves the device.
      EVIDENCE (`tests/r21f10-journal.mjs`, 32 checks, PASS): flag off → 0 journal
      cards, 0 toggles, 0 buttons, 0 occurrences of the words in the rendered markup, module
      inert, `setJournalOn(true)` REFUSED, 0 storage keys created, nothing of the journal in
      localStorage/sessionStorage/cookies; flag on → card present, switch OFF by default,
      a real 63.7s scripted minute captured 13 screens / 9 taps / per-screen dwell totalling
      64s of 64s, 0 off-device requests (16 same-origin GETs for app files), download
      `boo-town-session-notes-<stamp>.json` with 26 entries and the anchor gone afterwards,
      and a reload always comes back OFF.

- [ ] F1–F6, F8, F9 — NOT TOUCHED on this branch (see the header).

## Deviations

- DEVIATION: pack said `tests/walk.mjs` joins tests/ → `_runall.sh` enumerates
  `ls tests/*.mjs` minus shoot/sim-blocks/device-qa, so a ten-minute walk would have joined
  the board and blown the 120s-per-suite budget → added `walk` to that exclusion list (the
  established convention for exactly this) and documented in CLAUDE.md that it is the
  standalone pre-merge smoke, not a board suite.
- DEVIATION: pack said the beds must "obey every existing mute" → the existing contract
  (CLAUDE.md + `ambient` in sfx.js) is that the sfx mute governs one-shot effects and the
  music mute governs music AND ambience; the ACCEPT itself says "per the existing contract"
  → the beds ride the music mute exactly as the day/night ambient bed does, and the suite
  asserts BOTH halves (music off ⇒ silent and torn down; sfx off ⇒ unaffected).
- DEVIATION: pack listed five "looping beds" → two of them (meadow birdsong, playground
  babble) are described by the pack purely as sparse events with per-minute caps and no
  continuous wash → those two loop as event schedulers with no wash layer, which is what the
  pack's own descriptions say and is also what makes all five distinct.

## Notes

- Engine reuse (CLAUDE.md law): the beds reuse the existing ambient machinery — same
  AudioContext, same master, same `setMusicEnabled` mute path, same `music.duck()` call,
  same `setAudioLog`/`getAudioLog` instrumentation, same `envTone`/`glideTone`/noise
  helpers, same visibilitychange pause. `glideTone` gained optional `bus`/`tag` arguments
  and logs ONLY when tagged, so the animal calls still log exactly one line each.
- No unlisted parallel system found. `quests.js stampJournal` was checked and is a
  different thing (persisted milestone day-keys in the save), which is why the new module is
  `playjournal.js` and shares nothing with it. Nothing to log to BLOCKED.md.
- `js/playjournal.js` joined `sw.js` ASSETS[] in the same commit that created it. No other
  new js/ or data/ file. `tests/walk.mjs` and `tests/r21f*.mjs` are NOT runtime files and
  are correctly absent from ASSETS[].
- SAVE VERSION unchanged at 23. No child-facing copy changed.
- FOR THE MERGE GATE (Alex): `BUILD_STAMP` is untouched at `run21a-20260803` and no
  `data/whatsnew.js` block was appended — the stamp bump belongs to the whole-run gate
  (`run21f-<date>`) and would collide with the other packs in flight. F7 is child-facing and
  WILL need a What's New entry under whatever stamp the merge ships. The play journal must
  NOT be advertised (house law: never advertise anything a grown-up has to switch on).
- r20-wishlife flake: it failed twice under load on the rocket's six-flight assertion
  (a 150ms sample after a synthetic tap, against a 3200ms flight). Bisected — with the bed
  disabled it passed, and the probe showed the bed is completely inert in that fixture
  (music muted in the save ⇒ `{gain:0, nodes:0, scheduling:false}`), so it cannot be the
  cause. It has since passed 3/3 unloaded with the bed enabled. Recorded as a flake.
