# Changelog

All notable changes to Boo Town. Newest first.

## Run 6: the elevation run
- **Hotfix 1 — the funfair stays open and running at night**: previously a ride only animated its
  seated riders, so an empty ride (common when no Boos are placed in the funfair, and typical at
  night) sat motionless and looked "parked". Each ride's structure now runs continuously at any hour
  regardless of riders — the ferris wheel turns, the carousel bobs, the teacups jiggle, the bouncy
  castle breathes, the helter tower sways — keeping the dark-sky night look and glowing string
  lights. Transform-only, reduced-motion still stills it, no save changes. The performance gate's
  funfair scene was moved to 01:00 at full pressure (all five structures running + 17 riders) and
  holds ~60fps.
- **Run-5 reconciliation (phase 0)**: hardened the 3-second long-press (a shared
  `suppressContextMenu` kills the touch-callout / download-share pop on the cog and guide);
  the grown-ups corner became a real tab bar (Settings / Golden Round / Star Ledger / Backup
  & data, Settings first) so no setting hides behind an editor; Boo Blocks pieces now rotate
  90° on tap (snappy quarter-turn, works mid-drag); the named phone screens re-verified
  restacked at 390x844 both orientations with tablets left byte-identical.
- **The living town**: a weighted behaviour engine on the free-wandering Boos — visiting a
  friend (hearts pop), walking up to and using an activity, chasing a butterfly (day) /
  firefly (night), watching, and napping under a house or tree at night. A seasonal weather
  layer (blossom / sun-rays / leaves / snow), a rare tappable night shooting star (+1 meter,
  once per night), and an ambient sound bed (day birdsong / night crickets) under the music.
  All transform-only; concurrent animated actors and particles capped as named constants.
- **The Boo Funfair**: a fifth town zone unlocking at 280 stars (a silhouette teases it
  beforehand). Five rides — carousel, Ferris wheel, teacups, bouncy castle, helter-skelter —
  arrive one at a time, each built over ~24h by the Boo Builders at a star milestone. A
  "who's riding?" picker seats/removes Boos; autonomous Boos board empty seats; string lights
  glow at night. Each ride is one composed transform-only loop.
- **Boo Band**: a bandstand at the fair opens a playable stage — drums (multi-touch), keys
  (with a sparkly play-along that waits between presses) and guitar, each instrument
  instrumented. Records up to 3 short jams to on-device storage, replays them by event log,
  and sets one as the "band song" the fair band performs in the town. No microphone APIs are
  ever touched.
- **One shared rarity VFX system**: rare items glint, ultra shimmer with capped floating
  motes, secret get an aura, shinies a golden sparkle — identical across the box ceremony,
  the collection and the town, where distant/numerous items degrade to a static sheen so the
  emitter cap (`RARITY_TOWN_CAP`) holds.
- **Boo Beat, the musical rework**: three tracks (chill / pop / bounce), each with a melody
  and bass line; a correct on-time hit sounds the next melody note over a backing loop, misses
  thud, Perfects add a sparkle harmonic, and a combo "fever" lifts the crowd. Steady mode
  intact under reduced motion.
- **Boo Bounce, aim-and-launch**: a drag sets an aim cone with a dotted trajectory preview
  (including the first bounce) before the ball launches along it; buried target labels
  re-place so every round is reachable. Flight physics unchanged.
- **Juice & identity pass** on the three original games: glassy Bubble Pop bubbles with sky-
  by-level backdrops, droplet bursts, streak trails and an occasional +1-meter golden bubble
  (capped twice per round); Feed the Boos feeders that idle-chew, arc food to the mouth, react
  variedly to wrong deliveries and drum on a nom-streak; Spell Boo letters that chime on place
  and bounce-spell the finished word with a proud guide word-card.
- **Boo Quest, chapter 1**: "The Sparkle Meadow" — a six-node guided adventure map skinning
  the existing question engines (Smart Mix difficulty): a Bridge Builder (lay planks), a Rune
  Door (spell to open), a Grump Cheer-Off (a cloud whose mood lifts over a cheer meter), a
  Treasure Chest (bonus box) and a Boss Grump finale. Completing the land grants a unique
  explorer Boo (Scout), a Quest Flag deco, a journal stamp and a trophy exactly once; both
  quest-only items are excluded from box rolls, and the Toddler tier hides the card.
