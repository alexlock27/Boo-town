# Boo Town: run 4 plan

The polish-and-progression run, built from live play. Headlines: navigation that always has a way back (including taming the Android back button), total stars visible wherever stars are demanded, spelling pickers a child can actually read plus a Pick for me front door, a reward economy that pays extra for bravery instead of rewarding easy-round farming, a Trophy Room with certificates and medals, a living town that grows as her Boo family grows, a gentle match-and-pop puzzle game, shiny Boos and the Star Chest, three daily-delight features, and an optional phone comfort pass that is forbidden from touching the tablet experience.

Run after the standalone Boo Dash patch (DASH_PATCH.md) has shipped. BUILD_SPEC.md remains the base contract; every hard rule stands (offline, zero runtime network requests, no accounts, no frameworks, kid-safe, gentle, touch-first), as do the three standing rules from RUN3.md: no guilt mechanics ever; occasional means capped; motion is part of the spec and is proven with frame sequences, never single screenshots.

Reward design principle for this run and all future ones: her stars never shrink. Total stars always pay in full for any honest round. Challenge is encouraged by paying bonuses on top (box meter, trophies), never by taking anything away or by shaming easy play.

Version 1.0, July 2026.

---

# Part A: Alex's runbook

1. When the Dash patch has shipped, put this file in `Documents\boo-town` as `RUN4.md`. DASH_PATCH.md should still be there too (phase 0 checks it landed).
2. Dispatch: Keep awake ON, notifications ON, Code permissions Auto, strongest model available, effort high.
3. Paste the kickoff prompt below and leave. No step 0 needs you.
4. Afterwards on the tablet: open the app online once to pick up the update. Nothing else changes for you; the reward rebalance and picker clean-up need no settings.

If it stops: `continue, read PROGRESS.md and carry on`.

## The kickoff prompt

```
Boo Town, run 4. Read RUN4.md in this folder in full, then BUILD_SPEC.md, DASH_PATCH.md
and the current PROGRESS.md. Execute the phases in RUN4.md part B in order,
autonomously, unattended. Never pause for approval.

Standing rules as always: work only inside this folder; never touch anything elsewhere
on this computer; the app makes zero network requests at runtime; no analytics; no
frameworks; learning content implemented exactly as written; old saves migrate
losslessly; recordings and artwork stay on-device.

QA standard, permanent: motion, physics, scrolling and animation are proven with at
least 6 frames spanning at least 3 seconds (plus before/after frames around scripted
taps and drags) showing measurable change. Static sequences fail even if logic passes.
Screenshot every new or changed screen at tablet size in both orientations and iterate
to genuine 8-year-old delight; drive every new mechanic end to end headlessly
including wrong-answer, hint, capped-frequency, reload and reduced-motion paths.

Anti-stall rules: never idle; log blockers to NEEDS_ALEX.md, apply the listed
fallback, move on. Push problems never stop the build; retry at phase ends. Deploy at
the end of every phase: bump BUILD_STAMP, push, fetch the live URL and confirm the new
stamp serves. Maintain PROGRESS.md so a fresh session resumes from it alone. Messages
mid-run are me on my phone.

Confirm the phase plan in a few sentences, then go.
```

---

# Part B: phases, in build order

Phase 0: confirm the Dash patch shipped (PROGRESS.md and a scripted round with frame evidence); if it is missing, implement DASH_PATCH.md first. Quick smoke of all games.
Phase 1: navigation and star visibility (part C1).
Phase 2: picker clarity and Pick for me (part C2).
Phase 3: reward rebalance: Brave bonus and cosy rounds (part C3).
Phase 4: the Trophy Room (part C4).
Phase 5: living town part 1: activity items and night-time touches (part C5).
Phase 6: living town part 2: growth milestones and the Boo Builders (part C6).
Phase 7: Boo Pop, the match-and-pop puzzle (part C7).
Phase 8: shiny Boos and the Star Chest (part C8).
Phase 9: daily delights: hide-and-seek, Boo of the Day, the Parade button (part C9).
Phase 10: phone comfort pass, optional and droppable (part C10).
Phase 11: polish, hub balance with the new game card, full regression of every acceptance suite including a motion-evidence pass, NEEDS_ALEX.md rewritten as a short human checklist.

