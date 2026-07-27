# RUN16 — Literacy & Lessons 2.0

**Landed on `main`, 2026-07-27. Stamp `run16-v1-20260727`.**

The gap this run closed: 7 of 9 learn-games and 6 of 6 lessons were maths. Boo Town now has
four literacy games and nine lessons, and the lesson format itself was rebuilt.

| Packet | What shipped |
| --- | --- |
| W1 | **Sound Sorter** — 12 authored phonemes × 6 picture words, 4 position levels |
| W2 | **Blend It** — 50 authored words, grapheme tiles that slide together as they are sounded |
| W3 | **Rhyme Time** — 10 authored families, 10 near-misses, 6 authored couplets |
| W4 | **Story Order** — the 6 authored stories, orderable by a pre-reader |
| W5 | **Teach Me 2.0** — hook → show → try×3 → win, all 9 lessons, 3 of them new |
| W6 | Smart Mix, the Tricky Pile and Brain Bloom all reaching the four new games |
| W7 | This report, the affected board, the stamp, the live check |

---

## 1. Content inventory — verified line by line against the packs

Every authored item was checked **by a script that reads the packs themselves**
(`RUN16.md`, `CONTENT_STORIES.md`, `CONTENT_LESSONS.md`) and diffs them against the shipped
data modules, rather than by eye. 68 checks, all passing.

### W1 — Sound Sorter (`data/phonemes.js`)
All twelve phonemes, each with its authored six, in the authored order:

| | words |
| --- | --- |
| **sh** | ship, shell, fish, brush, shed, wish |
| **ch** | chip, chair, beach, cheese, church, watch |
| **th** | thumb, thorn, bath, moth, three, path |
| **ng** | ring, song, king, wing, strong, thing |
| **ai** | rain, snail, train, tail, paint, chain |
| **ee** | sheep, tree, queen, bee, green, feet |
| **oa** | boat, goat, coat, road, toast, soap |
| **oo** | moon, spoon, boot, roof, food, zoo |
| **ar** | star, car, farm, park, shark, jar |
| **or** | fork, horse, corn, storm, torch, sport |
| **igh** | light, night, high, right, sight, bright |
| **ow** | cow, owl, crown, flower, town, clown |

72 words, 72 distinct, every one drawn and spoken.

### W2 — Blend It (`data/blending.js`)
- **Level 1 (16):** cat, dog, pin, sun, bed, top, hat, cup, fox, jam, leg, mug, net, rug, tin, van
- **Level 2 (12):** ship, chin, moth, bath, ring, fish, shop, chop, sock, duck, back, lick
- **Level 3 (12):** rain, boat, moon, star, tree, corn, night, cow, spoon, chair, beach, green
- **Level 4 (10):** rabbit, basket, magnet, picnic, sunset, helmet, pocket, carpet, dentist, tunnel

50 words. Every grapheme split spells its own word back (asserted, not assumed); tile counts
scale 3 → 6 with level.

### W3 — Rhyme Time (`data/rhymes.js`)
All ten families verbatim: -at (6), -og (5), -ake (5), -ell (5), -ing (5), -ight (5), -ar (5),
-oon (4), -ug (5), -op (5) — 50 members. All six couplets verbatim with their authored
answers: frog, park, me, sang, head, lake. Each answer rhymes with the end of its own first
line (log, dark, sea, bang, bed, cake) and no decoy rhymes, so every couplet has exactly one
possible ending.

### W4 — Story Order (`data/stories.js`)
All six stories: The Lost Kite (5 panels), The Wobbly Cake (5), The Rainy Day (4), The Shy Boo
(4), The Seed (5), The Shooting Star (5) — **28 panel captions**, six questions, eighteen
options, all verbatim, correct option still written first in the file and randomised at
runtime. Story 5's ART NOTE is implemented literally: `seed2` is the watering can in daylight,
`seed3` is weather passing (sun then rain streaks), so the two waiting panels can be ordered.

### W5 — the three literacy lessons (`data/lessonsLiteracy.js`)
Every HOOK, SHOW line, TRY step and feedback line verbatim, including:
- the SIP → SHIP boat sign and *"It needs an H! Some letters hold hands and make a brand new sound."*
- the "I CAN HERE YOU!" sign and *"It sounds right... but it's the wrong word. Some words are twins!"*
- **the deliberate chip/ship trap and its kind feedback**: *"That spells CHIP! Tasty — but the picture shows a SHIP. Shhh!"*
- the sort feedback *"That's chips — ch, not sh!"*
- the hear/ear trick *"hear has EAR in it — you hear with your ear!"*
- all three Journal stamps

**The one typographical difference in the whole run:** the pack quotes two feedback lines
*inline inside prose* — `("that's chips — ch, not sh!")` — so they appear there with a
lowercase first letter. On screen each is a standalone speech bubble and begins with a
capital. Words, punctuation and order are identical. This is reported rather than normalised
away, and the inventory script flags it explicitly.