- **Performance gate + deployed motion pass (phase 9)**: an automated gate proves the three
  busiest scenes (a 20-item crowded town, the full funfair with every ride running and fully
  seated, the Boss Grump fight) hold transform-only animation at ~60fps with every named cap
  enforced under deliberate over-pressure — plus a CSSOM audit that no keyframe animates a
  layout-triggering property. Full regression of every prior acceptance suite (64 suites) and
  a fresh motion-evidence pass re-run against the live deployed build.

## Run 5: the quality run
- **Resilience quick wins**: a friendly full-screen "oops" card with Restart replaces any
  white screen (last technical message shown in the cog corner); a hub-only update toast
  applies waiting updates on demand (never mid-round, never automatically); daily rolling
  save snapshots in on-device storage (last 3, restorable); a one-time grown-up warning if
  saving ever fails; a "Jump back in" hub card replaying the last game + mode; a
  "Try Level {n+1}!" button on perfect at-comfort rounds.
- **Star Ledger + crediting invariant**: the cog corner lists total stars and per-game
  rounds/stars; an automated guard fails the build if any game ever bypasses the single
  crediting path (plus a dev-only runtime assertion).
- **Boo Blocks rework**: the dragged piece floats ~70px above the fingertip with
  centre-based drop targeting and half-cell snap; invalid drops glide back; near-complete
  lines shimmer; line clears sweep sparkles with a "+line!" flourish; a three-step
  self-explaining intro with a demo line that completes itself.
- **Boo Pop readability redesign**: colour now teaches the bonds — complement families
  share a hue AND a silhouette (five shapes, colourblind-fair), every gem a Boo face
  holding its numeral; 6x6 boards (5x5 Twin Pop) with chunkier gems; a doubled rule chip
  above the board; squash-together pops and bounce-back invalid swaps; retuned named
  thresholds (3 stars stays generous).
- **Town spaciousness**: zones are 1.7 viewports wide with a deep three-row placement
  band (front rows bigger and drawn on top); a minimum-spacing rule with a gentle
  "spot's taken" wobble; wander/scroll/activities recalibrated; existing placements
  migrated proportionally with nothing lost.
- **Phone reachability**: every screen audited at 390x844 both orientations (scroll
  traps, top/bottom reachability, tap-landing, scroll reset); flex-centred screens no
  longer clip their tops on overflow; tablets byte-identical.
- **First-play guided intros**: every game walks 2–3 short guide steps on its first-ever
  open (skippable, "?" replays, flags persist); Teach Me gets a welcome line; the Golden
  Round two steps.
- **Studio expansion**: ~36 collage props in themed drawers (Party/Seaside/Nature/
  Sparkle), four new backgrounds (bedroom, space, under the sea, blank), chunky A–Z
  sticker letters in four colours, duplicate + labelled handles, the guide as a sticker;
  Paint doubles to 24 colours with stamps (star/heart/flower/paw/sparkle) and stripe/
  polka-dot pattern fills, new colouring pages (every Boo species, the five guide
  species, playground items, a whole-town scene, two seasonal pages per season), and
  save-and-resume drafts within the gallery cap.
- **Toddler mode**: ages 4-and-under (or the cog override) get a four-card hub — Counting
  Pop, Colour Feast, Shape Sort, Letter Pop — rounds of 6, hearts hidden, wrong taps
  wobble with a spoken "try again", stars never below 2, at least 2 meter points a round,
  everything spoken aloud AND fully playable with sound off; quests/Golden Round/Smart
  Mix/Sound Twins/Trophies hidden; the same shared universe of Boos, boxes and the town;
  a little-painter kit in Paint.

## Run 4: polish and progression
- **Navigation**: the Android back button / gesture now navigates inside the app (one
  level, like the on-screen back button), never closing it by accident; confirm-on-leave
  stays for mid-round exits; a one-per-session nudge when a town zone is within 10 stars.