Every phase ends: tests green, evidence captured, BUILD_STAMP bumped, pushed, live URL verified, PROGRESS.md updated.

---

# Part C: specifications

Save data for this run: one version bump with a lossless migration. New state includes age and ask flags where not already present, comfort levels and daily Brave claims, per-game 3-star round counters, earned trophies, town milestone and construction timers, per-copy shiny tracking, chest counters, and daily-delight flags. The grown-ups backup code keeps working across the bump.

## C1. Navigation and star visibility (phase 1)

Note: the on-screen back buttons and the star-visibility items below may already have shipped via a queued job recorded in PROGRESS.md; if so, keep them as the foundation and extend (hardware back, the near-unlock nudge, anything missed), never revert or duplicate.

Every screen below the hub gets a persistent, consistent back control in the same corner (top left), styled as a soft round button, returning one level (game to hub, sub-screen to parent). Confirm-on-leave stays for mid-round exits.

Android hardware and gesture back: manage a history state stack so back navigates within the app (sub-screen to parent to hub) instead of leaving the page; at the hub, back does nothing. Must survive the installed-app context and reloads. iOS has no hardware back; the on-screen buttons carry it.

The bottom bar is capped at four slots, permanently: Town, Collection, Studio, the cog. New destinations become tabs inside existing screens (as the Trophy Room and Journal do inside Collection), never additional bar buttons, and the bar never scrolls horizontally on any device.

Total stars, visible everywhere they matter: a small star total beside the hub meter (with a tiny count-up animation when it grows); every "requires N stars" surface anywhere in the app becomes a progress readout, "57 / 100" with a mini bar, including town zone signposts and anything else gated by stars. One capped guide nudge when within 10 stars of a zone unlock, at most once per session.

## C2. Picker clarity and Pick for me (phase 2)

Age sets the starting tier (note: this item may already have shipped via a queued job recorded in PROGRESS.md; if so, verify against this spec and extend rather than redo): onboarding gains one friendly step after the name, "How old are you?", answered with big number buttons (5 or younger, 6, 7, 8, 9, 10, 11, 12 and up). Mapping: 7 and under starts on Light, 8 to 9 on Medium, 10 and up on Full; the grown-ups corner override always wins and shows the mapping as a hint. Existing saves get the same age question once, kindly, on first open after this update (skipping it keeps the current tier). Age is stored on the device only, alongside everything else, and is used for nothing except this default.

Pick for me: the Smart Mix card is renamed child-facing to "Pick for me!" with a dice icon, always first and visually primary on every picker in every game. One tap starts a round with no further choices (Smart Mix chooses content and level).

Kid-readable set names with samples: every Spell Boo set card shows a friendly name plus two sample words in small text, so she never has to know what a prefix is. At the Full content tier, where all sets are visible, the cards group under three collapsible headers (Starters; Endings; Sneaky sounds and silent letters) so the screen stays calm. Rename mapping, exactly: The Big List (samples: believe, February); Th Words, formerly Tricky Sounds (with, three); Sound Twins (there / their); Word Starters 1, formerly prefixes un dis mis re (unhappy, redo); Word Starters 2, formerly in il im ir (impossible, incorrect); Super Starters, formerly super anti auto inter sub (superstar, submarine); The ly Endings (happily, gently); The ous Endings (famous, enormous); The shun Endings, formerly tion sion ssion cian (station, musician); Sneaky ch says k (school, echo); Sneaky ch says sh (chef, machine); Silent Enders, formerly gue and que (tongue, unique); Silent c Words (science, scissors); The eigh Gang (eight, they); Short ou Words (young, touch); The ture Words (picture, adventure); Double Trouble, formerly double-or-not endings (beginning, gardener). Maths category cards get sample questions the same way ("7 x 8", "35 + ? = 100"). Internal ids unchanged; this is display only.

## C3. Reward rebalance: Brave bonus and cosy rounds (phase 3)

Definitions. Comfort level, per game category: the highest level at which she has earned two or more 3-star rounds (defaults to Starter or Level 1). Mastered round: 80% or more of the round's items are mastered in the ledger.

