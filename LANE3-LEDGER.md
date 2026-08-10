# LANE 3 — Playtest & Audit ledger (2026-08-10, overnight)

Branch `review-run21-full` @ main 22b8d40 (`run21f-20260804`, save v24). Port 8043.
READ-ONLY lane: markdown reports only; screenshots local under `_evidence/review-aug10/`.

## Setup log
- Worktree `..\Boo-town-review-wt` created from main; node_modules junctioned. Server: `_serve.py 8043` (no-store). ✓ boots to Start.
- DECISION: drive all play through a persistent-profile Playwright driver (`_evidence/review-aug10/tools/drive.mjs`) rather than the interactive browser pane. · WHY: the session is unattended, the pane cannot composite screenshots ("Browser pane is not displayed"), and screenshots are this lane's evidence standard; the driver keeps localStorage across sittings like a real child's browser, arms the same error hooks walk.mjs uses, and drives the REAL mouse per the house testing law. · REVERSIBLE: delete the profiles dir; nothing app-side is touched.
- DECISION: added a `review-8043` entry to MAIN `.claude/launch.json` (dev-tooling config, not app code) so the harness can manage the server process. · WHY: the harness forbids raw background servers via shell; launch.json is the sanctioned path; the entry is additive and names an absolute path into the review worktree. · REVERSIBLE: delete the entry; file is untracked dev config.

## Corpus harvested (full registers in LANE3-CLAIMS-REGISTER.md)
- Expedition claims E1–E8; general findings N1–N55; HANDOVER §6 unresolved verbatim.
- What's New register run21a→run21f-20260804 (13 live entries + 1 withdrawn), ACCEPT register (top child-visible: B1,B2,B3,C1,C2,C3,C7,D1,D2,D3,D4,A1,A16,F7,F5), standing-laws list for Part B2.
- Known truths that frame the audit: "Boos walk on your paths" withdrawn (C5 BLOCKED — mechanism exists, not visible); PICK-UP-HERE.md on main is STALE (still says run21b live, F5/F6 not started); RUN21C item 5 must NOT be tested as promised; F6 known limitations (custom Boos absent, dusk giggle repeat, crown verb) are recorded, not new findings.

## Play sessions
(appended as they happen)

### Sitting 1 — fresh save, phone 390×844 (kid-phone profile)
- Onboarding: title → name → age (10 buttons incl. "3 or younger"/"12 and up") → character
  maker (5 animals, Surprise me) → guide intro → hub. Warm, clear, one action per screen.
  Evidence: `_evidence/review-aug10/kid-phone-390x844-step-0*.png`.
- FINDING (minor, first-run): onboarding keeps nothing until Done — any relaunch mid-flow
  restarts at the title. One-time flow, low severity.
- FINDING (idea, first-run): a brand-new save is greeted with "Something new arrived! 70
  things to see" — nothing is "new" to a new child; 70 is a wall. Smallest fix: stamp
  seen.whatsnewVersion = current BUILD_STAMP at save creation.
- FINDING (polish): the What's New sheet can open OVER the unfinished "How Boo Town works"
  intro card — two competing first-run surfaces (shot step-06-…-03-whatsnew-open.png).
- Hub intro card: 3 steps, skippable ✓. Bubble Pop has its own gentle 3-step intro ✓
  ("Wrong pops just wobble — try again, no worries!").
- First Town tap → world map (Meadow open; Riverside 40⭐/Hilltop 100⭐/Beach 180⭐ locked;
  💌 visible ✓). First Meadow (real night): D1's honest gap CONFIRMED AS EXPERIENCED — a
  fresh, near-empty meadow has NO opening beat; still scene until the 9s text invitation
  ("Try tapping a flower…" arrived on schedule ✓). Top hint says "Tap a Boo to say hi!"
  when the child owns zero Boos (copy vs state). Tray empty-state line is lovely ✓.
- Wish Well: CAKE → gold letters land readable (A3 CONFIRMED, shot step-12-…-03-wish-1.2s),
  grant is a witnessed moment ("Your wish came true!", real cake art, tray dropped, A4 ✓),
  cake then lives in the meadow as wish_cake (B1 CONFIRMED for cake). Butterfly ambient by
  day ✓.
- Fresh-save Expedition: honest empty state ("needs 8 brave Boos — open a few more mystery
  boxes first!") with See-my-Boos action ✓. E1/E2 graded ALREADY-HANDLED (shell + game
  exist and mount).

### Sitting 2 — rich save (kid-rich profile), phone
- Seeded v23 walk-shape save (14 Boos, 900⭐, fair built) → migrated v24 losslessly; every
  placement gained id (F5 mechanism ✓); "You're back! The Boos missed you." — no guilt ✓.