- **Pickers**: "🎲 Pick for me!" starts any game in one tap; spelling sets carry friendly
  names + two sample words (Full tier groups them under three calm headers); maths cards
  show sample questions; unreadable cream-card chips fixed.
- **Reward rebalance**: total stars always pay in full; a Brave bonus (+1 meter, once per
  game category per day) rewards playing above the comfy level; mastered easy rounds fill
  the box meter gently (never framed as worth less); two stretch quests.
- **The Trophy Room**: certificates (tables, bonds, spelling sets, Sound Twins, Clock
  Shop, Teach Me), per-game bronze/silver/gold medals, star + collector milestones, four
  one-off trophies — silhouettes with hints until earned; retroactive award ceremony for
  existing saves.
- **Living town**: eight activity items with real Boo behaviours (slide with a wheee,
  swings, two-Boo seesaw, trampoline, paddling pool, picnic, bumper car, night campfire);
  Boos near a Boo House sleep 21:00–07:00 (tap wakes gently); the bench and pond finally
  seat and paddle as promised; town growth milestones at 5/10/15/20/25 Boos with fenced
  Boo Builders sites that finish in 24 real hours and reveal wildflowers, fairy lights, a
  fountain, paving and bunting.
- **Boo Pop**: a gentle 7x7 match-and-pop puzzle (Twin Pop, Make 10, Make 20, Fraction
  Friends, Fact Pairs) — 20 moves, no timer, guaranteed valid pairs, free sparkle-shuffle
  and idle glow.
- **Shinies + the Star Chest**: any Boo can drop shiny (1 in 15, with a hidden mercy);
  golden ceremony, badges and Journal stamp; every 50 stars a golden chest guarantees a
  Rare-or-better Boo (triple shiny odds) plus an accessory; existing saves get one
  welcome chest.
- **Daily delights**: a hide-and-seek Boo (peeking ears, +2 meter, carries over silently),
  Boo of the Day on a podium, and a Parade button on the Dance Stage.
- **Phones**: comfortable at phone sizes in both orientations; tablets untouched
  (verified pixel-for-pixel).
- **Fixed**: town item-menu taps (Move / Put away / Dress up / Choreograph) never
  registered — a shipped bug since run 2.

## DASH_PATCH job 5: your total stars, always visible
- A small star chip beside the hub meter now shows the total star count, with a brief
  count-up whenever it has grown since last time.
- Every star requirement now reads as current / required: locked town zone signposts show
  e.g. "26 / 40 ⭐" with a mini progress bar, and the locked-zone tap hint matches. Read
  from the existing save total — no economy changes.

## DASH_PATCH job 4: the age question
- Onboarding gains one friendly step after the name: "How old are you?" with big number
  buttons (5 or younger … 12 and up). The answer quietly sets the content amount: 7 and
  under → Light, 8–9 → Medium, 10 and up → Full. Age is stored in the local save only and
  used for nothing else.
- Existing saves get the same question once, as a friendly card from the guide at the top
  of the hub ("Quick question! How old are you?"), with a small skip that keeps the current
  setting. Answered or skipped, it never asks again.
- The grown-ups "How many choices?" setting always overrides, and now shows the age mapping
  as a one-line hint. Safety: if the age step ever fails to render, onboarding continues on
  Light — the question can never block a new player from reaching the hub.

## DASH_PATCH job 3: on-screen back buttons everywhere
- One shared back control (a soft round button in the same top-left corner) now appears on
  every screen below the hub: town, collection, journal, studio + all four studio tools,
  grown-ups corner, character editor, results, the box ceremony, and every game's start
  card. It always goes back exactly one level (sub-screen to parent, game to hub).
- In-round backs keep the "Leave this round?" confirm. Hardware/gesture back is deliberately
  deferred to run 4.

## DASH_PATCH job 2: Boo Dash, run-up-and-wait
- Boo Dash rebuilt as a behind-the-character runner down a 3-lane path: parallax scenery
  (converging road with sweeping stripes and dashed lane lines, roadside trees/bushes/flowers
  at depth, drifting clouds) and a visible trot cycle.
