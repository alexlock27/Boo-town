# Changelog

All notable changes to Boo Town. Newest first.

## Run 2 — Phase 1: Character creator 2.0
- The guide is now any of five species on one shared layered-SVG rig: giraffe (neck +
  ossicones), puppy (floppy ears), kitten (pointy ears + whiskers), penguin (flippers +
  belly + beak), bunny (tall ears + cotton tail). Distinct silhouettes, identical option hooks.
- Full option set: body colour (6), pattern (none/spots/stripes) with pattern colour (4),
  eyes (round/sparkle/sleepy), accessory (bow/star-shades/crown/headphones + owned items),
  editable name. Live preview updates per tap; Surprise-me shuffle; big Done.
- Re-enterable any time: a "My character" card in the Collection and a long-press on the
  hub guide both open the full creator. Changing species carries all speech and progress over.
- Save v3 guide object { species, body, pattern, patternColour, eyes, acc, name }; old
  giraffe saves migrate losslessly (species → giraffe, patch → patternColour). Added
  nicknames/equips maps. Landscape creator relaid out (preview left, controls scroll right).

## Milestone 3 — "it's installable"
- Town: 6×4 grassy plot grid; place by tap-select or drag; Move / Put-away menu; tap a Boo to squeak + pop a
  heart; idle-bounce on offset timers; Dance Stage makes the 8 neighbouring Boos bop; ceremony hands items in.
- Grown-ups corner: sound/music/voice toggles (live), backup code (copy) + paste-to-restore, typed-RESET wipe;
  gated behind the hub cog's 3-second press-and-hold.
- PWA: web manifest (standalone, any orientation, theme/background colours), bespoke Boo-face app icons
  (192/512 + maskable) generated from SVG, service worker with versioned cache-first precache of all app files,
  offline navigation fallback, and `navigator.storage.persist()` request. Fully installable + offline.
- Motion: `prefers-reduced-motion` disables animations; confetti/wobble/sparkle respect it too.
- Tests: m3-town, m3-grownups, m3-pwa all pass. Full §14 acceptance checklist pre-run (see PROGRESS.md).

## Milestone 2 — "it's a real game"
- Full onboarding: guide creator (body/patch/accessory swatches, live preview, shuffle, guide name),
  3 intro speech bubbles, free first mystery box.
- Box ceremony: 3-tap wrapped gift with rising notes, rarity-glow card flip-in, guide reaction,
  duplicate → +2 meter with star animation, Put-in-town / Keep-for-later, chained stacked boxes.
- Game 2 Feed the Boos: pointer-events drag-to-sort onto signposted hungry Boos, valid-target glow,
  generous drop zones; all 9 spec templates (odd/even, compare, rounding, times-table membership,
  half-equivalence, fraction size, units, shape sides); stacked SVG fractions, emoji unit cards, SVG polygons.
- Game 3 Spell Boo: look-say-cover-spell with the full DfE Year 3/4 statutory list; TTS prompt + replay,
  free 2s Peek, letter tiles + decoys, partial-progress on wrong, next-letter hint, per-word mastery.
- Collection: 32-slot shelf, owned in colour with counts + rarity rings, unowned ??? silhouettes, blurbs.
- Edit-my-guide screen; router flushes save on every screen change.
- Tests: m2-onboard, m2-feedboos, m2-spellboo, m2-collection, and m2-full (new-player DoD) all pass.

## Milestone 1 — "it's a game"
- Design system: palette tokens, chunky pill buttons, cream cards, starfield, Fredoka font bundled locally (OFL).
- `art.js`: inline-SVG guide giraffe (all combos) + 6 Boo species + rarities + 8 decorations (art gate passed).
- State: single localStorage save, debounced autosave, persistent-storage request, base64 backup codes.
- Hub: guide + rotating speech, star meter + gift, three game cards with best-stars, bottom bar, hold-to-open cog.
- Onboarding (M1 minimal): splash + name (full guide creator arrives in M2).
- Audio: Web-Audio synth effects + two music loops + ducking + independent mutes; speechSynthesis wrapper.
- Game 1 Bubble Pop: 3 levels, spec-accurate question generator + distractors, drifting bubbles, hearts,
  2 hints, star rules; shared game shell (back-confirm, progress dots, hearts, hint face, guide peek).
- Results: stars animate in, meter fills, box offered when earned.
- Self-test harness (Playwright): `tests/m1.mjs` drives onboarding → game → results → reload; all pass.

## Setup
- Project scaffold: README, CHANGELOG, .gitignore.
- Git repository initialised; Playwright + Chromium installed.
