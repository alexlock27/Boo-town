# RUN21H — Content Truth & Real Ears — ledger

Branch `run21h` from `main@22b8d40` · worktree `..\Boo-town-run21h-wt` · port 8046.
Pack: RUN21H-CONTENT-EARS — Part A (literacy content sweep) then Part B (real sound samples).
Governance: GOVERNANCE-TONIGHT.md. Protected core intact throughout.

The maintainer's ask, in his own words: *"some of the games' explanations and questions are
a bit weird, or don't make sense, or are repeated… and make sure there is enough content so
kids don't get bored."*

## Status
- [x] A1 inventory + machine pass — `tools/content-audit.mjs`, `tests/lib/y34-words.mjs`
- [x] A2 judgement pass — 34 changes, every one below
- [x] A3 depth where flagged — ~330 items added, every one below
- [x] A4 repeat-avoidance at the engine seam — 10 engines, `tests/r21h-norepeat.mjs`
- [x] Part A gate — green
- [x] B1 fake-noise inventory
- [x] B2 samples sourced, licence-verified, manifest-recorded
- [x] B3 `sfx.sample()` wiring + ASSETS + zeronet RULE CHANGED
- [x] B4 phoneme seam (`sampleOr`) + voice-prep addendum
- [x] Part B gate — green (`tests/r21h-ears.mjs`)
- [x] What's New staged

---

## A1 — the audit (`tools/content-audit.mjs`)

Walks all 18 content files, 2460 child-facing strings, and reports six things: exact and
near duplicates, sorting ambiguity, grapheme/phoneme truth against `data/phonemes.js`'s own
tables, Britishness, curriculum coverage against the statutory Y3/4 list, and volume per
game. Deterministic (seeded RNG) so "re-run clean" is a fact rather than a mood.

**Opening state: 64 open flags. Closing state: 0 open, 3 accepted-with-reason.**

The fixture `tests/lib/y34-words.mjs` carries the statutory Year 3/4 spelling list (109
words) and the appendix themes, from the DfE's *English Appendix 1: Spelling* — UK
government content, Open Government Licence.

Three flags stand as **accepted**, with the reason printed in the report every run:
`they` appearing in two banks (it earns its place in both for different reasons), the
`dropBoo`/`boxCommon` shared ceremony line (RUN12 S5 design), and the Ice cream / Mice
cream joke pair (two different jokes, both pack-locked).

### What the audit measures, and one thing it got wrong at first
The volume model originally simulated three sessions with an independent shuffle each — the
OLD behaviour — and so under-reported the A4 fix. It now models the fresh-first dealer the
engines actually use, one clean state per trial, which is both honest and less flattering.
Pools genuinely bounded by the real world (twelve months, 26 letters, the words that fit a
spelling pattern at Y3/4 reading age) are reported **with the reason** rather than flagged
for ever.

---

## A2 — before/after: every content change

### Truth defects — the app was teaching something false