- Each question spawns three labelled gates ahead — one per lane, exactly one correct, never
  an ungated lane — while the question stays readable on a fixed card at the top. The Boo runs
  up, then the world eases to a stop and the Boo jogs on the spot: no timer, nothing keeps
  approaching, nothing can be failed by waiting.
- Tapping the correct gate swings its doors open with a sparkle and the run continues through
  it; a 3-streak makes the running stretches faster and smoother (900 ms vs 1350 ms, one smooth
  ease curve). A wrong tap is a soft bonk: the gate wobbles, a heart dims, the same question
  stays. 12 gates a round; stars, categories, Smart Mix and the meter unchanged.
- Steady mode (gates simply appear at the line) only via prefers-reduced-motion or the new
  explicit 🐢 toggle on the start card — never the default.
- Motion audit items 7/7b rewritten for the new mechanics (scenery frames, jog-in-place,
  gate-open transition, streak speed-up, ungated-lane guard).

## DASH_PATCH job 1: hub header phone hotfix
- On phones (≤550px) the hub's top strip (sound, meter, gift) sits on its own compact row;
  the guide below shows in full and is never overlapped; the speech bubble clamps on-screen;
  everything below simply starts lower. CSS only; tablet layouts verified byte-identical.

## Run 3 — Phase 10: polish + full regression
- Hub balance verified at every tier, both orientations: nine game cards (Learn/Play rows),
  the daily-quests card, the gold Golden-Round card, and Studio in the bottom bar all read
  cleanly with best-star badges.
- Full regression green: the deterministic motion audit (15/15 mechanics incl. Clock Shop
  hands and the dance routine loop) plus 28 acceptance suites — BUILD_SPEC §14, EXPANSION_1 §6,
  RUN2 part E, and RUN3 part D (D5–D19). A final motion-evidence pass ran against the deployed
  build.
- NEEDS_ALEX.md rewritten as a short human checklist (tablet refresh, mic-allow, Golden Round,
  the Light/Medium/Full choice).

## Run 3 — Phase 9: Content setting (Light / Medium / Full)
- One global setting in the grown-ups corner controls how many choices she sees. It is a
  presentation filter only — all content stays installed, saves + mastery are untouched, and
  Smart Mix keeps drawing from everything (light UI, full brain). Default after this update: Light.
- Tags exactly per spec: Bubble Pop / Boo Dash categories (Light = Times tables; Medium adds
  Number bonds + Add & subtract; Full adds Doubles & halves + More or less); levels everywhere
  (Light = Starter–Level 2; Medium/Full = all); Feed the Boos (Light = Subject; Medium = grouped
  topics; Full = every template); Spell Boo sets (Light = Big List + Tricky Sounds + Sound Twins;
  Medium adds the listed families; Full = every bank); Arcade (Light = no picker, Smart-Mix-driven;
  Medium = Times tables + Number bonds + Words; Full = everything). Smart Mix + Golden always visible.
- New js/content.js; arcade engine gains Number bonds / Add & subtract / Doubles categories and an
  autoQuestion() (arcade maths keys now match Bubble Pop / Dash, so weakness transfers). Switching
  tiers is immediate, hides/reveals only, and round-trips with zero data loss.

## Run 3 — Phase 8: Boo requests + the Dance Choreographer
- Occasional Boo requests: at most one active at a time, a new one only at app open and at
  least 20 hours after the last resolved. A thought bubble over one placed Boo asks something
  small ("Will you play a maths game for me?"). Fulfilling it gives +2 meter and a "thank you"
  treat; unfulfilled requests expire silently after 48 hours — no message, no sad face. Off
  switch in the grown-ups corner.
- Dance Choreographer: tap a placed Dance Stage → Choreograph. A library of 8 moves
  (bounce, spin, wiggle, jump, clap, slide, star pose, freeze); build a sequence of up to 8,
  preview it, and save. Boos on that stage then perform the routine on loop (each stage keeps
  its own). Journal stamp for the first routine.
- New js/requests.js + js/choreographer.js; events wired from results/ceremony/accessories/
  studio; motion audit gains item 14 (routine loop frames).

