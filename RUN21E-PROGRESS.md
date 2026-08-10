# RUN21E-PROGRESS.md — ledger ("Every Area a Job")

Branch `run21e` from main@22b8d40 (run21f-20260804). Worktree `..\Boo-town-run21e-wt`, port **8041**.
Governance: TONIGHT-2026-08-10/GOVERNANCE-TONIGHT.md in force (decide-and-record, no parking).
Save is **v24** — E adds ONLY additive keys with safe defaults, NO version bump.

## Status board

| Item | Title | Status |
|---|---|---|
| E1 | Riverside — jetty, float sailing, feedable ducks | TODO |
| E2 | Hilltop — train line, kite rack, rain windmill | **DONE** (17/17) |
| E3 | Beach — tide, shells, sandcastle persists | **DONE** (19/19) |
| E4 | Playground — tag, ring-a-roses, notice poster | **DONE** (15/15) |
| E5 | Meadow — signpost (shared Today card) | **DONE** (7/7) |
| E6 | Funfair — fair day (Saturday) | **DONE** (19/19) |
| E7 | Boo House — pretend-night lamp | **DONE** (18/18) |
| E8 | Gallery — three pins + Featured Wall | TODO |
| E9 | Surfaces wave two (mantelpiece, windowsills, 3 smalls; consider outdoor parent) | TODO |
| E10 | Outdoor hang points (lantern, bunting swags) | TODO |
| E11 | Adjacency delights (moth, frog/dragonfly, marshmallows) | **DONE** (15/15) |
| E12 | Dead-prop amnesty (fridge, oven, bathtub, wardrobe, mirror) | **DONE** (22/22, 18s) |
| E13 | Acknowledgement wave two (3 ack lines) | **DONE** (11/11) |
| E14 | Photo mode → postcards | TODO |
| E15 | Per-area growth tracks | TODO |
| H1 | Verify pumpWishIdles re-pointed to !softened (C report note 2) | DONE (verified) |
| H2 | L_PATH_FULL "Erase some to lay more" fix (sanctioned) | DONE |
| H3 | B1 APPROVED: bias maybePickBehaviour goals toward path runs + 90s observation | **DONE — observation PASSES, entry restored** |
| H4 | D's debt: playground Pulse invitation → `Someone fancies a game of tag…` (after E4) | **DONE** |
| F8 | Leitmotifs: APPROVED-TO-COMPOSE — compose 5 loops + audition tool; shipping GATED on SIGNED-OFF | TODO |
| F9 | Voice: VOICE still HELD → SKIPPED-GATED | GATED |

## Gate lines observed (NEEDS_ALEX.md, 2026-08-10 block)
- `LEITMOTIFS: APPROVED-TO-COMPOSE` (line 404) — compose allowed, ship gated on SIGNED-OFF.
- `B1: APPROVED — bias goal destinations toward path runs; restore the What's New entry only if the 90s observation passes` (405).
- `VOICE: still HELD` (409) — F9 stays gated.

## Evidence — handover items

**H1 (pumpWishIdles) — VERIFIED, no change needed.** `js/town.js:6117`:
`const wishIdleTimer = setInterval(() => { if (!document.hidden && !softened) pumpWishIdles(); }, 2000);`
with the RUN21C merge comment directly above (lines 6114–6116) and the cross-run note at 590–593.
The gate reads `softened` (kept current by `updateSoftened()` ← `worldSoftened()` = drawer open ‖
chip held ‖ pot held), exactly what the C report required. Cleanup clears the timer (6560).

**H2 (L_PATH_FULL) — DONE.** `data/guideLines.js:149`:
before `"That's a LOT of path! Erase some to lay more."` →
after `"That's a LOT of path! Paint over some to lay more."` — names the verb the control has
(painting over sweeps away, per PATH_POT_HINT). `tests/r10p3-buildmode.mjs:264` asserts
`/LOT of path/i`, which still matches; suite re-verified at the E-area packet gate.

## Decisions (governance §1 format)

**DEC-1 · E12 verbs run on the play path only (`!softened`), so a plain tap on these five props
no longer opens Move / Put away.** WHY: the pack asks for a response to her finger, and the wish
verbs already established exactly this shape (`if (!softened && wishTap(...)) return;`). Arranging
is still one gesture away — with the tray open, or on a long press — and a prop that answers is
worth more to a child than a prop that offers a menu she rarely wants. REVERSIBLE: delete one line
in `onTap` and the menu returns.