| File | Before | After | Why |
|---|---|---|---|
| `apostrophe.js` `men` | no `note`, so the guide said **"The men — only one!"** | `note: 'men is already lots — so it just takes ’s!'` | `commaWhyLine` derives its sentence from `form`, not `many`. It called a plural "only one" — about the exact concept the item drills. |
| `apostrophe.js` `mice` | same defect | `note: 'mice is already lots — so it just takes ’s!'` | as above |
| `apostrophe.js` `commaWhyLine` | `Its already owns it — no flying comma needed!` | `‘its’ already owns it — no flying comma needed!` | Capitalising the decoy word printed the exact its/it's error the game teaches. |
| `wordfactory.js` B4 ×4 | `Drop the silent e before -ing or -ed.` | `Drop the silent e before the ending.` | B4 builds **-ation** and **-ous** words. The rule card was false for the card on screen (prepare→preparation, fame→famous). |
| `sorting.js` `shapeSides` | `right-angled triangle` | `equilateral triangle` (+ `isosceles triangle`, `parallelogram`, `nonagon`) | `polygonSVG(sides)` draws a **regular** polygon, so the label contradicted its own picture. Every name kept or added is one a regular polygon honestly wears. |
| `bubbleCategories.js` `addsubGen` L2 | `b = 11 + rand(98 - a)` | `b = 11 + rand(88 - a)` | The comment says "no crossing hundreds"; the bound allowed sums of 101–108. |
| `phonemes.js` `chair` | `{ ch: ['initial'] }` | `{ ch: ['initial'], avoid: ['ai'] }` | `chair` is spelt c-h-a-i-r and has no /ai/ sound, so a child reading the **ai** card tapped it and was told "chair hasn't got ai in it" — false to the letters in front of her. Swept all 72 pool words × 12 graphemes: this is the only case of its class. |
| `soundsorter.js` `missLine` | spoke the raw grapheme keys — *"hasn't got **igh** in it"* | new `missLineSpoken()` speaks each phoneme's authored `say`; the displayed line still shows the letters | The `say` column exists for exactly this and was unused here. `phonemeMiss` already did it right. |

### Ambiguity — a bright nine-year-old could defend the "wrong" answer

| File | Before | After | Why |
|---|---|---|---|
| `sorting.js` units cm | `a book` | `a ribbon` | A big hardback is about a kilogram; "how heavy is your book bag" is everyday talk. |
| `sorting.js` units kg | `a dog` | `how heavy a dog is` | Dogs are measured at the vet as well as weighed. Names the attribute, as the authored `the width of a table` already did. |
| `sorting.js` units kg | `a bicycle` | `a heavy suitcase` | Bikes are *sized* ("a 20-inch bike"); almost no child has weighed one. |
| `sortingExtra.js` timeUnits | `a drive to the seaside` | `a long car journey` | True in hours only if you live inland. A child in Blackpool drives to the sea in minutes and would be marked soft-wrong for the right answer. |
| `sortingExtra.js` nounVerb | `whisper`, `giggle`, `shout`, `crawl` | `scamper`, `gobble`, `explore`, `wriggle` | "a whisper", "the giggles", "give me a shout", "front crawl" are all everyday nouns. |
| `sortingExtra.js` nounVerb | `storm` (noun) | `puddle` | "He stormed off" is standard children's-book English. |
| `sortingExtra.js` nounVerb | `purple` (adjective) | `sparkly` | A colour word names a colour; dictionaries list purple as both. |
| `soundTwins.js` + `spellingBanks.js` | `The ___ arrives each morning` (mail) | `The parcel came by ___` | "The **male** arrives each morning" is a grammatical sentence in exactly the wildlife register the set's other item uses. "came by male" is not English. |
| `soundTwins.js` | `Snaffle loves to ___ in everything` (meddle) | `…___ with everything` | "to medal in an event" is real Olympic commentary. "medal with" is not English in any register. |
| `soundTwins.js` `TWIN_EXPLAIN.male` | `'Male' means a boy or a man.` | `…— or a boy animal, like a male lion.` | Shown against the set's own *lion* sentence, and a lion is neither a boy nor a man. |

### Clarity, Britishness and consistency