Rules. Total stars: every honest round always adds its full stars to the total, feeding zones, the Star Chest and trophies; this never changes. Box meter: base points equal stars earned, plus a Brave bonus of +1 when the round is above that category's comfort level (first such round per category per day); mastered rounds at or below comfort contribute at most 2 meter points (a cosy round). Golden Round, Smart Mix and Pick for me rounds are always exempt from the cosy cap. The Tricky Pile rescue bonus stays as is.

Tone. The guide frames upward only: cosy round line ("Lovely warm-up! Bigger sparkles are waiting up on Level 2!"), brave line ("BRAVE round! Bonus sparkle!"). No line, screen or icon may ever suggest a round was worth less; the cosy cap is silent apart from the upward nudge. Quest templates gain stretch entries: "earn 2 stars on a Brave round", "try Level {comfort+1} of any game". All numbers are named constants for tuning.

## C4. The Trophy Room (phase 4)

Collection gains tabs: Boos, Trophies, Journal. The Trophies tab is a warm wooden cabinet with shelves and filter chips: Maths, Words, Collector, Adventures. Unearned items show as silhouettes with a hint line ("Master your 6 times table..."), which is deliberate motivation toward harder content. Earning anything plays a fanfare, an unmissable certificate or medal card, and stamps the Journal.

Certificates (mastery, from the Smart Mix ledger): one per times table 2 to 12 (every fact in the table mastered); Number Bonds to 10, to 20, to 100; one per spelling set fully mastered; one per Sound Twins set; Clock Shop levels 1 to 3; Teach Me, all lessons completed.

Medals (per game, by lifetime 3-star rounds): bronze 5, silver 15, gold 30. Star milestones: 100, 500, 1000 total stars. Collector medals: 10, 25, 40 unique Boos; 1, 5, 10 shinies; every decoration; every accessory.

Trophies (one-offs): Every Zone Open; Lesson Legend; First Custom Boo Won; Golden Round Champion (first 3-star Golden Round).

Retroactivity for existing players: on first load after this update, evaluate every criterion against the existing save and award everything derivable at once, in a single gentle cabinet-opening ceremony: mastery certificates from the ledger, collector medals from the inventory, star milestones from the total, zone trophies. Per-game medal counters (lifetime 3-star rounds) cannot be derived from old saves, so they start counting from this update.

## C5. Living town part 1: activity items (phase 5)

New decoration-class items join the box pool, each with a Boo behaviour like the bench and pond: Slide (Boos queue, climb, slide with a wheee), Swings (a Boo swings gently), Seesaw (needs two nearby Boos, they bounce alternately), Trampoline (bounces a Boo higher than its usual hop), Paddling Pool (splashy paddle, distinct from the pond), Picnic Blanket (two Boos sit and nibble), Bumper Car (one Boo slowly drives a little car back and forth along the ground band), Campfire (at night, nearby Boos gather and warm their paws; ties into the day-night clock). Rarities: Slide and Swings common; Seesaw, Paddling Pool and Picnic Blanket rare; Trampoline and Bumper Car rare; Campfire ultra.

Night-time touch: Boos placed near a Boo House curl up asleep with drifting zzz between 21:00 and 07:00 device time (they wake on tap with a sleepy blink, no grumpiness, rule 1).

All behaviours are transform-only animations, capped actor counts as per the town performance rules, and every one gets frame evidence.

## C6. Living town part 2: growth milestones and the Boo Builders (phase 6)

The town upgrades itself as her Boo family grows: milestones at 5, 10, 15, 20 and 25 unique Boos owned (catalogue and custom Boos both count; named constants). Upgrades in order: wildflowers bloom along the paths; fairy lights string between houses (glow at night); a little fountain appears in the Meadow; the paths gain pretty paving; a celebration banner and bunting appear across the town. Milestone items are placed by the town itself, not from her inventory, and never consume plots she is using.

The Boo Builders: reaching a milestone spawns a construction site (fenced sign, two hard-hat Boos hammering, sawdust puffs) at the upgrade's spot. Construction completes 24 hours later in real time whether or not she visits (rule 1: nothing requires attendance), and the next open of the town plays a reveal ceremony: fence drops, confetti, guide line ("The Builders finished something for you!"), Journal stamp per milestone. If multiple milestones are crossed quickly, sites queue one at a time.

## C7. Boo Pop (phase 7)