**DEC-2 · E12 props are NOT added to `ACT_IDS`/`SOCKETS`.** WHY: doing so would make the 4-second
role sweep claim them ambiently — a fridge that opens itself, a bath that fills with nobody asking.
The pack's verbs are all tap-initiated. REVERSIBLE: an id in a list.

**DEC-3 · The E13 ack lines are registered as four separate ACK_MOMENTS (walls and floors split).**
WHY: they are two different authored sentences; one moment with a swapped line key would make
`once` mean the wrong thing for the pair. REVERSIBLE: merge two entries.

**DEC-4 · E5 ships a NEW `deco_noticepost` rather than reusing the existing `deco_signpost`.**
WHY: `deco_signpost` already exists — a 12-star shop decoration whose own blurb says it "points
four ways at once". The pack asks for a seeded, free, ONE-ARM fixture beside the Well. Seeding a
purchasable item free would undercut the shop; giving the four-armed one a single arm would
rewrite a thing children already own. So the fixture is new, and the existing Signpost gains the
SAME tap verb — it is a signpost with nothing to say, which is the definition of the dead prop
E12 exists to abolish. REVERSIBLE: delete one catalogue row and one `onTap` id.

**DEC-5 · The Today card is readable during a read-only visit.** WHY: reading the news grants
nothing and writes nothing — it is the same class of tap as the pond ripple, which F6 already
allows. Gating it would make a visited town's noticeboard a dead prop. REVERSIBLE: one `READONLY`
check.