### Art
- **148 picture words** (`js/wordart.js`) — one inline SVG each, house sticker style. Nouns
  js/art.js already drew are delegated to it, not redrawn (bath, bed, boot, flower, picnic,
  rug, tree, well).
- **49 story panels and answer pictures** (`js/storyart.js`) — the 28 story panels, 18 answer
  pictures, and the three "what happens next" endings for Lesson C.
- Every drawing was reviewed on a contact sheet and 15 were redrawn because they did not read
  at card size (ship vs boat, brush, thumb, bath, path, wing, tail, boot, flower, bed, rug,
  picnic, jam, mat).

---

## 2. Pedagogy notes

**Membership is by sound, not spelling.** Sound Sorter asks "which words *contain* that
sound", so `beach` really does hold /ee/ (spelled ea) and is therefore never offered as an
/ee/ distractor. This is what makes "distractors never share the target phoneme" provable
rather than hopeful — 1,600 generated targets are checked against a per-word sound table.

**Accent honesty.** `bath` and `path` are never shown as /ar/ distractors. Southern English
says them with the /ar/ vowel and northern English does not; neither child should ever be
told she is wrong about her own accent.

**The kite problem — an authored-content conflict, resolved in the open.** RUN16.md lists the
-ight family as `light, night, bright, kite(TRAP), right` **and** asserts "traps never rhyme".
Both cannot hold: kite /kaɪt/ rhymes with light /laɪt/ perfectly. Implementing kite as a trap
would have the guide tell a nine-year-old something false and memorable. So kite stays in the
family exactly as authored and **counts as a rhyme**; its trap role is honoured in the way
that is also true — it is the family's *spelling* odd one out, and tapping it earns *"Yes —
kite! It hasn't got i-g-h in it, but listen: kite, light. It rhymes!"*, which is a better
teaching moment than the trap was. The family's non-rhyming near-miss is `eight`, which really
does contain 'igh' and really does not rhyme. A suite asserts kite is **never** offered as a
wrong answer. Logged for Alex in NEEDS_ALEX.md; nothing is blocked.

**No maths content changed.** Every maths question, option and worked example moved into the
new format untouched. What changed is that she drags the answer into the gap instead of
tapping one of four buttons.

**Nothing rewinds, and nothing is silent.** `backTo` is gone from the codebase. A wrong move
springs the piece back, the step stays put, and the guide explains. Stuck twice on a maths
step, she is offered that lesson's own authored variant and told out loud that is what is
happening. Asserted across all nine lessons.

**Sequencing is not a quiz.** In Story Order, swapping panels is never "wrong" — the strip is
simply not finished yet. Stars come from the comprehension question and the hint budget. There
is no Done button to get wrong: the read-back starts the instant the order is right.

**G14, the non-reader path, end to end.** Every activity is playable with sound off (the
grapheme card, the pictures, the slide-together) and by a child who cannot read (spoken
prompts, picture answers). Story Order ships a 👁 toggle that hides every caption, and the
suite **plays a whole level through with the words hidden** rather than asserting that it
could. Every draggable is also tappable, because a drag is a hard motor skill for a small
hand and impossible with a switch.

---

## 3. Bugs found and fixed at source

Five, all real, none of them test scaffolding:

1. **The lesson ceremony fired its `onDone` twice.** Only the click handler cleared the
   auto-close timeout, so closing it any other way left the timer armed — a second
   `ctx.go('results')` landing seconds later, on top of whatever the child had started next.
   `close()` is now idempotent and cancels its own timer.
2. **A dragged piece that was also a drop target always dropped on itself.** It sits under the
   pointer while held, so it won the hit test. Self is now skipped and overlapping targets
   resolve to the nearest centre. (Found by Story Order; Blend It re-verified after the fix.)
3. **The persisted Tricky Pile was write-only.** Unrescued items had been saved and never read
   back since RUN3, so "unrescued items seed the next Smart Mix round" was only half true. A
   pool item sitting in the pile now carries 3× weight.
4. **The literacy ledger ids did not match Bloom's convention.** `data/bloom.js` matches
   `<game>:` prefixes; the literacy games used their own short prefixes, so the two new petals
   would have been added and stayed empty forever. All literacy ids are now game-prefixed.
5. **Test navigation was racing boot().** `main.js`'s navToken silently supersedes a `go()`
   issued before the hub has landed, so a suite could quietly assert against the hub. Every
   RUN16 suite now waits for the first screen, navigates, then waits for the route to own
   `#screen` — condition-waits, never sleeps.

Two more found in the existing suites and fixed rather than worked around:
- `tests/r12s1-routes.mjs` never drove `starType` or `recap` on the results route: its key
  scanner cannot see a key that follows a trailing comment, and teachme.js has always passed
  both. Two lesson fixtures added; the blind spot is documented in place.