A gentle match-and-pop puzzle, one new hub card. A 7 by 7 board of round candy-style gems with big clear numerals. Swap two adjacent gems by drag or two taps; any adjacent pair satisfying the round's rule pops with a sparkle, gems fall, new ones drop in, cascades chain. Moves-based, 20 moves per round, no timer ever.

Levels: Starter, Twin Pop: a pair of identical numbers pops (teaches the mechanic, zero arithmetic). Level 1, Make 10: adjacent pairs summing to 10 pop (gems 1 to 9). Level 2 (Medium content setting and up), Make 20 (gems 1 to 19). Level 3 (Full only), Fraction Friends: equivalent-fraction gems pop together (1/2 with 2/4 or 3/6; 1/4 with 2/8; 3/4 with 6/8), and Fact Pairs: a times-fact gem pops with its answer gem ("3 x 4" with 12).

Kindness engineering: the generator guarantees at least one valid pair on every board; if cascades ever leave none, an automatic sparkle-shuffle rearranges (announced cheerfully, costs nothing). After 6 idle seconds a soft glow hints one valid pair, free. The manual hint button shows a pair instantly and counts as a hint. Stars: 3 for 12 or more pops with no manual hints, 2 for 8 or more, 1 for finishing. Feeds the meter with the C3 rules, with one addition: after a player's third lifetime Twin Pop round, Twin Pop always counts as a cosy round, since it is the tutorial rather than the sport. Pick for me offers Boo Pop once unlocked. Frame evidence: swap, pop, fall and cascade sequences.

## C8. Shiny Boos and the Star Chest (phase 8)

Shinies: any Boo can drop as a shiny variant: golden shimmer overlay, a star-glint animation every few seconds, a shiny badge on its collection card, and a shiny counter on the collection header. Odds 1 in 15 per Boo drop, with a hidden mercy rule guaranteeing a shiny within every 25 Boo drops (both named constants). Shiny status is per-copy, tracked in the inventory; the ceremony gets an extra golden confetti layer and its own guide lines. First shiny stamps the Journal; shiny counts feed the Collector medals.

The Star Chest: every 50 total stars (named constant), a golden chest appears beside the hub meter with its own mini progress track tied to the visible star total. Opening it uses the ceremony with a golden variant and guarantees: one Boo of Rare or better at triple shiny odds, plus one accessory. Normal boxes are unchanged; the chest is pure bonus on top, so total stars gain a second visible purpose. Migration: an existing save receives exactly one welcome chest on first load, introducing the feature, and boundaries are then measured from the current total onward, with no back-pay for stars earned before this update.

## C9. Daily delights (phase 9)

Hide-and-seek Boo: once per local day, one owned placed Boo hides behind town scenery (peeking ears visible); spotting and tapping it earns +2 meter and a giggle. Unfound simply carries to tomorrow; no reminder, no streak (rules 1 and 2).

Boo of the Day: the hub spotlights one owned Boo daily on a little podium beside the guide, wearing a random owned accessory (or none, gracefully, if none are owned), with a one-line fanfare ("Today's star: Jingle!"). Pure decoration, rotates at local midnight.

The Parade button: on any placed Dance Stage, next to Choreograph: Parade (hidden while no Boos are placed). Every placed Boo marches across the town in a line with music and confetti for about 20 seconds, then everyone returns to their spots. No reward attached; it exists to be shown off. Frame evidence for the march.

## C10. Phone comfort pass (phase 10, optional and droppable)

Goal: comfortable on a phone, unchanged on the tablet. Implementation is strictly CSS inside a max-width 600px media query plus modern viewport units (dvh) to stop browser-bar scroll: hub cards stack single column, the game shell HUD compresses to one row, type and spacing scale down with clamp() while touch targets stay 44px minimum, the town drawer shrinks. No layout JavaScript, no markup changes that affect wider viewports.

Note: the hub header fix below may already have shipped via DASH_PATCH.md item 2; if so, keep it as the foundation and extend, never revert or duplicate. Known phone defects to fix in this phase, from live evidence: the hub's floating top strip (sound button, star meter, gift) overlaps the guide character, and the guide's speech bubble can clip off the top of the viewport. On narrow viewports the top strip becomes its own compact row above the hero area, the guide scales to fit the remaining space and is never overlapped by anything, and speech bubbles clamp fully inside the viewport with all text readable.

