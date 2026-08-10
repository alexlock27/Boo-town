# LANE 3 — Findings (cold play + programme audit), 10 Aug 2026

Branch `review-run21-full` @ main `22b8d40` (`run21f-20260804`, save v24). Port 8043.
Every finding below was reproduced by the auditor; nothing is inherited from a prior report
without being re-tested. **Defect** and **idea** are labelled separately, on purpose.
Screenshots live under `_evidence/review-aug10/` (local, gitignored) and are named in full.

Severity: **S1** blocks a child or a merge · **S2** a real loss the child would feel ·
**S3** a defect she probably would not name · **note** true but harmless · **idea** not a bug.

---

## 1. Defects found by playing

### F-01 · S1 · Two funfair celebrations stack; the once-ever grand opening is consumed unseen — and this fails `walk.mjs`, the pre-merge gate

**Where:** The Boo Funfair, first visit, on a save where the Boo Builders have finished
rides while the child was away (exactly `tests/walk.mjs`'s own fixture).

**What happened:** two `.overlay` elements mount together, both at `z-index: 8000`:
`.overlay.funfair-grand.show.open` ("**The Boo Funfair is OPEN!** · Let's go! 🎡") and
`.overlay.growth-reveal.show` ("**Look how the fair has grown!** · The Boo Builders finished
2 rides while you were busy…"). The growth reveal is drawn on top. Hit-testing the grand
opening's button with `document.elementFromPoint` returns the *other* overlay's button:

```
{"cls":"overlay funfair-grand show open","z":"8000",
 "btns":[{"label":"Let's go! 🎡","box":"280,606 209x68","hittable":false,
          "topEl":"btn big:Hooray! 🎉"}]}
```

On the next visit the grand opening is **gone** — it had already been spent while invisible.
The child never sees her funfair open.

**What a child would feel:** nothing, which is the problem. The single biggest "your town
grew up" moment in the game happens behind another card and is never replayed.

**Why it is also S1 for the programme:** `walk.mjs` — the mandated pre-merge smoke — clicks
the first `.overlay .btn` in document order, which is the *covered* button, and times out.
The walk failed on main tonight for exactly this reason (`_evidence/review-aug10/walk-output.txt`,
tablet-portrait). It is a race: tablet-landscape completed 6 laps first, so whichever
overlay paints first decides. **Every lane merging tonight will hit this intermittently and
will be tempted to call it a flake. It is not a flake.**

**Contradicts:** RUN21A ACCEPT **A8** "One reveal at a time, everywhere" (this pair is the
exception) and partly **A16** (the catch-up is correctly gated to the fair — that half is
true — but it was never reconciled with the grand opening).

**Smallest honest fix:** put the grand opening into the same reveal queue the catch-up uses,
so they play in sequence; if both are pending, show the grand opening *first* (it is the
once-ever one) and let the catch-up follow. Engine reuse: the existing reveal queue that A8
already built.

**Evidence:** `ff-768x1024-ff-01-overlays-01-funfair-overlays.png` (both overlays, DOM dump
above), `ff-390x844-ff-02-dismiss-01-stacked.png`, `…-02-after-hooray.png` (grand opening
absent on the return visit), `walk-output.txt`.

---

### F-02 · S1 · `js/playjournal.js` is missing from `sw.js` ASSETS[] — the first offline boot after this stamp activates cannot load the app

**Where:** `sw.js` ASSETS[] (159 entries) vs `js/main.js:13`, which statically imports
`./playjournal.js`. `js/grownups.js:23` imports it too.

**What happened:** the entry was added correctly in the commit that created the file
(`5cc6569`) and was silently dropped by merge commit `a64a5e1` ("Merge main (RUN21B + F4)
into run21c") resolving `sw.js` badly. Every descendant, including live main, inherits the
loss. Once the `run21f-20260804` cache activates and old caches are deleted, a first
*offline* launch 504s on `./playjournal.js` and the module graph — the whole app — fails to
boot. It self-heals only if an online launch happens first under the new cache.

**PROVEN IN THE BROWSER, not just in the tree.** A real offline boot was run against the
review server through `http://app.localhost:8043` (the app deliberately skips SW registration
on `localhost`/`127.0.0.1` — `js/main.js:373-406` — so this is the only hostname that
exercises the real cache path, which is why `m3-pwa` uses it too):

```
controller after 2nd load: true          ← the service worker IS in charge
--- OFFLINE ---
reload: ok
offline boot state: {"boo":false,"screen":null}      ← the app never initialises
FAILED REQUESTS OFFLINE (1):
  ! net::ERR_ABORTED /js/playjournal.js
  ! console.error: Failed to load resource: … status of 504 (offline)
```

**Exactly one request failed, and it is the missing file.** Everything else served from
cache. What the child sees is `offline3-390x844-offline-02-boot-01-offline-boot.png`: an
**empty dark-blue screen**. No Boo Town, no guide, no error she could act on — the app is
simply gone until she is back online.

That makes this the most severe finding of the night: it breaks protected-core rule 3
("works fully offline once installed"), which is the promise the whole PWA exists to keep.

**Smallest honest fix:** one line — restore `'js/playjournal.js'` to ASSETS[]. Then make it
impossible to recur: a suite that enumerates the import graph from `index.html` and fails on
any file absent from ASSETS[]. The current `m3-pwa` core suite evidently does not do this,
and this class of loss is invisible to human review because it happens *in a merge*.

---

### F-03 · S2 · Boo Expedition: everything that happens, happens as a caption

**Where:** Boo Expedition → any trail node (played: Sneezy Bridges, tier Ⅰ, to ★★).

**What happened — and this is the honest answer to "why is it okay, not delighted":** the
game is *good*. The rules are clear, the deduction is real, the budget is generous
(`sneezes: 0/6`), the hint is genuinely informative ("Plum will make one bridge sneeze — it
sneezes at bloop or munch species!"), wrong answers teach ("Pippin made it sneeze — it
sneezes at pip or twirl species!") and nudge kindly ("What do the crossers share?", "Try a
very different Boo!"). Content: strong. **Presentation: nothing moves.**

- No Boo ever crosses a bridge. Tapping Boo→Bridge greys the Boo's card in place.
- The bridge never sneezes. The word "sneeze" appears in a caption at the bottom of the
  screen; the bridge art does not react at all.
- "Everyone made it! ★★" is a line of text. A confetti sprinkle plays over the cards, but
  the two stars do not go anywhere — they do not fly to the meter, they are two glyphs in a
  sentence.
- The trail map's node unlock is discovered by reading, not by watching.

**What a child would feel:** exactly "okay". She solves it, she is told she solved it, and
there is no moment to enjoy. This is the difference between the Expedition and the Wish
Well — the well *shows* her the cake landing in her meadow (see §3).

**Smallest honest fix (pack-ready seed S-01):** three transform-only animations, no new
systems. (1) On a successful crossing, slide the Boo's card along the bridge to the far side
(~600ms) and leave it there — the "Across: n of 8" counter then narrates something the child
watched. (2) On a sneeze, shake the bridge and burst a small "ACHOO!" — the comedy is
already written, it just has no picture. (3) On completion, fly the earned stars from the
banner to the star meter. **Engines reused:** the town's pose/keyframe layer for the slide,
`js/sfx.js` for the achoo, and the existing star-fly used elsewhere in results.

**Evidence:** `kid-rich-390x844-step-24-exp-bridge2-01-bridge-1.png`,
`…-step-25-exp-solve-02-first-sneeze.png`, `…-03-bridge-end.png`.

---

### F-04 · S3 · A brand-new save is greeted with "Something new arrived! 70 things to see"

**Where:** hub, immediately after character creation on a fresh save.

**What happened:** the What's New chip fires for a child who has never seen anything, and it
opens *over* the unfinished "How Boo Town works" intro card — two first-run surfaces
competing. 70 entries is a wall of text about features she has not met.

**What a child would feel:** mild confusion; a returning-player surface aimed at a first-time
player. Not harmful, but it is the first impression.

**Smallest honest fix:** stamp `seen.whatsnewVersion = LATEST_VERSION` when a save is
*created*, so the first card a child ever sees is genuinely her first *new* thing. One line
in save creation. (Idea, adjacent: hold the chip until the intro card is finished.)

**Evidence:** `kid-phone-390x844-step-06-intro-card-02-hub-clean.png`, `…-03-whatsnew-open.png`.

---

### F-05 · S3 · First-run copy describes a state the child is not in

**Where:** the Meadow on a fresh save (zero Boos owned).

**What happened:** the area hint reads "Drag from the tray. **Tap a Boo to say hi!**" when
there is no Boo anywhere and the tray's own empty state correctly says "Win games to collect
Boos, then place them here! 🌱".

**Smallest honest fix:** branch the hint on ownership — the tray already knows how to.

**Evidence:** `kid-phone-390x844-step-10-meadow-04-meadow-3.0s.png`.

---

### F-06 · note (confirms a known-honest gap) · An empty outdoor area gets no opening beat

**Where:** first Meadow visit, fresh save.

**What happened:** exactly what RUN21D's report honestly predicted — with nothing placed,
the Pulse Director has nothing to animate, so the area is still until the 9-second text
invitation ("Try tapping a flower…", which arrived on schedule). Graded **ALREADY-DISCLOSED**,
not a new finding; recorded because it is the *first* thing a new child experiences, which
makes it worth more than its severity suggests.

**Smallest honest fix (seed S-02):** a sixth pulse rung for empty areas that animates the
*scenery* the area always has (the tree, the well, the grass) rather than placed items.

---

## 2. Claims from the corpus, graded

Grades: **CONFIRMED** (still true) · **OVERSTATED** (real but smaller than claimed) ·
**ALREADY-HANDLED** (fixed since the claim was written) · **WRONG** (not true).

### Expedition claims

| ID | Claim | Grade | Evidence |
|---|---|---|---|
| E1 | Expedition shell MISSING | **ALREADY-HANDLED** | Door on the hub; mounts; honest empty state on a Boo-less save ("An expedition needs 8 brave Boos — open a few more mystery boxes first!" + a working "See my Boos"). |
| E2 | Expedition puzzles MISSING | **ALREADY-HANDLED** | Sneezy Bridges played end-to-end. |
| E3 | Hint should be an informative next clue, not a random reveal | **CONFIRMED (working as specced)** | Hint named a decisive Boo and its species rule. |
| E4 | Party picker **8–12** with variety top-up; 4 named nodes; budgets `sneezes[6,6,8,8]` | **PARTLY — the party half is OVERSTATED** | Node names exact ✓. Tier-Ⅰ sneeze budget 6 ✓. But the picker caps at **exactly 8**: a 9th tap replies "That is eight already — tap one to swap it out!" There is no 8–12 range and no top-up on main. |
| E5 | P15–P17 salvaged and working | **CONFIRMED** | — |
| E6 | Caper unreachable while the Expedition was contained; self-resolves when reopened | **ALREADY-HANDLED (door open)** | `data/expedition.js:9` `CONTAINED=''` → no contained routes; full-trail completion not reached tonight, so the caper *hand-off* itself is **UNVERIFIED** — flagged, not claimed. |
| E7 | Ferry Raft was uncompletable; fixed, 240/240 solvable | **NOT REACHED tonight** (node 3; gated behind the picnic). Code fix is pinned by `tests/r18c-expedition.mjs`; I did not re-derive it. Recorded honestly as unverified-by-play. |
| E8 | Trail-completion presentation "was never built" | **PARTLY CONFIRMED** | Per-node completion exists but is text-only (see F-03). Full-trail completion not reached. |

### Non-Expedition corpus claims re-tested

| ID | Claim | Grade | Evidence |
|---|---|---|---|
| N1 | Lamp floats above the table | see §3 (screenshots at several scales — the item HANDOVER §6 explicitly demanded) | |
| N2 | All 60 wish chips show one gold medallion | **ALREADY-HANDLED** | `WISH_ART` has exactly 60 distinct entries; wished CAKE → a real cake, placed and living in the meadow. |
| N3 | Balloon `OUTDOOR_ONLY` but not `SKY_WISHES`; chip says "sky only" | **CONFIRMED structurally, copy claim WRONG** | The mismatch is real (`data/wishlife.js:20` vs `js/town.js:1485`), but the literal "sky only" tag was retired in RUN21C-8. Indoors the balloon now reads "Needs the sky" / "needs the sky!" — still arguably overstated for a tethered flyer, but not the string the corpus quotes. S3. |
| N15 | A short party shows an EMPTY guide line **and no follow-up action** | **HALF CONFIRMED, HALF WRONG** | The `.exp-guests` banner really is `''` when the party is short (`js/expedition/trail.js:136-138`) — but the same state unhides `.exp-need` with authored copy and a working "See my Boos" button, which I *saw and used* on the fresh save. `tests/r11audit.mjs` is a **stale test** (expects `.exp-goto-games`, which no longer exists). Fix the suite, not the game. |
| N17 | Blend It sounds graphemes out of order | **WRONG at code level** | `js/games/blendit.js:208-226` walks `item.g` by ascending index and only requests part *i+1* on part *i*'s `onend`. Not reproduced by play tonight (the four speech suites were assigned to a lane that died; graded from code, and said so). |
| N19 | Story Order speaks the wrong panel's caption 8/16 | **NOT REPRODUCED; likely test sampling** | Read-back derives the spoken line and the highlight from the same object and advances on the utterance's own `onend`. One latent inverted index (`storyorder.js:246`) is unreachable while `isSolved()` gates both callers. Recommend re-pointing the suite rather than "fixing" the game. |
| N20 | Encouragement line renders but is never spoken | **WRONG as stated** | It is passed to TTS at both call sites (`js/results.js:235`, `js/hub.js:538`); it is silent only when the voice setting is off, which is the default. |
| N23 | Toddler Stories asks 3–4s to sequence 4 wordless panels | **CONFIRMED** | `playToddler()` takes the two shortest; the shortest authored stories are 4 panels (`rainy`, `shy`). Still the maintainer's product decision, unchanged. |
| N27 | Bounce last-resort guard changes a digit with no sparkle-hop | **CONFIRMED** | `js/games/bounce.js:273-285` sets `target.label` with no `spawnHop`, unlike the normal path at `:262`. A digit changes silently under the child's eyes. S3, cheap fix. |
| N29 | Dash hearts never render (`.heart-ic.on` matches nothing) | **CONFIRMED, but the app is right and the test is wrong** | The hearts row was deliberately removed (RUN18B Y7, `js/gameshell.js:54-57`); `tests/p8-frames.mjs` still queries `.heart-ic.on`, so its heart assertions are vacuous (0 before, 0 after). Re-point the suite. |
| N33 | Boo Roll clock runs at 2× real time | **carried forward, unverified tonight** | Not played; no claim made. |
| N37 | One feelings value reaches device storage with the feature off | **NOT TESTED tonight** — belongs to the parent pass; recorded as still open. |

---

## 3. The HANDOVER §6 items, answered as demanded

### 3.1 "Lamp floats above the table" — **the claim is WRONG on today's build**

HANDOVER asked for "a screenshot at several scales, not another measurement". Five table
scales spanning the full indoor resize contract (0.70 · 1.00 · 1.30 · 1.76 · 2.00), lamp
parented to the table, phone width:

| scale | crop |
|---|---|
| 0.70 | `_evidence/review-aug10/LAMP-zoom-scale-0p7.png` |
| 1.00 | `LAMP-zoom-scale-1.png` |
| 1.30 | `LAMP-zoom-scale-1p3.png` |
| 1.76 | `LAMP-zoom-scale-1p76.png` (the scale the original QA agent used) |
| 2.00 | `LAMP-zoom-scale-2.png` |

At every scale the lamp's base sits **on the tabletop's back-left rim**. There is no 80–100px
float at 176% or anywhere else; RUN21B item 3's re-baseline holds up. *Grade: **WRONG** (as
of `run21f-20260804`) / **ALREADY-HANDLED** relative to when it was written.*

Two honest residuals, neither the reported bug (both **idea**, not defect):
- The lamp keeps its own scale while the table grows, so on a 2× table it reads doll-sized.
- Slot 0 is at the back-left corner, so a single child item perches on the rim rather than
  sitting on the table. Centring a lone surface child would read better.

*(Note on method: I first tried to measure the gap with my own `SURFACE_Y × height`
arithmetic and got −3px to −12px "float". That arithmetic was mine and wrong — `js/town.js:1738-1745`
documents precisely this trap, that the parent's rendered box bottom is `pHeight*10/130`
below its ground line. The pictures are the answer, which is exactly why HANDOVER asked for
pictures. I am recording my own false start because the same mistake is what produced the
original 80–100px claim.)*

### 3.2 Bounce last-resort sparkle — **CONFIRMED** (S3)

`js/games/bounce.js:273-285`: the guard sets `target.label = correctText` and clears the
holder with no `spawnHop(...)`, while the normal reconcile path at `:262` always hops. A
digit changes under the child's eyes with no motion at all. Smallest fix: call the same
`spawnHop` the neighbouring branch already uses (engine: the game's own hop).

### 3.3 Balloon `OUTDOOR_ONLY` / `SKY_WISHES` — **structurally CONFIRMED, copy claim WRONG**

`data/wishlife.js:20` lists `balloon` in `OUTDOOR_ONLY`; `js/town.js:1485` `SKY_WISHES` does
not include `wish_balloon`. So the balloon is refused indoors as a sky wish but never anchors
to the sky — real mismatch, S3. The corpus quotes the chip as saying "sky only"; that string
was retired in RUN21C-8. Today it reads "Needs the sky" / "needs the sky!", which is still
odd for a tethered flyer but is not the reported text.

---

## 3A. The Boo Band — before-state, for Lane 5's rebuild

Captured on main at `run21f-20260804`, phone 390×844, so tonight's rebuild has something
honest to be measured against.

**Where you arrive.** `The Boo Band` is a **six-row text menu** (Drums · Keys · Guitar ·
Xylophone · Songs · My Jams) with an emoji tile per row. Above it sit three Boos whose
instruments are **emoji glyphs pasted beside the art** (🥁 🎹 🎸). It is a menu screen, not a
bandstand: nothing moves, nobody is playing, and the room has no sound of its own.
*(`band2-390x844-band-05-rooms-01-band-room.png`)*

**Why the strum is boring — precisely.** *(`…band-06-guitar-01-guitar-arrive.png`,
`…band-07-strumfeel-01..09`)*

1. **There is no guitar.** The instrument is a **purple gradient rectangle** with a
   double-headed arrow and the word STRUM. The only guitar on the screen is a ~20px 🎸 emoji
   beside the Boo's head. A child who wants to play a guitar is given a colour swatch.
2. **The gesture produces no picture.** I filmed a full drag — frames at 60ms, 150ms, 270ms
   during the stroke and at +150ms, +450ms, +1050ms after it. **Every frame is identical.**
   No string moves, no ripple, no flash, no chord name pulse, no Boo animation. The only
   evidence that anything happened is sound.
3. **It is not a strum, it is a chord retrigger.** Instrumenting `createOscillator`: one
   downward drag fired **16 oscillators in 4 groups of 4** — the whole four-note chord fired
   four separate times, ~180–280ms apart, as the finger crossed zones. A strum's defining
   sound is strings arriving in fast sequence (a ~20–40ms arpeggio); this is a block chord
   played four times. Up-strum on a different chord behaves identically (8 oscillators in 2
   groups of 4) — **the direction the child drags changes nothing audible**.
4. **Four rapid strums** produced 32 oscillators with inter-group gaps of 182–284ms —
   consistent, but consistently *blocky*: it sounds like pressing a chord button repeatedly,
   not like playing.
5. Typographic detail: the arrow glyph is drawn **through** the word STRUM, striking it out.

**The keys.** *(`…band-08-keys-01-keys-arrive.png`)* Ten white keys, no black keys, drawn as
plain white bars 33px wide × 534px tall filling most of the screen; the piano is again an
emoji beside the Boo. There **is** a play-along: "Choose a song" → "Choose a song for
press-paced sparkles", and Songs offers a preview then "follow the sparkles on the keys".
Key width of 33px is under the 44px tap-target standard (the extreme height makes them
hittable in practice — **S3, noted honestly, not inflated**).

**Where the sparkle actually sits today.** Not in the instruments — in **Songs**: seven
tracks with previews, three "for little Boos" (Twinkle Twinkle, Row Your Boat, Old MacDonald)
and four original Boo Pop Hits with real tempos (112–124 bpm) and a machine-checked
composition ruleset (`data/songs.js`, `tests/lib/melody.mjs`). The music *content* is the
strongest part of the band by a distance; the **instruments are the weak part**, and the
guitar is the weakest of those. That is the right target for tonight's rebuild.

**One rules conflict this uncovered** — see §4.4.

---

## 4. Programme audit (Part B)

### 4.1 What's New — is every claim true as a child would test it?

All **70 entries across 22 blocks resolve to real routes** in `js/main.js` (checked
exhaustively, not sampled); params are consumed by real code (`area`, `room`,
`openWishWell`, `shelf`); version order matches the real BUILD_STAMP history and
`LATEST_VERSION` equals the live stamp. **No second "Boos walk on your paths" was found** —
that remains the only withdrawn claim, and its withdrawal is correct.

Two edges worth knowing, neither a false promise:

- "Every place has its own sound — *listen closely*" is silent when the music mute is on
  (`js/sfx.js:50` gains the ambient bus to 0). Music defaults on, so it is not a
  switch-on violation, but the card tells a muted child to listen to nothing.
- `run20d-20260731` shipped as a BUILD_STAMP with no What's New block. No child-facing
  feature shipped under it, so no card was owed — recorded because it is the one stamp in
  history that does not match a block.

### 4.2 Offline law

See **F-02** (S1). The audit enumerated all 149 files under `js/` and `data/`: 148 are in
ASSETS[], `js/playjournal.js` is the only omission, and every one of the 159 ASSETS entries
exists on disk (no dangling entries). `js/games/boorollplay.js` is precached but imported
only by a test — harmless, worth relocating one day.

### 4.2b Walk (pre-merge smoke) — ran twice tonight: **FAIL, then PASS**

| run | result | detail |
|---|---|---|
| 1 | **FAIL** | tablet-portrait, funfair: the ack click timed out on a covered overlay button (`walk-output.txt`) |
| 2 | **PASS** | 10.1 min, all three viewports, 6 laps each, **0 errors** (`walk-output-2.txt`) |

**This matters more than the pass/fail count.** Under the standing "known flakes are flakes
on sight — one serial re-run to confirm" rule, run 2 passing would have closed the book and
F-01 would have been thrown away as noise. It is not noise: the DOM hit-test in F-01 proves a
real stacked-overlay defect that exists whether or not the walk trips over it. **Recommended
amendment to the flake rule:** a re-run that passes downgrades *urgency*, it does not
establish *absence* — a failure gets one look at what it was actually touching before it is
called a flake.

### 4.3 Secrets and names

Tracked tree: **clean** — no emails, tokens, phone numbers, or child names (the only
human names are test fixtures: "Ada", "Maya", "Twiggy"). Three things for the maintainer,
none fixable by this lane:

1. **Children's first names remain in public git history**, including in a commit *subject*
   (`82a6806`), reachable from main. The tree was purged; history was not. Options and
   trade-offs are set out in `CLAUDE-v2-PROPOSAL.md` §4.1. **Escalated, not decided** —
   this is a children's-privacy call, which tonight's governance reserves for Alex.
2. `HANDOVER-2026-07-31.md` is tracked and published although `.gitignore:78` declares that
   file class "never published to the public repo". One `git rm --cached` fixes it.
3. `TONIGHT-*.zip` has no gitignore pattern; one sits untracked in the main worktree today.

---

## 5. Seeds for the next programme (ranked, pack-ready)

Each seed states: the observation · the evidence · the smallest honest fix · the engine it
reuses. Ranked by *delight-per-hour*, not by severity.

| # | Seed | Observation | Smallest honest fix | Engine reused |
|---|---|---|---|---|
| **S-01** | **Make the Expedition visible** | The best-designed game in the app resolves entirely in captions (F-03) | Card-slide across the bridge · bridge shake + ACHOO on a sneeze · stars fly to the meter on finish | town pose/keyframes · `sfx.js` · existing star-fly |
| **S-02** | **A beat for empty areas** | A new child's first area is motionless for 9s (F-06) | Sixth pulse rung animating always-present scenery | Pulse Director |
| **S-03** | **Reveal queue completeness** | Two funfair ceremonies stack; one is lost (F-01) | Enrol the grand opening in the existing reveal queue | A8's reveal queue |
| **S-04** | **First-run truthfulness** | New saves get "70 things to see"; empty meadow says "Tap a Boo" (F-04, F-05) | Stamp `whatsnewVersion` at save creation; branch the hint on ownership | — |
| **S-05** | **Discoverability beyond What's New** | Path Pot, resize-after-drag and Undo are announced once on a card and never again taught in-world | One first-use beat each, the way the Pulse already teaches | Pulse Director |