| File | Before | After | Why |
|---|---|---|---|
| `sorting.js` `round10` | `27 rounds to the nearest ten.` | `Round 27 to the nearest ten.` | A dangling statement, not an instruction. Do-first rule. |
| `sorting.js` `round100` | `…Look at the tens digit — 50 rounds up!` | `…If the tens digit is 5 or more, round up!` | A child looking at a single digit has no idea what "50" refers to. |
| `sortingExtra.js` `fractionFamilies` | `Try simplifying it.` | `Divide the top and the bottom by the same number.` | "Simplify" is Year 6 vocabulary — the one word offered to a stuck Y3/4 child was two years above her tier. Verified the method works on all 16 items. |
| `sortingExtra.js` `capacityLitre` | `2 l`, `3 l` | `2 litres`, `3 litres` | In a rounded child sans a lowercase l is a bare stroke; "2 l" reads as "21". |
| `detective.js` FIVE | `candy` | `sweet` | American. British children say sweets. |
| `spellingBanks.js` | `Whose`, `Who's` | `whose`, `who's`, both clues gaining `?` | The only capitalised non-proper-noun targets in any bank. Spell Boo builds tiles from the word's own letters and decoys from `decoysFor()` (lowercase) — so a capital W sat among lowercase decoys **pointing at the answer's first letter**. |
| `soundTwins.js` `whoseWhos` | two direct questions, no `?` | `?` added to both | Alone among the file's questions. Literacy content that models missing punctuation teaches it. |
| `bubbleCategories.js` | sample `10 more than 62` | `10 more than 362` | `morelessGen` never asks a two-digit question — L1 draws 100..998. The card advertised a question the category cannot generate. |

---

## A3 — additions in full

Every addition is British, maps to the Y3/4 line it serves, matches the file's exact data
shape, and passed the validators. Nothing authored was changed, removed or reordered.

### Curriculum gaps the audit found and this run closed
- **`y` spelt as /ɪ/ — the appendix line was ABSENT from the entire app.** New bank
  `yThatSoundsLikeI` (16 words): myth, gym, Egypt, pyramid, mystery, crystal, symbol,
  system, lyrics, typical, oxygen, hymn, syrup, mystic, cygnet, symptom. It also gains a
  picker card in `spellboo.js` — *a bank with no card is content a child can never reach.*
- **The prefix `pre-`** (statutory, in the same appendix line as un/dis/mis/re) had no
  teaching words. Six join `prefixesUnDisMisRe`, which is renamed to match the curriculum
  line: preheat, prepay, preview, preschool, precook, prehistoric. Three more join the Word
  Factory: preheat, preview, prehistoric.