**DEC-6 · `isFairDay()` (E6's Saturday check) is built now, inside E4.** WHY: E4's own ACCEPT
requires the fair-day line in one of its four seeded states, and a stub returning false would fail
it. It lives in ONE helper so E6 reads it rather than growing a second source of truth.
REVERSIBLE: it is four lines.

## H3 / B1 — the approved decision, and the observation it was conditional on

**What the C run proved and what it could not.** RUN21C item 5 pulled the MICRO-WANDER toward a
path run. The mechanism was real and measured, and it was invisible: goals own 56-62% of a Boo's
time, and the micro-wander is clamped to `WANDER_FRAC` — 4.5% of the area — so the pull could never
carry a Boo more than a few pixels. C's own re-measurement was worse than nothing: with the path on
the RIGHT the drift went further LEFT than with no path at all.

**What I built.** The approved fix, at the only place goals pick destinations: a new `pathwalk`
GOAL, weighted 2.6 (a peer of `approach` and `nap`) and offered only when there is a run of two or
more cells in the Boo's own depth row within 0.35 of the area. It walks to the near end of the run,
then pads its whole length, acknowledging the path on arrival as any wanderer does. RUN21C-5's
machinery (`PATH_REACH_X`, `PATH_PULL_CHANCE`, `pathWalkTargetDx`, the micro-wander branch) is
byte-identical — this is added beside it, not instead of it.

**The observation** — `tests/r21e-b1-observe.mjs`, 90 seconds per case, fresh context each, one
lone Boo at x 0.20 on row 1, the two runs placed symmetrically 0.075 either side of her. Criteria
were written into the file BEFORE the numbers came in.

| case | mean drift | samples on the path | pathwalk goals seen |
|---|---:|---:|---:|
| path-left | **-0.0268** | 34.6% | 13 / 179 |
| no path (control) | +0.0100 | 0.0% | 0 / 179 |
| path-right | **+0.0879** | 69.8% | 15 / 179 |

DIRECTION: PASS (left < control < right). OCCUPANCY: PASS (both ≥ 25%; control 0%).
Evidence: `_evidence/run21e/b1-observation.json`, `b1-path-left.png`, `b1-no-path.png`,
`b1-path-right.png`. **Therefore the withdrawn What's New entry is RESTORED**, under RUN21E's
stamp — where the behaviour that makes it true actually ships.

**One thing the first run of this observation caught, worth recording.** My first fixture wrote
path cells at `cy: 1` believing that meant depth row 1. It does not: `cy` indexes the fine paint
grid (5% of the placement band), so `cy: 1` lands at 0.6425 of viewport height — depth row 0 — and
the Boo could never have been standing on the path the measurement was scoring her against. Row 1
is `cy: 11`. A test that measured the wrong ground would have "proved" the feature either way.

## Deviations

**DEV-6 · E4-C "the notice poster speaks".** Pack said → tap the poster. What was true → the
poster is drawn inside `.t-zone-props`, which is `pointer-events:none` BY LAW so that a placement
tap falls through it (`tests/r7p2-zones.mjs:78-82` pins this). What I did → added a separate 92×76
button in the ground layer sitting exactly over the drawn board — the shape the fair signs and the
bandstand already use — and left the SVG purely visual.

**DEV-7 · E4 "at the `<Area>`" templates.** Pack said → `at the <Area>`. What was true → area names
carry their own articles (`The Meadow`, `Sunny Beach`), so the literal template ships "at the The
Meadow". What I did → `at <Name>`, the same correction the socket-claim line already makes. The
authored strings therefore ship as `Someone's playing hide-and-seek at Sunny Beach! 👀` and
`The Boo Builders are busy at The Meadow…`.

**DEV-8 · E4-B "reuse the campfire circle transform".** Pack said → reuse it. What was true → the
campfire "circle" is a NIGHT-ONLY role needing a placed campfire, and it does not circle: three
Boos stand at fixed ring offsets with an arrive-lerp and a sway. What I did → made ring-a-roses a
daytime GOAL that borrows that math (slot offsets, arrive-lerp, per-slot phase sway) and adds the
rotation the game's name promises. Same feel, no fire required.

**DEV-9 · E4-A "weight as riverside behaviours".** Pack said → weight them as riverside's. What was
true → riverside is a three-rung ladder (1.9 / 1.5 / 1.3) and the playground has two acts. What I
did → took the top two rungs, tag first — which also makes tag the Pulse's guaranteed opening beat
there, so the authored invitation and the beat name the same game.

**DEV-10 · E4-A "sporty personality ×1.5".** Pack said → apply it. What was true → zone-behaviour
candidates received NO personality multiplier at all; `personalityMult` was applied only to
visit/approach/chase/watch/nap/musicwatch. What I did → applied the multiplier to the zone-candidate
push (behaviour-neutral for every pre-existing zone act, since none appear in `WEIGHTS`) and added
`tag: 1.5` to `sporty`.

**DEV-35 · E11 "night/pretend-night" and "dusk/pretend-night".** Pack said → gate on those. What
was true → E7's pretend night is ROOM-LOCAL to one Boo House room, by its own ACCEPT, and every
E11 scene is outdoors, so the two can never meet. There is also no "dusk" state: the four time
bands in this codebase are `isNight` (19-7), `bandOfHour` (dusk 17-19), `skyBandName` (dusk 17-18)
and `duskVisitor` (18-21). What I did → moth on `isNight`, frog/dragonfly on `!isNight`, and the
campfire scene on the campfire circle ACTUALLY RUNNING, which is `isSleepTime` (21-7) — the hours
the circle exists at all.

**DEV-36 · E11 "campfire + 2 SEATED Boos".** Pack said → seated. What was true → Boos are never
seated at a campfire: `deco_campfire` has no `SOCKETS` entry and is not in `ACT_IDS`. The only
campfire behaviour is the night circle role, where up to three Boos STAND in a ring. What I did →
triggered on two or more actors actually holding that role for that campfire, which is the thing
the pack is describing.

**DEV-37 · E11 "the frog wish (if owned+placed anywhere)".** Only the CURRENT area renders, so a
frog in another area cannot hop across the map. What I did → her frog comes if it is placed in
this area; otherwise the authored dragonfly fallback visits. Both branches were already in the
pack, so nothing is invented — only the reading of "anywhere" is narrowed to what can be seen.

**DEV-38 · E11 the moth needed a lit lamp.** `deco_lamppost` was missing from `LAMP_IDS`, so it
has never received `.lit` and has stood dark through every night since it shipped — while its own
catalogue blurb promises "Glows warm and gold so no Boo is ever scared of the dark". Its art has
carried an unused `.lamp-glow` group all along. Added it to `LAMP_IDS`: one line, and the moth now
loops a lamp that is actually alight.

**DEV-39 · E11 "budgeted 2/session (shared)".** The counter is MODULE-scoped. Declared inside
`mount()` it would have meant 2 per VISIT — a child walking in and out would have seen them over
and over — which the suite now pins from both sides.

**DEV-31 · E7 "fairy-lights glow".** Pack said → they glow during the pretend night, and its own
acceptance scene is the KITCHEN. What was true → fairy lights are a BEDROOM-only built-in; the
kitchen has a window, a sink and a shelf. What I did → implemented it as "where the room has them"
(the bedroom), and the kitchen's pretend night shows the dim, the starry window and the lit lamps.
Inventing a kitchen fairy-light to satisfy the sentence would have been scope invention.

**DEV-32 · E7 "nap likelihood tripled".** `NAP_CHANCE` is 0.5, so ×3 saturates at certainty. During
a pretend night indoors, a qualifying pause always considers the bed — which IS min(1, 3×0.5),
stated plainly rather than dressed up as a multiplier.

**DEV-33 · E7 "one pretend-night at a time" and leaving mid-dusk.** The pack does not say what
happens if she leaves the room and comes back inside the 90 seconds. DECIDED: it is still dusk in
there, for the REMAINDER, and it still ends with "Morning again!". The alternative (ending it
silently on unmount) contradicts the pack's own "auto-ends at 90s with the line". The record is
module-scoped with a wall-clock deadline; the mount that finds it re-arms the remainder, and the
per-mount timer is cleared on unmount.

**DEV-34 · E7 the dim needed a transition.** Nothing eased the room's night filter — the class is
normally set before first paint, so no one had needed one. Without it a pretend night SNAPS. Added
`transition: filter 1.2s` to `.t-dressing` (authored night values untouched) with a reduced-motion
path.

**DEV-25 · E3 "+1 ✨ fly to the stardust count".** Pack said → fly to the count. What was true →
there IS no stardust count on the town screen (the only visible one is on the collection screen),
and `st.sparkles` is a different thing entirely — the Sprinkle day-stamp map, not a currency. What
I did → credited `st.stardust` (the literal reading; stardust has a real in-town spend at 5 per
Sprinkle) and flew the `+1 ✨` off the shell itself. There is nothing to fly TO, and inventing a
counter would have been a second place for the number to be wrong.

**DEV-26 · E3 "positions daily-deterministic (hider pattern)".** Pack said → the hider pattern.
What was true → the hider is `Math.random()` THEN persisted; it is not deterministic from the day
at all. The codebase's real daily-deterministic idiom is `dayNoise()` over a day-keyed string with
nothing stored (`isRainDay`, `booOfTheDay`). What I did → used that, and saved only which shells
she has PICKED UP.

**DEV-27 · E3 "night keeps low".** The two authored windows plus that clause collapse to a single
hour test — everything outside 06:00-13:59 is low, including the whole night — so `tideFor()` says
exactly that rather than pretending there is a third state.

**DEV-28 · E3 "change applies at mount only, no live animation".** True as authored, but
`renderZoneScenery` re-runs on EVERY `renderPlaced` (drags, placements, undo, sparkles), so
computing the tide inside the scenery would have flipped the waterline mid-session on the next
drag. `TIDE` is frozen once in mount scope and passed down through the existing `opts` channel.

**DEV-29 · E3 the two one-shot lines land through `sayInWorld`, not the hint bar.** FOUND BY THE
FIRST TEST RUN, and it is a real child-facing defect rather than a test artefact: written to
`hint.textContent`, the tide line was reliably replaced by the Pulse's own signature beat
("Squish, squish!") about 900ms after first paint — a child would never have read it. `sayInWorld`
is the announced-moment primitive built for exactly this, and it speaks too, so a voice-off house
gets the same moment. When both lines are due at once the castle's wins, as the pack orders.

**DEV-30 · E3 "the Boo-built sandcastle" (singular).** Boos build them repeatedly all day. Only the
NEWEST is saved — one castle, never a beach of them. The build animation still plays every time.

**DEV-22 · E13-2 "a Boo ENTERS a room".** Pack said → detect a Boo entering. What was true → Boos
never walk between rooms; an interior actor is spawned from that room's own placements at mount,
and `applyDressing` recorded no timestamp at all. What I did → recorded `{roomKey, slot, t}` at
MODULE scope (a room switch is a remount, so a mount-local record would be gone before a Boo could
meet the new wall) and fire the line the two ways a Boo really does arrive in a decorated room:
she mounts the room with one already in it, or she puts one down there. Two minutes, as authored.

**DEV-23 · E13-3 "once per day" vs ack.js's no-persistence stance.** `js/ack.js` states plainly
that nothing about how often she has been complimented is ever written to the save. But "once per
day" cannot mean anything across a reload without a day stamp. DECIDED: store exactly ONE additive
key, `delights.newItemAckDay` (safe default `undefined`, no VERSION bump), following the existing
`delights.crowns` day-stamp precedent. The budget itself stays module-level and unwritten — what
persists is the DAY, not the niceness. Logged because it is a deliberate, minimal exception to a
stated stance.

**DEV-24 · E13-1 "the `<Area>`".** Same double-article correction as DEV-7: the authored line
supplies "the", so the area name is substituted BARE (`Look how busy the Meadow is getting!`). The
guideLines template is unchanged and still substitutes literally — `js/town.js` is what strips the
article, which the suite pins from both ends.

**DEV-16 · E2-A "first sky-tap summon in each real-clock hour plays it (existing rule)".** Pack
said → an hourly rule exists. What was true → there is no hour-based gate anywhere in the file;
the summon has always been ONCE PER VISIT (`areaSeen.train`), and the train was never silent — it
played `sfx.chime(4)`. What I did → kept the shipped once-per-visit gate (the stricter of the two,
and the one the Pulse's signature beat already depends on), and made "stops being silent" true by
giving it a real two-note whistle of its own (`sfx.choo()`, original synthesis) in place of the
generic chime. Twiggy's line is once per visit exactly as the pack says.

**DEV-17 · E2-A the hour word.** No hour-word helper existed anywhere (the clock game prints
digits). Added `HOUR_WORDS` + `hourWord()` in `js/town.js`: 12-hour, lowercase, with both noon and
midnight reading `twelve` — the way a child says it out loud. Line authored in
`data/guideLines.js` as `hilltopTrain`, per the house rule that guide strings live there.

**DEV-18 · E2-B `land_kiterack`.** Pack said → a `land_*` id. What was true → no `land_*` id
exists anywhere; every landscape item is `deco_*` with `kind:'landscape', free:true`, and the
toybox / no-drop / outdoor-only / unlimited-stock behaviours all key off `kind` and `free`, never
off the prefix. What I did → shipped it as `deco_kiterack` so it inherits all of that
automatically, and logged the rename here.

**DEV-19 · E2-B "within 20% x of a rack".** The pack does not say which space. Implemented as
0.20 of the AREA (zone-x), the only x the save has — which outdoors is generous, roughly
four-fifths of a screen. Deliberate: a child parking a kite "by the rack" should not have to be
precise. Three pegs = three kites; a fourth by the same rack keeps flying free rather than
being refused.

**DEV-20 · E2-B "flies permanently".** Nothing is stored. Rackedness is DERIVED from the
placements on every render, so putting the rack away simply lets the kite go back to the sky.
Permanence with no save change and no migration — v24 is untouched.

**DEV-21 · E2-C the rain flag.** The flag exists, but the scenery pipeline never received it, and
the mount-scoped `currentSeasonName` is set by `renderWeather` AFTER the scenery is built — so
reading it from inside the scenery would have raced and silently produced `''`. Rain is now
computed at the `zoneScenery` call site with the same expression `renderWeather` uses and passed
through the existing `opts` channel.

**DEV-11 · E6 "the existing box-ceremony granting ONE small prize".** Pack said → run the box
ceremony. What was true → three things make that impossible as written: the box ceremony
(`js/ceremony.js` → `openOneBox()`) REQUIRES and CONSUMES a box from `st.boxes`, it rolls the prize
at RANDOM from the drop pool (there is no forced-prize parameter outside test hooks), and both its
exits navigate to the HUB — walking the child out of the fair in the middle of her own party. The
four named prizes are also WISH words, which the box pool does not contain. What I did → gave the
gift through the ceremony the wishes already own: the booth's line, then `wishPuffAt` + a real
placement + the `wish-arrive` flourish, in the fair, where she is standing. It is a witnessed gift
ceremony — the pack's intent — without the three losses. Recorded here because it is the largest
single deviation in this run.

**DEV-12 · E6 "popcorn ambient rate ×2".** Pack said → double an ambient rate. What was true →
there is no ambient popcorn anywhere in the app; the only popcorn that has ever existed is the
tap-triggered area signature's three kernels. What I did → doubled the kernels per burst on fair
day (3 → 6), which puts the doubling where the popcorn actually is. Building a timed emitter would
have been a new parallel system with its own pacing caps — exactly what the engine-reuse law
forbids.

**DEV-13 · E6 "string lights on in daytime".** Pack said → turn them on. What was true → "lights
on" is a side effect of `.ff-scenery.night`, which ALSO recolours the far-wheel silhouette and is
what three suites read as "it is night at the fair". What I did → a separate `.fairday` class with
its own bulb rule. Saturday is not night; it is a party.

**DEV-14 · E6 "extra bunting between ride tops".** Pack said → strung between the ride tops. What
was true → rides are separately positioned DOM boxes in a different stacking context from the
single whole-zone scenery SVG, so nothing can literally attach to their tops without a new overlay
system. What I did → drew a third swag with its own flags at the ride-top band (0.335 of scene
height) inside the existing scenery generator. From the child's seat it is bunting across the
rides; from the code's seat it is one additive string.

**DEV-15 · E6 "second tap: normal booth".** Pack said → fall back to normal booth behaviour. What
was true → the booth has never responded to anything; there is no normal behaviour to fall back
to. What I did → the booth button EXISTS only on fair day (so non-Saturdays are literally today's
normal, and there is nothing to have missed), and a second tap the same day gives a tap sound and
a sparkle — an acknowledgement, never a refusal, never a "you already had yours".

**DEV-1 · E12 "removed from any dead-prop grandfather list/comment".** Pack said → such a list
exists. What was true → it does not: grepping `js/`, `data/`, `tests/` and every `*.md` finds only
CLAUDE.md's "No dead props" law (which binds NEW placeables) and a historical comment in
`data/wishlife.js:4`. What I did → treated the ACCEPT clause as satisfied by the verbs existing,
and did not invent a list to delete from.

**DEV-2 · E12 wardrobe "existing openDressUp, `from` preserved".** Pack said → `openDressUp` takes
a `from`. What was true → its signature is `openDressUp(booItem, {onDone, highlight, highlightLabel})`
(`js/accessories.js:248`); it is a body-appended overlay that never navigates, so there is no `from`
to preserve — that convention belongs to `ctx.go` routes. What I did → called it exactly as the
existing menu path does: `openDressUp(item, { onDone: () => renderPlaced() })`.

**DEV-3 · E12 fridge "a random FOOD wish art peeks".** Pack said → (implicitly) any food wish.
What was true → the FOOD class is exactly seven words (`cake apple pizza banana carrot cheese
cookie`, `data/wishlife.js:61-62`) and `WISH_ART` holds one drawing each. What I did → picked from
those seven and injected the drawing as a nested inline `<svg>` inside the fridge's own viewBox —
never emoji, per the art law.

**DEV-4 · E12 bath "paddle pose".** Pack said → a pose. What was true → the paddle "pose" is a
per-frame transform inside `stepRole`'s `case 'paddle'`, reachable only by claiming a socket — and
socketing the bath would make the role sweep fill it ambiently (see DEC-2). What I did → added a
tap-initiated `bath` goal whose step branch uses the paddle case's own numbers verbatim
(`sin(T/900)*12`, `sin(T/500)*4`, `rotate(sin(T/700)*8)`), so it is the same motion by reuse rather
than by copy-paste of a role.

**DEV-5 · E12 bath/oven overlay parenting.** The foam, the duck and the steam attach to the PROP's
wrap, never to the actor's `svg` — `stepGoal` rewrites that transform every frame and anything
parented there is wiped by the next one.

## Wall times (everything actually run, in order)
| Suite | Result | Wall |
|---|---|---|
| `r12s1-routes` (core, baseline before any edit) | PASS | 2m00s |
| `r21e-jobs` (new; E12) | PASS 22/22 | 18s |
| `r21e-jobs` (E12+E4+E5) | PASS 51/51 | 36s |
| `p3-town` (re-pointed: SEEDED_LANDMARKS) | PASS | 11s |
| `r21d-alive` (@serial; re-pointed: invitation + PROOF.zone) | 209/209 assertions PASS; suite FAIL on `ERR_NO_BUFFER_SPACE` + its knock-on module fetch — the box's socket exhaustion under seven lanes, named as such in the lane brief. Two runs, same infra error, zero functional failures. | 4m19s |
| `r21e-jobs` (E12+E4+E5+E6) | PASS 70/70 | 40s |
| `r7p1-funfair` | PASS (47) | ~50s |
| `r6p2-funfair` | PASS (27) | ~30s |
| `r18d-funfair-scenery` | PASS (20) | ~25s |
| `r21e-jobs` (E12+E4+E5+E6+E2) | PASS 87/87 | 62s |
| `r7p2-zones` | PASS (24) | ~40s |
| `r10p1-worldmap` | PASS (77) | ~90s |
| `r20-wishlife` | FLAKE then PASS (74). First run died on a `.hub` boot timeout — the failure mode the handover names. One serial re-run per board law: clean. | ~2m |
| `r21e-jobs` (all five packets so far) | PASS 98/98 | 68s |
| `r19z4-acknowledge` | PASS (34) | ~45s |
| `r21e-jobs` (E12+E4+E5+E6+E2+E3+E13) | PASS 117/117 | 55s |
| `r8p1-migrations` (core; the additive `beach` key) | PASS (334) | ~2m |
| `r13bt8-town-dressing` (@serial; beach scenery census) | PASS (52) | ~90s |
| `r17x4-whatsnew` (deploy gate: every route resolves) | PASS (116) | ~95s |
| `r18a-buildstamp` | PASS (8) | ~15s |
| `r21e-jobs` (all eight packets) | PASS 135/135 | ~75s |
| `r10p4-interiors` | PASS (40) | ~50s |
| `r13t4-furniture` | PASS (37) | ~50s |
| `r13bt7-room-identity` | PASS (40) | ~55s |
| `r13t3-house-rooms` | PASS (56) | ~70s |
| `r19z3-moments` | **PRE-EXISTING FAIL, proved not mine** — one pillow-clearance assertion (`eyes 456, pillow 460`). Identical on two runs, identical with my working files stashed, and **identical on a pristine `main` checkout served on its own port**. Logged to `BLOCKED.md` with the repro. 36 other assertions pass. | ~90s each |
| `r19z5-nouns` | FLAKE then PASS (53). One run failed the Sprinkle hint assertion because the hint bar had been overwritten — pre-existing contention (`updateHint`, the hider chance at ~0.9s and the pulse invitation at ~9s all write that one bar); E13 writes no hints at all. Proved by running it with my `js/town.js` stashed (PASS) and again with it restored (PASS). | ~2m each |

## Stale pins re-pointed (never weakened)
- `tests/r21d-alive.mjs:125` — playground invitation `Try the swings…` → `Someone fancies a game of
  tag…`. This IS the RUN21D debt (H4); the pack authors the new string and RUN21D's own comment
  authorised the swap once tag landed.
- `tests/r21d-alive.mjs` `PROOF.zone` — gained `tag / tagpartner / ringroses / ringpartner`. Equal
  rigour: the proof is still a real goal running or a real prop on screen, never a vacuous truth.
- `tests/p3-town.mjs:17` `SEEDED_LANDMARKS` — gained `deco_noticepost`, so "what SHE put down"
  still excludes what the town gave her.

## Notes for resumption
- Required reading done: lane brief, CLAUDE.md, RUN21E pack + handover, RUN21C report notes 0–7,
  PICK-UP-HERE.md, BLOCKED.md. Key collisions: no buildMode (use `worldSoftened()`); pan only via
  `panToPx`/`panToFrac`; reveals via `enqueueReveal`; `pumpWishIdles` shared scene cap; sockets
  re-measured (trust code, not pack); every new js/data file → sw.js ASSETS[] same commit.
- Testing: 2 lanes max, seed x ≤ 0.25 on-camera, real mouse, dismiss `.overlay.growth-reveal`,
  fresh context for seeds, `BASE=http://127.0.0.1:8041 node tests/<name>.mjs`.
