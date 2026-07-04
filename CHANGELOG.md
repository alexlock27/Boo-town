# Changelog

All notable changes to Boo Town. Newest first.

## Run 2 — Phase 5: Boo Bounce (new game)
- A gentle canvas brick-breaker: a draggable paddle, one soft ball, a candy brick wall
  (6 across, 4 deep). A question card sits on top; exactly three bricks wear answer labels
  (one correct). Breaking the correct brick clears its whole row with a fanfare and brings
  the next question; breaking a wrong-labelled brick just breaks it ("Hmm!") and the label
  hops to another brick. Plain bricks break normally.
- Friendly constant ball speed; the paddle position bends the bounce; angles are clamped
  so the ball never crawls horizontally. Losing the ball dims a heart and relaunches from
  the paddle — hearts never end the round, they only shape stars. Round = 8 questions
  answered or the wall cleared twice. Stars: 3 = at most one wrong brick and one ball drop;
  2 = at most three combined; 1 = finished. Fifth hub card.

## Run 2 — Phase 4: Boo Blocks (new game)
- A 9x9 block puzzle where learning dispenses the pieces. A question card (Times tables or
  Spelling, level picker) sits beside the board; each correct answer dispenses the next
  polyomino from a fair bag into a three-slot tray. Three correct in a row awards a bonus
  five-line. A wrong answer wobbles, dims a heart, re-asks once, then swaps the question.
- Drag or tap-place pieces onto the board (valid cells highlight); completed rows and
  columns clear with a sparkle pop. Round ends after 12 placed pieces or no legal move.
  Hint highlights one legal placement. Stars: 3 = 10+ correct and 5 lines, no hints;
  2 = 7+ correct and 3 lines; 1 = finished.
- New shared question engine (js/questions.js) reused across the arcade games. Added a
  fourth hub card. Hearts never end a round; the game is turn-based so it idles when hidden.

## Run 2 — Phase 3: Town 2.0 (a living scrolling world)
- The 6x4 grid is replaced by a horizontally scrolling side-view world with three
  parallax layers (starry sky, soft hills, ground band) and momentum touch scroll.
- Four zones, each about a screen wide: Meadow (open), Riverside (40 stars), Hilltop
  (100), Beach (180) — named constants. Locked zones show pretty silhouettes with a
  signpost ("opens at N stars"); unlocking plays a fanfare, confetti, a guide line and
  pans the camera into the new zone (celebrated once, recorded in the save).
- Placement: drag items from the tray onto the ground band anywhere, or tap-to-place in
  place mode; drag placed items to move; menu to Dress up / Move / Put away. Old grid
  placements migrate to Meadow positions in order.
- Life: placed Boos gently wander with pauses and the odd hop (transform-only, ≤30 active,
  paused offscreen or when hidden); tapping squeaks, pops a heart and shows the nickname.
  Dance Stage still makes nearby Boos bop. Real-clock day/night: 19:00–07:00 deepens the
  sky, brightens the stars and drifts fireflies; daytime gets butterflies. Reduced-motion
  stills the wanderers into calm static poses.
- Save v3 town entries are { zone, x, item }; v1/v2 saves migrate losslessly.

## Run 2 — Phase 2: Rewards clarity, accessories, nicknames
- Scripted first gift: onboarding now ends with "Pick your first Boo!" (Inky/Lolly/Chomp,
  side by side). The first reward is always a character she chooses, then the guide walks
  her into the town to place it. Random boxes begin after that.
- Reveal cards announce what things are: a big type banner ("A BOO!" / "A DECORATION!" /
  "AN ACCESSORY!"), the name huge, a one-liner, and a matching action button that lands
  where it says — Meet them / Place it (→ town place mode) or Wear it (→ equip picker).
- Accessories are real items (10 new, type "accessory"): every Boo has one accessory slot;
  equip from the Boo's card or a placed Boo's Dress-up menu; the player's own character
  wears any owned accessory via the creator. Equipped accessories render in the collection,
  the reveal ceremony and the town, and survive reload. New "👒 Wardrobe" in the Collection.
- Drop rule: type first (Boo 70% / decoration 15% / accessory 15%), then rarity as before;
  accessories never drop until at least 3 Boos are owned. DJ Boo refuses a second pair of
  headphones. Nicknames: rename any owned Boo (official name kept in small print).

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