- `tests/r4p12-reach.mjs` hard-coded "six lesson cards". No layout regression (clipped: 0) —
  the count now comes from the data, so adding a lesson cannot make it stale again.

Also: `_runall.sh` now honours `BOARD_DIR`/`LOG_DIR` (defaults unchanged), because RUN16 and
RUN17 were building in parallel worktrees and writing verdict files to the same `/tmp/board`.

---

## 4. The board (lean board law, affected suites only)

**26 suites, 26 pass, 0 fail — 358s** (parallel 244s + serial 114s, 4 workers).

Changed files + their dependents + the fixed core. Not the full board; the one full sweep runs
at the end of the programme.

```
r16w1-soundsorter 11s   r16w2-blendit 20s    r16w3-rhymetime 23s   r16w4-storyorder 60s
r16w5-teachme2 70s      r16w6-placement 15s  p8-frames 34s         r15v-economy 17s
r12s1-routes 100s       r12s2-tricky-fair 59s r12s4-contrast 123s  r12s6-intro-pause 50s
r12s13-a11y 93s         r3p1-spellboo 29s    r3p2-smartmix 53s     r4p4-trophies 8s
r4p6-growth 10s         r4p10-phone 4s       r4p10-tablet 9s       r4p12-reach 89s
r5p5-phone 24s          r5p6-intros 11s      r7p3-hub 11s          r8p1-migrations 0s
r10p19-brain 5s         r11audit 7s
```

`r4p12-reach` and `r12s13-a11y` were verified **together**, per the rule for anything that
changes what is on screen. Six new suites were added, two @serial (`r16w2`, `r16w4`) because
they carry frame evidence; none exceeds the 120s budget.

**No flake was re-run into a pass.** Every failure this run was diagnosed and fixed at source:
the boot race, the self-drop, the ceremony double-navigation, and two stale assertions in
existing suites.

**No save-schema change was needed**, so VERSION stays at 17 and no migration was added: the
new games write only to containers that already existed (`ledger`, `trickyPile`, `stars`,
`catBest`, `seen.introSeen`). `r8p1-migrations` green confirms it.

### Evidence held
- W2: 12 frames over 4.2s showing the tile row narrowing through 10 distinct widths, by
  transform, not reflow.
- W4: 14 frames over 3.6s of a panel travelling across the strip, and the drop reordering it.
- W4: the read-back's lit panel matched the spoken caption in 16/16 samples.
- W4: a full level completed with every caption hidden.
- Screenshots in `screenshots/run16/w1…w6`.

---

## 5. Remaining gaps

Honest list of what RUN16 did **not** do.

1. **Sound Sorter has no medial level for sh/ch/th/ng.** English does not give those sounds a
   medial position in the authored six, so the "Sound Pairs" group offers levels 1, 2 and 4
   only. Correct, but a child who reads the level names may notice one missing.
2. **Level 4 words are 6 tiles in Blend It**, above the "three to five" the mechanic describes.
   The brief calls level 4 "longer words" and asks for per-grapheme audio, and honouring both
   means dentist is `d-e-n-t-i-st`. Flagged rather than quietly trimmed.
3. **The near-misses for -ake, -ing, -oon and -ug share sound rather than an exact letter
   pattern** (back, sink, book, bus). English has no common word containing "ake" that does not
   rhyme with cake. The other six are exact letter-pattern traps.
4. **The HOOK is one scene shape** (a Boo holds up the muddle; it corrects itself) reused with
   authored text across all nine lessons, not nine bespoke animations. It reads well and is
   skippable, but it is a template.
5. **Spell Boo was left alone.** Its Smart Mix does not yet draw on the persisted Tricky Pile
   the way the four new games now do; extending it is a small, separate job.
6. **The two Boo Roll geometry items in BLOCKED.md are untouched**, as instructed.

---

## 6. Delight self-critique

**What works.** The blend really does land — watching `sh` `o` `p` close up one sound at a
time while the guide says each part is the best thirty seconds in the pack, and the picture
choice straight afterwards makes her prove she read it. Story Order's read-back is the other
one: getting the order right is rewarded with *hearing the story*, which is exactly the right
prize. Rhyme Time's punchline (the three words said back in rhythm while the cards bounce in
time) is small and cheap and makes a rhyme feel like a joke landing, which was the feel goal.

**What is merely fine.** Sound Sorter's drift is gentle to the point of being easy to miss —
the cards move 8px. It reads as "alive" rather than "spotting something", and a bolder,
slower drift with a little parallax would earn the feel goal properly. The lesson HOOK is a
template; the maths hooks in particular are a sign with two states, and a Boo actually *doing*
the wrong thing would be better.

**What I would change first with more time.** The word pictures are good at 96px and merely
adequate at 74px on a phone — a handful (wing, shake, smell) lean on the spoken word more than
a picture should. And Blend It could let her drag the tiles apart again to re-hear the parts;
right now the blend is one-way.