The tablet guarantee, hard gate: capture the full screenshot set at 1000x625 and 625x1000 before and after this phase; automated pixel comparison must show no visible difference (allowing only compression noise). If the guarantee cannot be met, revert the entire phase, log it in NEEDS_ALEX.md, and move on; this phase is explicitly droppable. Verify the phone result at 390x844 in both orientations.

---

# Part D: acceptance checks for run 4

1. Phase 0: Dash patch verified shipped with its frame evidence, or implemented then verified.
2. Every screen below the hub shows the back control in the same corner; a scripted Android back press navigates sub-screen to parent to hub and never leaves the app; at the hub it does nothing; behaviour survives reload. The bottom bar holds at most four slots and never scrolls horizontally at any viewport.
3. The hub shows the star total with its count-up; every star-gated surface in the app shows current / required with a mini bar; the near-unlock nudge fires at most once per session.
4. Pick for me is first and primary on every picker and starts a round in one tap; every spelling set card shows its friendly name and two samples exactly per the C2 mapping; maths cards show sample questions; the onboarding age question maps 7-and-under to Light, 8 to 9 to Medium, 10-and-up to Full; an existing save is asked once and keeps its tier if skipped; the grown-ups override wins; Full-tier set cards group under their three headers.
5. Reward economy: a simulated day shows the Brave bonus paying +1 once per category, cosy rounds capping at 2 meter points, total stars always crediting in full, and the exemptions (Golden Round, Smart Mix) honoured; no UI string ever frames a round as worth less.
6. Trophy Room: every certificate, medal and trophy in C4 exists with silhouette hints; a simulated mastery of the 4 times table awards its certificate with ceremony and Journal stamp; filter chips work; a migrated legacy save retro-awards every derivable certificate, collector medal, star milestone and zone trophy on first load in one combined ceremony, and per-game medal counters start at zero.
7. Activity items: each of the eight behaviours evidenced with frames, including the two-Boo seesaw requirement and the campfire gathering at a simulated 22:00; sleeping zzz Boos near houses at night, waking on tap.
8. Growth milestones: simulating 5 then 10 unique Boos spawns queued construction sites; a simulated 24 hours completes construction without a visit; the reveal ceremony and Journal stamps fire; upgrades never occupy used plots.
9. Boo Pop: swap, pop, fall and cascade frame evidence; every generated board has a valid pair; the auto-shuffle triggers when none remain; idle glow at 6 seconds; Starter and Make 10 playable and 3-starrable; Make 20 and Fraction Friends hidden below their content tiers; Twin Pop registers as cosy after the third lifetime round.
10. Shinies: forced rolls confirm the 1 in 15 odds and the 25-drop mercy; shiny render, badge, counter, golden ceremony and Journal stamp all present; per-copy tracking survives reload.
11. Star Chest: a migrated save receives exactly one welcome chest and no back-pay; thereafter chests appear exactly at each 50-star boundary from the migration total, the mini track matches the visible total, contents honour the guarantees, normal boxes unaffected.
12. Daily delights: hide-and-seek at most once per day with carry-over and no reminders; Boo of the Day rotates at local midnight and copes with zero owned accessories; the Parade marches every placed Boo with frame evidence, returns everyone home, and its button hides when no Boos are placed.
13. Phone pass: tablet screenshot sets before and after are pixel-identical bar compression noise, or the phase was reverted and logged; phone at 390x844 in both orientations shows the full guide with no overlap from the top strip, a fully visible speech bubble, no horizontal scroll anywhere including the bottom bar, and 44px minimum touch targets.
14. Full regression of BUILD_SPEC section 14, EXPANSION_1 section 6, RUN2 part E and RUN3 part D passes, plus a final motion-evidence pass over the RUN3 C0 checklist and every new mechanic in this run.

---

# Parked (decided, not forgotten)

Parent dashboard; "What's new" popup; pass-the-tablet duel; Boo gifting by QR; birthday mode (build about a month before her birthday: one evening, needs the date in the grown-ups corner); reading-support toggle; a possible classic sweets-style match-3 skin for Boo Pop if her verdict asks for it. The standing rules govern all of them.
