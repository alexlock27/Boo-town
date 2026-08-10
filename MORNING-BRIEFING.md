# MORNING BRIEFING — Lane 3 (playtest & programme audit), night of 10 Aug 2026

Read-only lane. Branch `review-run21-full`, off `main` @ `22b8d40` (`run21f-20260804`,
save v24). Nothing in the app was edited. Detail: `LANE3-FINDINGS.md` · rules proposal:
`CLAUDE-v2-PROPOSAL.md` · working ledger: `LANE3-LEDGER.md` · screenshots:
`_evidence/review-aug10/` (local only).

---

## 1. The verdict, in five bullets

1. **One thing must be fixed before anything else ships: the app does not boot offline.**
   `js/playjournal.js` is imported by `js/main.js` but missing from `sw.js` ASSETS[]. I
   proved it in a browser, not on paper — offline reload gives a **blank dark-blue screen**
   and a single 504 on that exact file. It is a one-line fix, and it breaks the promise the
   whole PWA exists for.
2. **The programme's promises are, overwhelmingly, true.** All 70 What's New entries resolve
   to real routes; the RUN21A/B/C/D/F behaviours I could test as a child were there. I went
   looking for a second "Boos walk on your paths" and **did not find one**. The honesty of
   this programme's record is its best feature.
3. **The Expedition's problem is not its design, it is its silence.** The puzzles are good —
   real deduction, generous budgets, comedy-wrong, informative hints. But a Boo crossing a
   bridge is a *caption*: nothing moves, nothing crosses, the stars don't fly. That is the
   whole distance between "okay" and "delighted", and it is three animations wide.
4. **The funfair's once-ever grand opening is being consumed unseen** — two celebration
   overlays stack and the child never sees "The Boo Funfair is OPEN!". This is also what
   made `walk.mjs` fail tonight, and the standing "one re-run and it's a flake" rule would
   have thrown it away (the re-run passed).
5. **Tonight's band rebuild (`run21g`) is a genuine improvement** and fixes exactly what I'd
   named as the before-state failure: the purple STRUM rectangle is now a soundboard with
   four strings that pluck in sequence under the finger, and the chord-block retrigger is now
   a real arpeggio (48–85ms between strings).

---

## 2. Cold-play findings by severity (child-facing first)

### S1 — fix before shipping anything