## Run 3 — Phase 7: Boo voices
- From any owned Boo's card: "Give them a voice" — record up to 4s via the microphone, watch
  a live level meter, play it back, redo, and choose a voice: normal, squeaky or deep
  (pitch-shifted playback). Saved per Boo in IndexedDB (cap 15, oldest-first replacement prompt).
- Tapping that Boo in the town plays her recording instead of the squeak — only ever on tap,
  never ambient. A plain "recordings stay on this device only, nothing is ever uploaded" note
  sits on the recording screen.
- Grown-ups corner: a microphone on/off toggle (off hides all recording UI) and a
  delete-all-recordings button that clears the IndexedDB audio store.
- Bugfix: hand-rolled overlays (daily-quests popup, gallery view/delete, easel chooser, the
  voice recorder) were in the DOM but invisible — they never got the `.show` class the base
  `.overlay` needs. Now they fade in correctly.

## Run 3 — Phase 6: Boo Studio (paint, collage, build-a-Boo, gallery)
- A Studio joins the bottom bar. Artworks + audio now live in IndexedDB (js/idb.js); the
  core save stays in localStorage and bumps to v4 with lossless migration. Gallery holds 20;
  a kind prompt appears when full.
- Paint-a-Boo: species outline templates + a blank egg; brush (3 sizes), flood fill, sparkle
  pen, eraser, 12 colours + rainbow, undo (10). Saves a ≤640px PNG to the gallery.
- Collage: pick a background, place your own Boos (with accessories), 12 props and text;
  drag, scale, rotate; saved as a rasterised PNG.
- Build-a-Boo: a parts workshop (bodies/ears/eyes/mouths/tails/patterns + colour). Name and
  SEAL it; sealed customs (cap 5) enter the mystery-box pool with a 10% slice while unwon.
  Winning one plays the ceremony with an "It's YOUR Boo!" banner, leaves the pool, and it
  then lives in the collection ("Boos you built") and town like any Boo.
- Gallery: grid, full-screen view, press-and-hold to delete. A free Art Easel deco is granted
  with the Studio — place it in the town and choose an artwork to display on it.
- Journal stamps: first custom built + first custom won. New js/customs.js + a parametric
  custom-Boo renderer in art.js.

## Run 3 — Phase 5: Clock Shop
- New game: Boos queue at a shop counter with time orders ("Half past 3, please!"). She
  sets a large analogue clock by dragging the hands — the hour hand moves proportionally
  as the minute hand travels (never jumps), with gentle level-based snapping.
- Levels: 1 o'clock + half past; 2 quarter past + quarter to; 3 five-minute times with a
  digital display to match. 8 orders a round; wrong settings wiggle the clock; the hint
  ghosts the correct hands for ~1s then fades. Standard stars; feeds the meter.
- New js/games/clockshop.js + a 9th hub card (Learn row). Added to the motion-evidence
  audit (item 13: real minute-hand drag proves the proportional hour hand + ghost fade).

## Run 3 — Phase 4: Daily quests + the Boo Journal
- Three fresh quests each local day (from a template pool, filtered to installed features),
  shown as a hub card with a 0–3 badge and a tap-through list. Completing all three awards a
  bonus box. No streak counters, no missed-day guilt — a new day simply offers three new quests.
- The Boo Journal: a scrapbook tab in Collection that self-stamps dated stickers — first
  rare/ultra/secret, first 3-star per game, each zone unlock, a golden 3-star, an all-quests
  day (one per day), and (wired for later phases) first custom Boo / first dance routine.
  Stickers sit on flippable pages.
- New js/quests.js (quest logic + Journal). Events wired from results, town, ceremony,
  accessories, blocks and beat via noteQuest()/stampJournal().

## Run 3 — Phase 3: Golden Round
- Grown-ups corner gains a Golden Round editor: up to 10 spelling words (each with an
  optional sound-twin flag + rival spelling + clue) and up to 5 choice questions, all
  parent-typed. Saving publishes a gold-trimmed challenge card at the top of the hub.
- Playing: spelling words run the tile flow (twin-flagged words run as a Sound Twins item —
  pick the right spelling, then spell it from memory); choice questions are big-button picks.