- **`ch` sounding /ʃ/** was THIN at 5. Now 12: + chute, moustache, quiche, crochet,
  chandelier, sachet, ricochet — close to every such word in child-reachable English.

### Sorting (`data/sorting.js`, `data/sortingExtra.js`)
A round deals 12 items and most templates held 12–18, so **a round WAS the whole pool**.

| Template | Before → after | Notes |
|---|---|---|
| units1 | 18 → 30 | small units (cm/kg/ml) |
| units2 | 18 → 30 | **was byte-identical to units1** — see the deviation log |
| timeUnits | 12 → 36 | everyday British activities, duration unarguable |
| timeHour | 12 → 36 | |
| moneyPound | 14 → 36 | real UK coins only |
| lengthMetre | 12 → 36 | |
| massKilogram | 12 → 36 | |
| capacityLitre | 12 → 36 | |
| temperature | 12 → 36 | |
| romanNumerals | 15 → 36 | Y4 statutory: read Roman numerals to 100 |
| pluralRules | 17 → 36 | every -ies word is consonant + y, the rule's real condition |
| theirThereTheyre | 9 → 24 | each new sentence checked so exactly ONE word fits |
| toTooTwo | 9 → 24 | same check |
| nounVerbAdjective | 24 → 36 | every addition put through the two-buckets test |
| halfEquivalent | 14 → 36 | |
| fractionSize | 16 → 36 | |
| fractionFamilies | 8 → 16 | bounded by fractions that reduce cleanly to quarters |
| tenths | 13 → 21 | bounded: a tenth has nine values between 0 and 1 |
| symmetry | 19 → 26 | now all 26 capitals — the 7 additions are the horizontal-symmetry letters (B C D E I K) and Q |
| shapeSides | 11 → 14, round shortened 12 → 9 | bounded by names a **regular** polygon can honestly wear; shortening the round beat padding it with false ones |

### Spelling banks (`data/spellingBanks.js`) — +140 words across 16 banks
prefixesUnDisMisRe 16→30 · prefixesInIlImIr 8→20 · prefixesSuperAntiAutoInterSub 12→24 ·
lyFamily 14→24 · ousFamily 16→24 · chSoundsLikeK 8→18 · chSoundsLikeSh 5→12 · gueAndQue
6→18 · silentIshSc 7→14 · eiEighEy 9→18 · ouSoundsLikeU 6→15 · tureFamily 8→18 ·
doubleOrNotEndings 9→20 · **yThatSoundsLikeI 0→16 (new)**.

### Spell Boo tiers (`data/spelling.js`) — **no word added or removed**
Tier 3 held 10 of the 109 statutory words, so its rounds of 8 were the same words for ever.
Fourteen of the hardest tier-2 words moved up — the ones whose difficulty is a silent or
doubled letter, a schwa that gives no clue, or a spelling that fights its own sound:
business, February, grammar, knowledge, medicine, naughty, pressure, reign, separate,
therefore (+ the four already there). Totals: 46 / 43 / 20 = 109, verified.

### Word Factory (`data/wordfactory.js`) 58 → 90 items
B1 16→24 (preheat, preview, prehistoric, dishonest, misplace, disobey, unkind, replay) ·
B2 16→24 (bravely, politely, suddenly, hungrily, sleepily, terribly, sensibly, magically) ·
B3 12→18 (shopping, stopped, baking, closed, walking, shouted) · B4 10→24 (invitation,
exploration, imagination, adoration, relaxation, starvation, presentation, nervous,
mountainous, humorous, glamorous, furious, victorious, thunderous).
Each level keeps its join rules in proportion, so it still teaches all of them evenly.

### Blend It (`data/blending.js`) — every added word already has a picture
L1 16→26 (mat bat rat log jog fog bug hug mop hop) · L2 12→24 (shed wish chip path king
wing song sing thing bell well brush) · L3 12→24 (snail train goat coat food boot car farm
fork light owl feet) · **L4 10→13 only** (balloon cartoon flower) — see the deviation log.

### Apostrophe Patrol (`data/apostrophe.js`)
SQUEEZE 16→26 (haven't hasn't weren't shouldn't you're he's we've they'll I've won't — the
last with its own note, because *will not → won't* is a rebel). POSSESSION 18→28, balanced
across the three cases, the two new irregular plurals (`people`, `geese`) carrying the note
that stops the guide calling a plural "only one".

### Story Reader (`data/storyReader.js`) 2 → 5 sets
Three new sentence-sequencing sets — **The Lost Glove**, **The Surprise Cake**, **The Muddy
Match** — each following the pack's own pattern exactly: five sentences each opening with
the time connective that fixes its place, a `why` line built from that connective, and one
comprehension question with the correct option written first.

---

## A4 — the no-repeat seam

Ten engines gained a session-scoped "recently seen" set: unseen items deal first, and only a
genuinely exhausted pool resets and cycles fresh. **Module state only — no save change, no
new file, nothing persisted.** A reload simply starts a fresh cycle, so nothing decays and a
return visit is never punished.

`data/sorting.js` · `data/sortingExtra.js` · Blend It · Word Factory · Rhyme Time (targets
*and* couplets) · Sound Sorter (sounds *and* words-per-sound) · Twin Trouble · Apostrophe
Patrol · Spell Boo (words *and* twins — layered under the existing mastery weighting).

Guarded by **`tests/r21h-norepeat.mjs`** (one check per touched engine, ~2s).

---

## Part B — the sample manifest

| id | what | licence | source | s | KB |
|---|---|---|---|---|---|
| `cat` | meow of a young female cat | CC0 | [Maullido de gata hembra joven.ogg](https://commons.wikimedia.org/wiki/File:Maullido_de_gata_hembra_joven.ogg) | 1.15 | 36 |
| `sheep` | sheep bleating | CC0 | [Sheep bleat.ogg](https://commons.wikimedia.org/wiki/File:Sheep_bleat.ogg) | 0.50 | 16 |
| `bee` | bumblebee buzzing | Public domain | [Bombus buzz.ogg](https://commons.wikimedia.org/wiki/File:Bombus_buzz.ogg) | 2.00 | 63 |
| `frog` | common frog calling | Public domain | [Grasfrosch Paarungsrufe.OGG](https://commons.wikimedia.org/wiki/File:Grasfrosch_Paarungsrufe.OGG) | 2.00 | 63 |
| `lion` | lion roaring in captivity | Public domain | [Lion raring-sound1TamilNadu178.ogg](https://commons.wikimedia.org/wiki/File:Lion_raring-sound1TamilNadu178.ogg) | 2.40 | 75 |
| `seagull` | herring gull calling | Public domain | [Gull 2.ogg](https://commons.wikimedia.org/wiki/File:Gull_2.ogg) | 2.00 | 63 |
| `blackbird` | blackbird singing in a Finnish forest | Public domain | [Turdus merula 2.ogg](https://commons.wikimedia.org/wiki/File:Turdus_merula_2.ogg) | 2.60 | 81 |

**396 KB of the 1536 KB budget.** Every licence read from the Wikimedia Commons API's own
`extmetadata` and re-checked immediately before the file was written; a licence that had
drifted would have aborted that file. Full records in `assets/sfx/manifest.json`, which
ships and is precached, so the licences travel offline with the audio.

### B1 — the fake-noise inventory
- **ANIMAL/WORLD NOISE (fixed tonight).** `js/sfx.js` `animal.call()` — ten synthesised
  animal voices used by the Toddler Animal Sounds and Animal Pairs games. Plus the two
  sparse events in the RUN21F F7 area beds: the beach's gull cry (two triangle glides) and
  the meadow's birdsong (a three-note triangle motif).
- **ISOLATED PHONEME (audit only, per B4).** `soundsorter.js` line ~289 (target prompt,
  speaks `p.say`), `missLine`/`missLineSpoken` (wrong-card line), `phonemeMiss` (`say:`
  field), and `blendit.js` per-tile `speakMaybe(parts[i])` — that last one is Blend It's
  entire core loop, and a lone `c` comes out of an en-GB engine as "see".
- Checked and NOT a defect: `toddler.js` speaks `ANIMAL_WORDS[cur]` ("Moo!", "Woof!") as
  real words after the call. That is TTS doing what TTS is good at, and seeing "moo" while
  hearing it is the literacy point — the printed word stays exactly where it was.

### B3 — the wiring
`sfx.sample(id, { vel, bus, time })` fetches once, decodes, caches the buffer module-level,
and plays through `sfxGain` — so every existing mute and duck holds with **no special case
anywhere**. `animal.call()` tries the sample and falls through to its original synthesis, so
a missing file is never an error the child sees, and the five animals with no recording keep
the voice they had. The two bed events pass `bus: bedGain` so a real gull obeys the bed's own
mute and duck contract exactly as the synthesised one did. All seven files **and** the
manifest went into `sw.js` ASSETS in the same commit that created them.

### B4 — phonemes: the seam, not robot audio
`sfx.sampleOr(id, fallback)` + `sfx.phonemeId(key)`. Sound Sorter's target prompt already
calls it, so today it speaks exactly as before and the day a recorded UK phoneme set exists
it is *heard* instead, with zero call-site changes. `RUN21F9-VOICE-PREP/PLAN.md` gains an
addendum naming the phoneme set as the Creator month's **second batch job**, with the scope
and the reason. **No robot phoneme files ship tonight.**

---

## DECISION blocks

**DECISION: source from Wikimedia Commons rather than Pixabay.**
WHY: Pixabay answers this machine with HTTP 403 for every programmatic request, browser
User-Agent included — it is behind bot protection. The pack permits "Pixabay … or a
verified-CC0 source ONLY", and Commons is the stronger of the two for this job because it
exposes the licence as structured API data, which is better evidence than a scraped page.
Every licence in the manifest was read from that API and re-checked at write time.
REVERSIBLE: yes — `tools/sfx-source.mjs` takes any source; a Pixabay set can replace or join
these by re-running the pipeline.

**DECISION: ship WAV, not the pack's OGG/Opus.**
WHY: this machine has no ffmpeg, no sox, and no encoder of any kind, so OGG/Opus cannot be
produced at all. 16 kHz mono 16-bit WAV keeps the whole set at 396 KB — a quarter of the
budget — and decodes everywhere including iOS Safari, which does not decode WebM/Opus. The
pack's *reason* for naming Opus was size, and size is comfortably met.
REVERSIBLE: yes — re-run `tools/sfx-fetch.mjs` on a machine with ffmpeg; nothing else changes.

**DECISION: no cow, dog, duck or owl — and the What's New says so.**
WHY: there is no CC0 or public-domain recording of any of them on Commons. The good ones are
all CC-BY, which requires attribution and which the pack explicitly excludes ("Pixabay
Content Licence or verified-CC0 ONLY"). Protected core §5 is not a judgement call. The
pack's draft What's New promised *"a real moo, a real woof, a real quack"* — precisely the
three that do not exist — so I rewrote it to name only what a child can actually go and hear.
Promising a child a moo she will not hear is worse than promising nothing.
REVERSIBLE: trivially — add the id to `SAMPLES` and `sw.js` ASSETS when a clean recording
turns up. Escalated to the morning report as the one thing worth a human decision: **if Alex
is willing to accept CC-BY with an attribution screen, the missing animals become available
immediately.**

**DECISION: verify by metadata, and say plainly that nothing here has been listened to.**
WHY: I cannot hear. The licence gate is machine-provable and is proved. The "is it really
that sound" gate is description-based: `tools/sfx-verify.mjs` drops speech corpora and
pronunciation projects by name and prints every description for a human read. It caught
"Lion dance percussion" (a drum troupe), "Chicken in Vezo" (a language recording) and the
fact that **every single "pig" hit on Commons is a guinea pig**. What it cannot catch is a
correctly-described recording that simply sounds poor.
REVERSIBLE: yes — each id is one line in the manifest. **Worth ten minutes of Alex's ears
before this merges.**

**DECISION: Blend It level 4 stops at 13 of 24, and Story Order gains no new picture story.**
WHY: both are blocked by the same thing, and it is not content. Every Blend It word needs its
own SVG in `js/wordart.js`, and every Story Order panel needs a bespoke drawing whose whole
acceptance test is that a pre-reader can order the panels *from the pictures alone*. Padding
either with words or panels that have no art would ship broken cards — a worse outcome than
a smaller set. L4 took the three multi-syllable words the library already draws.
REVERSIBLE: yes, and cheaply — the data shapes are ready; it is an art job.
INSTEAD: Story Order's depth went to **Story Reader** (sentence sequencing, no art at all),
2 → 5 sets, which serves the same skill at the Medium tier.

**DECISION: pools bounded by the real world are reported, not flagged.**
WHY: there are twelve months, 26 letters, and only so many words that fit "ch sounding /ʃ/"
at Y3/4 reading age. Padding those to hit a repeat-rate number would mean adding words no
nine-year-old meets — making the content worse to make a metric better. The audit prints each
with its reason so the limit is visible rather than silently tolerated. For themed spelling
banks there is a second reason: revisiting a pattern's words *is* how spelling is learnt, and
Spell Boo already weights mastered words down to a third.
REVERSIBLE: the BOUNDED table in `tools/content-audit.mjs` is one edit.

**DECISION: leave the three vowel-less `say` values alone (`ch ch`, `thhh`, `ng`).**
WHY: a cold read proposed replacing them with "ch as in cheese", "th as in thumb", "ng as in
ring". All three anchor words are **in that phoneme's own answer list**, so the prompt would
hand the child one of the correct cards before she started. The real fix is B4's recorded
phoneme set, which is exactly what B4 delivers a seam for. Changing the data blind, on a box
where I cannot hear the result, would be guessing.
REVERSIBLE: yes — one line each in `data/phonemes.js`.

---

## RULE CHANGED blocks

**RULE CHANGED: the zero-network law.**
OLD: `js/` contains no `fetch` at all outside the guarded share path in `gallery.js`.
NEW: a **same-origin** request for a path **present in `sw.js` ASSETS[]** is lawful; anything
else still fails the suite.
WHY / WHAT IT UNBLOCKS: real recorded sounds (GOVERNANCE §3a') mean `js/sfx.js` must fetch
its sample files. **The new rule is stricter, not looser** — "no fetch" said nothing about
where a future fetch might point, whereas this proves every byte the app can ever ask for is
a byte it already shipped and precached. `tests/r11q9-zeronet.mjs` now also asserts that
`sfx.js` has exactly one fetch, that it takes `sampleURL(id)` and never a caller-supplied
string, that `sampleURL` resolves against `import.meta.url` (so same-origin by construction),
and that every declared sample is in ASSETS. A sample added without an ASSETS entry now fails
in two suites.

*No change was made to `CLAUDE.md` itself: the offline law as written there ("every new js/
or data/ file must be added to the ASSETS[] precache list in the SAME COMMIT") was already
obeyed to the letter, and §3a' had already been relaxed by governance before the run began.*

---

## Deviations found and repaired in passing

- **`units1` and `units2` were the same template.** They were built by a `[1,2].map(...)`
  over one body, so a child who levelled up was served a byte-identical round advertised as
  harder. `units2` is now metres/grams/litres — a real step up.
- **`polygonSVG` draws regular polygons**, so `right-angled triangle` was drawn as an
  equilateral one. Replaced rather than redrawn (the task is counting sides; a bespoke
  scalene drawing is an art job). Recorded here because the same trap will catch the next
  person who adds a shape name.
- **A duplicate I introduced and the audit caught**: `6/12` twice in `halfEquivalent`, which
  could have dealt the same card twice in one round. The tooling found it before the gate.

---

## Wall times

| What | Time |
|---|---|
| `tools/content-audit.mjs` full pass | ~11 s |
| `r21h-norepeat` | 2 s |
| `r21h-ears` | 14 s |
| `r11q9-zeronet` | <1 s |
| `r16w1-soundsorter` | 62 s |
| `r16w2-blendit` | 78 s |
| `r16w3-rhymetime` | 55 s |
| `r16w4-storyorder` | 64 s |
| `r12s2-tricky-fair` | 47 s |
| `r7p4-toddler` | 51 s |
| `r12s9-toddler-replay` | 29 s |
| `m3-pwa` | 33 s |
| `r17x4-whatsnew` | 18 s |
| `r12s1-routes` · `r8p1-migrations` · `r12s4-contrast` · `r18a-copyguard` | 22 / 9 / 41 / 3 s |

**Gate: all green.** Affected suites + the five-suite core, per the amended Board Law. No
full board.

---

## What's New (staged on the branch)

```js
{ version: 'run21h-20260810', entries: [
  { icon: '🐑', title: 'Some animals sound REAL now',
    blurb: 'Go and listen to the sheep, the cat, the frog, the bee and the lion — those are real recordings, not beeps. Which one makes you laugh?',
    route: 'toddlergame', params: { game: 'animals' } }
]}
```

Route and params verified against `js/main.js`'s registry by `tests/r17x4-whatsnew.mjs`.
No entry for the content work: *"we made the questions make sense"* is not a sentence for a
child.

---

## For the morning report

1. **Ten minutes of your ears on `assets/sfx/*.wav`** before this merges. Licences are
   machine-proved; the sound quality is not, and cannot be from here.
2. **Would you accept CC-BY with an attribution screen?** It is the single thing standing
   between the app and a real moo, woof, quack and hoot. One yes unblocks all four.
3. Blend It L4 and Story Order want an art pass — the data is ready and waiting.