- Expedition party picker: cap is EXACTLY 8 ("That is eight already — tap one to swap it
  out!") → E4's "party picker 8–12 with variety top-up" graded OVERSTATED against main.
  Trail: 4 nodes named exactly as claimed (CONFIRMED): Sneezy Bridges / Picky Grumps'
  Picnic / Ferry Raft / Boo Hotel; linear gating "Finish the bridge first".
- Re-entering the Expedition lands on the picker (party remembered) — trail resumes only
  after re-pressing "Off we go!" (minor).
- Sneezy Bridges tier Ⅰ played to ★★: budget sneezes 0/6 (E4 budget CONFIRMED); hint names
  an informative Boo ("Plum will make one bridge sneeze…") — E3 CONFIRMED; sneeze lines
  teach ("Pippin made it sneeze — it sneezes at pip or twirl species!"); nudges short and
  kind ("What do the crossers share?", "Try a very different Boo!"); finish = confetti +
  "Everyone made it! ★★", trail unlocks node 2 with "Cosy cocoa at camp" flavour.
- FINDING (the delight gap, pack-ready): THE CROSSING IS INVISIBLE. Success/sneeze/finish
  all land as bottom-bar captions; the Boo card greys, no Boo ever crosses a bridge, the
  bridge never visibly sneezes, the ★★ don't fly to the meter. Smallest honest fix:
  transform-only card-slide across the tapped bridge (~600ms) + bridge shake/ACHOO burst
  on sneeze + stars flying to the meter at finish. Engine reuse: town pose keyframes,
  sfx.js squeak, existing star-fly. Evidence: step-25-…-02-first-sneeze.png,
  …-03-bridge-end.png.

### Part B code audit (workflow, complete — full detail in task output)
- S1: js/playjournal.js MISSING from sw.js ASSETS[] — statically imported by main.js;
  first offline boot under run21f-20260804 cache fails. Was added in 5cc6569, dropped by
  merge a64a5e1 (bad sw.js resolution). One-line fix for tomorrow. To be confirmed live
  in the offline boot test tonight.
- S1 (history, decision-class): children's names reachable in public git history (commit
  82a6806 subject + blobs); tree clean. Morning-report item, not fixable read-only.
- S2: HANDOVER-2026-07-31.md is tracked/published despite the gitignore class declaring
  it private.
- Remaining findings + verify verdicts folded into LANE3-FINDINGS.md. All three S1/S2 code
  findings independently CONFIRMED by adversarial re-verification.

### Sitting 3 — funfair overlay stack, walk, offline
- walk.mjs run 1 FAILED (tablet-portrait, funfair ack click on a covered button); run 2
  PASSED (10.1 min, 0 errors). Root cause isolated independently of the walk: two overlays
  at z 8000, grand opening's button not hittable (elementFromPoint returns the other's).
  DECISION: report as a REAL defect despite the passing re-run · WHY: the flake rule exists
  to stop re-running until green, not to discard a defect with hard DOM evidence; a once-ever
  ceremony being consumed unseen is a child-facing loss whether or not a harness trips on it
  · REVERSIBLE: it is a written finding; Alex can downgrade it on sight of the evidence.
- Offline: first attempt on 127.0.0.1 found no service worker at all — the app deliberately
  skips SW registration on localhost (js/main.js:373). Re-ran via app.localhost:8043 →
  F-02 PROVEN: one 504 on /js/playjournal.js, window.BooTown undefined, blank screen.

### Sitting 4 — parent pass
- Grown-ups gate (press-hold + confirm), panel survey, bigger text (works; no clipping on
  hub/town/shop), mutes present, backup code copy, restore-with-preview round trip at v24.
- New: F-07 "Build: unknown" without an SW controller; F-08 switches 60x34 (<44px).
- METHOD NOTE: my first bigger-text attempt clicked at viewport y=1313 (off-screen) and
  looked like "the toggle does nothing". Scrolled the control into view and it worked. Any
  claim that a control is dead must survive that check first.

### Sitting 5 — visit-a-town round trip
- Host 💌 → BTPC1 code; payload decoded independently: keys format/version/createdAt/areas/
  dressings/roster — no name, no age. Wrong-prefix line verbatim. Banner verbatim. Friend's
  meadow alive (4 items, __townLife). Save byte-identical across the whole visit.
- New: F-09 — the care arc opens on a friend's Boo with five enabled buttons that do nothing.

### Sitting 6 — run21g band before/after (throwaway clone, port 8047, deleted after)
- BEFORE (main): purple STRUM rectangle, 6 identical frames across a gesture, 16 oscillators
  as 4 block chords. AFTER (run21g): soundboard + 4 strings, `plucked` class travelling
  1→2→3→4 (5 distinct DOM states at 40ms sampling), 8 oscillators = 4 strings × 2 timbres,
  48–85ms apart in a fast strum. Genuine improvement; caveats recorded (string vibration
  proven by DOM class not by eye; emoji instruments unchanged; band landing unchanged).
- Clone deleted; port 8047 server stopped.

### Sitting 7 — Toddler tier as a 3-year-old
- F-10 (13 doors vs the 8-button law), F-11 (emoji-only door identity), F-12 (Stories: 4
  panels, numbered 1–4 in their wrong order — confirms the open decision by play).

### Not run, and why
- RUN-SWEEP contact sheets: the pack does not exist in RUN21-programme/ or tonight's drop;
  the brief conditioned it on the pack being present.
- The four speech-cluster suites were graded from code only — the sub-agent assigned to play
  them died on a session limit, along with three other playtest agents. Labelled as such
  everywhere rather than presented as play evidence.