- Worth double stars + a +2 meter bonus on a 3-star clear, ONCE per local day; same-day
  replays earn normal stars. A new saved list replaces the old. No AI — typed content only.
- Extracted the tile speller to js/speller.js (shared by Spell Boo + Golden). New js/golden.js;
  results.js banks a meterOverride for Golden; state gains a todayKey() day helper.

## Run 3 — Phase 2: Smart Mix + the Tricky Pile
- Mistake ledger in the save: every question identity (a fact key, a word, a twin set)
  keeps { rights, misses, lastSeen }. Mastered = rights ≥ 3 and rights − misses ≥ 2.
  All seven games now feed the ledger on every answer (weakness transfers between games
  that share a fact key, e.g. Bubble Pop ↔ Boo Dash).
- Smart Mix is the first card on every picker (games + Spell Boo): a weak-weighted round —
  40% weak (recent first) / 40% level-appropriate not-mastered / 20% mastered due a refresh.
  Sound Twins and Tricky Sounds th words get double weight while weak. Draws from ALL
  installed content (light UI, full brain). Spell Boo mixes words + twin items in one round.
- The Tricky Pile: a Puzzled Boo appears at the side of a round and collects up to 3 missed
  items; the results screen offers a Rescue step (untimed, hints free, does not change the
  round's stars) — each rescue sparkles and adds +1 meter. Unrescued items persist and seed
  the next Smart Mix (they stay "weak" in the ledger).
- New modules: js/smartmix.js (selection engine + ratio plan), js/trickypile.js (collector,
  Rescue, persistence). rewards.js gains addMeterPoints(); results.js hosts the Rescue step.

## Run 3 — Phase 1: Spell Boo integrity + her weak spots
- Auto-look replaces free Peek: every normal word flashes clearly for 2s at the start
  (the uniform, free "look" in look-cover-spell), then hides so she spells from memory.
- Peek is now a HINT: pressing it after auto-look counts toward the 2-hint budget (shared
  with the next-letter hint) and caps the round at 2 stars, like every other game. The
  audio replay button stays free and unlimited. Homophone/clue words never auto-show —
  the clue shows instead — so voice-off rounds stay fully playable.
- New Sound Twins mode on the Spell Boo picker: a blank sentence with the twin spellings
  as big buttons; a wrong pick shows a one-line explanation of the right twin, then she
  spells it from memory (buttons hidden); a correct first pick goes straight to tiles.
  All sentences reused verbatim from EXPANSION_1 §26/§27/§3.1 (no invented sentences).
- New Tricky Sounds (th) bank added to the word sets: with, this, that, then … Thursday (24 words).

## Run 3 — Phase 0: mechanics audit + repair
- Motion-evidence audit of all 12 run-2 mechanics (≥6 frames over ≥3s each, measurable
  inter-frame change required). New deterministic gate: `tests/audit.mjs` + `tests/lib/motion.mjs`
  (sharp-based pixel deltas + numeric probes). Result: 13/13 PASS across repeated runs.
- Boo Dash verified as a genuine runner with frame evidence (arches measurably closer
  frame-to-frame, runner steers to the tapped lane), not trusted blind.
- Fixed the one genuinely flat-shipped item: the hub guide now idles — a gentle bob
  (`art-idle`) and a blink (new `.art-eyes` keyframe), both auto-disabled under
  prefers-reduced-motion. The run-2 test that "covered" this had passed vacuously.
- `__bounce` test hook now exposes ball position for deterministic motion assertions.

## Run 2 — Phase 9b: Boo Dash is a real runner now
- Boo Dash rebuilt with genuine motion: the answer gate spawns small up the path and
  approaches the trotting runner, growing as it nears; the ground scrolls to sell the trot.
  Tapping an arch steers the runner underneath it and dashes through with a sparkle. If she
  doesn't answer, the gate simply waits at the line, bobbing — no countdown, no falling
  behind. The trot quickens after a 3-streak; a bonk makes the same fact re-approach slower.
  Reduced-motion keeps the calm static presentation. (Previously the arches were static,
  which made the game feel like a plain multiple-choice quiz.)

## Run 2 — Phase 9: Final polish + full regression
- Hub confirmed reading cleanly as two labelled rows (Learn / Play, eight equal-size cards) in
  both landscape and portrait.
- Celebration confetti now clears on screen navigation so it never lingers into the next screen.
- Full acceptance re-run green: BUILD_SPEC section 14 (machine-runnable parts), EXPANSION_1
  section 6, and RUN2 part E. README and the human checklist refreshed. The public repo history
  is clean end to end — no private planning files or personal strings in any commit.

## Run 2 — Phase 8: Teach Me + Boo Dash (EXPANSION_2 frames 1 & 4)
- Teach Me: short guide-led mini-lessons, each concept explained two ways. Six lessons at
  launch (hundreds/tens/ones, jumping over ten, counting up, fractions, times tables, telling
  the time), each a sequence of cards — a hook, explanation A, a tap-through worked example,
  explanation B, then a three-question quick check. Five visual primitives (place-value towers,
  number line with hops, fraction circle, dot array, clock) are implemented once; all lessons
  are data. A wrong check routes back to the explanation, the guide encourages, and re-asks a
  variant. Stars: 3 all-right, 2 one slip, 1 finished.
- Boo Dash: a gentle fluency runner. The player's character trots along a path; a gate shows a
  fact; three arches span the path (one correct); tap the correct arch to trot through. A wrong
  arch is a soft bonk — the same fact returns, slower — with no death or countdown. 12 gates,
  reusing the Bubble Pop generators. Stars: 3 clean, 2 up to three bonks, 1 finished.
- Hub regrouped into labelled Learn and Play rows (Teach Me first in Learn) — eight games,
  equal-size cards, readable at a glance in both orientations.
- Story Nook and Puzzle Plates stay parked: their content is authored and ready in
  data/stories.js and data/puzzles.js for a future run.

## Run 2 — Phase 7: EXPANSION_1 content (deep Year 3/4)
- Bubble Pop gains four new question categories alongside Times tables (now with a Starter
  level): Number bonds, Add & subtract, Doubles & halves, and More or less (place value,
  with comma-formatted four-digit numbers). Start card is now a two-step picker.
- Feed the Boos gains 14 new maths templates (place value, months/days, time, money, length,
  mass, capacity, temperature, Roman numerals, symmetry, angles, fraction families, tenths)
  and 4 English templates (noun/verb/adjective, plurals, their/there/they're, to/too/two),
  plus a Maths/Words top-level choice. New readable item types: big letters, angle icons,
  sentence cards.
- Spell Boo gains 14 themed word banks (prefixes, -ly, -ous, -tion/sion, ch=k, ch=sh, gue/que,
  silent sc, ei/eigh/ey, ou=u, -ture, double-or-not, and homophones with clue sentences).
  A word-set picker sits alongside the statutory Big List; homophone clues make them playable
  with or without voice.
- Catalogue wave 2: 20 new collectibles (52 total) incl. two new species (Snug, Zippy) and
  the secret tiny giraffe Twiglet, with Summer / Spooky / Winter seasonal drops gated by the
  device date (out-of-season items show as silhouettes with a season icon and a teasing hint).
- Shared two-step pickers show per-choice best-star badges and remember the last played.
  All content implemented exactly as written in EXPANSION_1.md; §6 acceptance passes.

## Run 2 — Phase 6: Boo Beat (new game)
- A three-lane rhythm game on the game's music at 100 BPM. Each phrase poses a question
  (a fact, or a spelling gap like "be_ieve"); three on-beat notes carry candidate answers
  down the lanes; tap the correct lane as its note reaches the glowing hit line where the
  player's character bops. Timing grades: Perfect (±80ms, big sparkle), Good (±160ms),
  otherwise a soft miss, a dimmed heart and one re-ask. Combos add a background sparkle glow.
- Steady mode (and the reduced-motion default): notes step one row per beat instead of
  scrolling — same taps, no speed pressure. TTS reads the spelling clue word when voice is
  on. Ten phrases per round. Stars: 3 = 8+ right with 5+ perfects; 2 = 6+ right; 1 = finished.
- Sixth hub card. Hub game cards re-flowed (max-width) so six cards lay out cleanly.

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