| id | Finding | Fix |
|---|---|---|
| **F-02** | **Offline boot is broken.** `js/playjournal.js` missing from `sw.js` ASSETS[] (added correctly in `5cc6569`, silently dropped by merge `a64a5e1`). Proven live via `app.localhost:8043`: `{"boo":false,"screen":null}`, one failed request, 504 on `/js/playjournal.js`, blank screen. | One line: restore the ASSETS entry. Then add a suite that walks the import graph so a merge can never do this again — `m3-pwa` doesn't catch it. |
| **F-01** | **Two funfair celebrations stack**; the grand opening is drawn *under* the growth reveal, its button is not hittable (`elementFromPoint` returns the other overlay's button), and it is spent unseen — on the next visit it's gone. Violates ACCEPT A8 ("one reveal at a time, everywhere"). Also the cause of tonight's `walk.mjs` failure. | Enrol the grand opening in the reveal queue A8 already built; if both are pending, show the once-ever one first. |

### S2 — a real loss the child would feel

| id | Finding | Fix |
|---|---|---|
| **F-03** | **Boo Expedition resolves entirely in captions.** No Boo crosses a bridge, no bridge sneezes, the ★★ don't fly. | Three transform-only animations — card-slide across the bridge, bridge shake + ACHOO, stars fly to the meter. Reuses town poses, `sfx.js`, the existing star-fly. |
| **F-09** | **"Look, don't touch" is contradicted**: tapping a friend's Boo in a visited town opens the full Care panel — five enabled buttons and a tutorial card — and pressing them does nothing. | Keep the squeak and pose in visit mode; don't open the care arc. Same `isVisiting()` guard that already hides the tray. |

### S3 — real defects she probably wouldn't name

- **F-04** a brand-new save is greeted with "Something new arrived! **70 things to see**",
  over the unfinished intro card. *Fix: stamp `whatsnewVersion` when the save is created.*
- **F-05** the empty first Meadow says "**Tap a Boo to say hi!**" to a child who owns no Boos.
- **F-07** the Grown-ups panel reports "**Build: unknown**" whenever the service worker isn't
  controlling the page — including the deploy gate's own version check.
- **F-08** every switch in the panel is **60×34px**, under the 44px tap-target standard — in
  the accessibility panel itself.
- **N27** Bounce's last-resort guard changes a brick digit **with no sparkle-hop** while every
  other label move animates (`js/games/bounce.js:273-285`).
- **N3** balloon is `OUTDOOR_ONLY` but not a `SKY_WISHES` member — refused indoors as a sky
  wish, never sky-anchored. (The quoted "sky only" copy is stale; it now says "Needs the sky".)
- **Band art**: the Boos' instruments are emoji glyphs beside the art (🥁 🎹 🎸) — on both
  branches. The art law says no emoji-as-art in game scenes; the band is the one room that
  most needs real instruments.

### Not defects — worth knowing

- An **empty outdoor area gets no opening beat** (RUN21D disclosed this honestly). It is
  still the first thing a brand-new child experiences: a motionless meadow until the
  9-second invitation. Seed S-02.
- The keys' white bars are **33px wide** (very tall, so hittable) — same class as the ABC
  keyboard question already sitting with you.

---

## 3. Promise-vs-truth audit

**What's New (all 22 blocks, 70 entries):** every route resolves in `js/main.js`; every
param is consumed by real code; version order matches the real BUILD_STAMP history and
`LATEST_VERSION` equals the live stamp. **No untrue entry found.** Two edges, neither false:
the ambient-beds card says "listen closely" but the beds are gained to 0 when music is muted;
`run20d-20260731` shipped as a stamp with no block (nothing child-facing shipped under it).

**Corpus claims re-graded by playing** (the ones that cost verification time before):

| Claim | Grade |
|---|---|
| Lamp floats 80–100px above the table | **WRONG on today's build** — screenshots at 0.70/1.00/1.30/1.76/2.00 show it resting on the tabletop at every scale. RUN21B item 3 holds. |
| All 60 wish chips are one gold medallion | **ALREADY-HANDLED** — 60 distinct artworks; wished CAKE and got a cake. |
| Expedition party picker is 8–12 with variety top-up | **OVERSTATED** — the picker caps at exactly 8 ("That is eight already — tap one to swap it out!"). |
| Expedition shell/puzzles missing | **ALREADY-HANDLED** — present, mounts, plays, honest empty state on a Boo-less save. |
| Short party shows an empty guide line **and no follow-up** | **HALF true** — the banner really is `''`, but the same state shows an authored card and a working "See my Boos" button. `tests/r11audit.mjs` is stale (expects `.exp-goto-games`, which no longer exists). **Fix the test, not the game.** |
| Blend It sounds graphemes out of order | **WRONG at code level** — strictly serialised, each grapheme awaits the previous one's `onend`. |
| Story Order speaks the wrong panel's caption | **not reproduced** — spoken line and highlight come from the same object; the suite most likely samples mid-utterance. |
| Encouragement line is never spoken | **WRONG as stated** — passed to TTS at both call sites; silent only when voice is off (the default). |
| Dash hearts never render | **CONFIRMED — and the app is right**: the hearts row was deliberately removed (RUN18B Y7); `tests/p8-frames.mjs` still queries `.heart-ic.on`, so its heart assertions are vacuous. |
| Toddler Stories asks 3–4s for 4 panels | **CONFIRMED** — shortest authored stories are 4 panels. Still your decision. |

**Offline / precache:** 149 files under `js/` + `data/`; 148 in ASSETS[]; the one omission is
F-02. No dangling ASSETS entries. `js/games/boorollplay.js` is precached but imported only by
a test (harmless).

**Secrets:** the tracked tree is clean. Three items for you, none of them fixable by an agent:
1. **Children's first names remain in public git history**, including in a commit subject
   (`82a6806`), reachable from `main`. The tree was purged; history wasn't. *Escalated rather
   than decided — tonight's governance reserves children's-privacy calls for you.*
2. `HANDOVER-2026-07-31.md` is tracked and published although `.gitignore:78` declares that
   file class "never published". One `git rm --cached`.
3. No gitignore pattern for `TONIGHT-*.zip` (one sits untracked in the main worktree).

**Walk (pre-merge smoke):** ran twice — **FAIL** (tablet-portrait, the F-01 overlay), then
**PASS** (10.1 min, three viewports, zero errors). Both logs in `_evidence/review-aug10/`.

---

## 4. Seeds for the next programme (ranked, pack-ready)

Each is an *observation → smallest honest fix → engine it reuses*. **Defect** seeds fix
something broken; **idea** seeds are preferences and are labelled as such.

| # | Seed | Kind | Observation & evidence | Smallest honest fix | Engine reused |
|---|---|---|---|---|---|
| **S-01** | **Make the Expedition visible** | defect | The best-designed game in the app resolves in captions (F-03; `kid-rich-…-step-25-exp-solve-*.png`) | Card-slide across the bridge · bridge shake + ACHOO on a sneeze · stars fly to the meter | town poses/keyframes · `sfx.js` · existing star-fly |
| **S-02** | **A beat for empty areas** | defect-ish | A new child's first area is motionless for 9s (F-06; `kid-phone-…-step-10-meadow-*.png`) | A sixth Pulse rung that animates always-present scenery (the tree, the well) when nothing is placed | Pulse Director |
| **S-03** | **Complete the reveal queue** | defect | Two funfair ceremonies stack; the once-ever one is lost (F-01) | Enrol the grand opening in the queue; once-ever wins the first slot | A8's reveal queue |
| **S-04** | **First-run truthfulness** | defect | "70 things to see" on a brand-new save; "Tap a Boo" in a Boo-less meadow (F-04, F-05) | Stamp `whatsnewVersion` at save creation; branch the hint on ownership | — |
| **S-05** | **Discoverability beyond What's New** | idea | Path Pot, resize-after-drag and Undo are taught once on a card a returning child dismisses forever | One first-use beat each, the way the Pulse already teaches | Pulse Director |
| **S-06** | **Give the band a room** | idea | The band landing is a six-row text menu with emoji tiles; the Boos hold emoji instruments | A bandstand scene with the trio and real instrument art; menu becomes the stage | town scene grammar · `art.js` |
| **S-07** | **Visit mode: taps that mean it** | defect | Care panel opens in a "look, don't touch" town and does nothing (F-09) | Squeak + pose only; suppress the care arc under `isVisiting()` | existing visit guard |
| **S-08** | **A tap-target sweep of grown-up surfaces** | defect | Panel switches 60×34; keys 33px wide (F-08) | Grow switch height to 44px; revisit narrow key columns | — |
| **S-09** | **Retire two stale suites, don't "fix" the games** | defect (test-side) | `r11audit` expects a removed element; `p8-frames` asserts hearts that were deliberately deleted | Re-point both to today's DOM | — |

---

## 5. Rules changed / proposed tonight

I changed **no** rule unilaterally. `CLAUDE-v2-PROPOSAL.md` is a draft constitution for you to
adopt, edit, or bin. Its three load-bearing proposals:

1. **"No real-world song melodies" → RELAX.** The app already ships three public-domain
   nursery tunes note-for-note, correctly and legally (`data/songs.js:24-45`). The rule's
   letter would delete them; its purpose (never infringe) is already met. Rewrite offered.
2. **"Learning content exactly as written" → RELAX** to fidelity-to-the-child, folding in
   tonight's governance amendment as drafted text.
3. **Split the constitution from the handbook.** A dozen standing laws (ports, seeding,
   flake rules, pan primitives) are good engineering knowledge and bad constitution — mixing
   them with "nothing shames the child" teaches an agent that both are equally negotiable.

One amendment I'd argue for on tonight's evidence: **a re-run that passes downgrades urgency,
it does not establish absence.** The flake rule, applied literally, would have discarded F-01.

---

## 6. What I did not get to (so nobody assumes it was covered)

- The four speech-cluster suites were graded **from code, not from play** — the sub-agent
  assigned to play them died on a session limit. Blend It / Story Order / encouragement
  verdicts above are code-level and labelled as such.
- **Ferry Raft and a full Expedition trail** were not reached (node 3 is gated behind the
  picnic); the caper hand-off is therefore unverified by play.
- The **keys play-along after-state** on `run21g`, and its "a finished song is a moment"
  claim.
- Boo Roll's 2× clock, the feelings-storage privacy claim (N37), Care/shop/ceremony depth,
  and the Toddler tier as a 3–4 year old.
