# Pick up here — after the run20b deploy (31 Jul 2026)

Live build: **`run20c-20260731`** at https://alexlock27.github.io/Boo-town/
`main` and `fix-r20-qa` are identical and both pushed. Nothing uncommitted.

---

## THE ONE THING TO DO FIRST

**A full board never completed on the final code.** Alex asked to deploy before it
finished, knowing that. Every individual fix was verified, and the last full board
(141/181) had all 40 failures accounted for — 21 flakes, ~11 pre-existing on live,
`r6p6-bounce` since fixed — but the exact shipped commit has not had a clean board.

Do this first, on a quiet machine, **6 lanes not 8** (8 produced 21 false failures from
load contention and cost about an hour):

```
python _serve.py 8000        # MUST be running first — _runall.sh does NOT start a server
./_runall.sh --workers 6
```

Then serial-re-run anything red (`node tests/<name>.mjs`) before believing it, and check
survivors against `main` in a worktree before assuming they are new.

---

## Testing lessons this session paid for in hours

1. **`_runall.sh` does not start a server.** Kill the server mid-board and all 181 suites
   "fail". Happened twice.
2. **Never edit a file while a board is in flight.** Invalidates the whole run.
3. **8 lanes is too many** on this machine. 6 is the sweet spot.
4. **A failing suite is not a bug until it fails serially AND fails differently from
   `main`.** The worktree A/B is the only trustworthy test:
   ```
   git worktree add --detach /tmp/wt-main main
   cd /tmp/wt-main && python _serve.py 8000     # tests hardcode 127.0.0.1:8000
   cd <repo> && node tests/<suite>.mjs          # repo has node_modules; test files are identical
   ```
5. **Check the build pack before "fixing" a failure.** Five suites this session were
   asserting behaviour `_programme/RUN19.md` / `RUN20.md` explicitly told us to change.
   I nearly reverted authored work twice. Grep the pack first.

---

## Known broken, all PRE-EXISTING on live, none from this work

Full detail and reproduction in `BLOCKED.md`.

### Highest value — the speech cluster (probably ONE root cause)
All four are sound-on behaviours, which is why nobody noticed. All four date from the
RUN16–18 window when TTS ownership changed (`tts.setOwnerScreen`). **Start there.**

| Suite | Symptom |
|---|---|
| `r16w3-rhymetime` | the couplet is never read aloud on demand |
| `r16w4-storyorder` | 8/16 spoken lines are not the tapped panel's caption |
| `r17x2-encouragement` | the line renders but is never spoken |
| `r16w2-blendit` | graphemes not sounded in order — this is the phonics teaching itself |

### Standalone
- `r11audit` — a short party shows an **empty** guide line (`""`) and no follow-up action
- `r17x3-feelings` — one feelings value reaches device storage (privacy assertion)
- `r6p9-perf` — a keyframe animates a layout property (jank on weak devices)
- `p8-frames` — a Dash heart reads dimmed *before* the tap that should dim it; also
  asserts a stale "nine lessons after RUN16 (11)" count
- `r18d-detective-abc` — pins `VERSION is 19`; stale test, update the pin, don't touch the game

### Never complete (400s, on both branches) — infra work, prove nothing today
`m2-full` (already on the board law's flake list), `r4p9-delights`, `r9p5-echoboos`,
and intermittently `r10p1-worldmap`, `r4p1-nav`, `r4p4-trophies`, `r18a-jokeboo-door`,
`r18b-flashboos`

---

## Alex's Toddler-tier feedback, 31 Jul — AWAITING HIS DECISION

**"Stories is too complicated for toddlers."** He is right, and the cause is specific.
The Toddler door (`js/hub.js` ~line 671) opens `storyorder` with `params.toddler`, which
does restrict it — captions off, no peek button (`storyorder.js:126,164`) — but
`playToddler()` then serves "the two shortest stories", and **the shortest story in
`data/stories.js` is 4 panels** (counts are 4,4,5,5,5,5). There is no 2- or 3-panel story
to fall back to, so a 3–4 year old is asked to sequence four wordless pictures. No
setting can soften this; the content does not exist.

Options put to Alex, HIS CALL — do not act unilaterally, this removes/changes a game:
1. Remove the Stories door from the Toddler hub (one line in `js/hub.js`, reversible).
   **Recommended.**
2. Author two 3-panel stories for the toddler tier — content work, and learning content
   ships exactly as authored, so it needs Alex to write them.
3. Leave it as a stretch game.

**"I can't see Blend It in the Toddler section." — DONE, shipped in run20c.** He had
asked for it and it was never built (RUN18E L1 grants Toddler only Sound Sorter + the two
shortest stories; the 30 Jul wave added Rhymes, not this). A "Blend" card now sits on the
Toddler hub and `params.toddler` opens level 1 with six words, no picker, no intro. The
Word Factory is untouched at Medium and Full. **CAVEAT: `r16w2-blendit` still fails — a
pre-reader now has a phonics door into a game whose sounding-out is broken. That raises
the speech cluster below from "highest value" to "do it first".**

Superseded note, kept for the reasoning: Not a bug — Blend It has never been a
Toddler game. `TODDLER_GAMES` (`js/toddler.js:41`) is Count/Colours/Shapes/Letters/
Animals/Pairs/Sizes, plus four later doors (Echo, Flash, Sounds, Rhymes). Blend It is a
Learn-group game on the main hub. If Alex wants a toddler door for it, that is new work:
`blendit.js` would need a `params.toddler` restricted mode like soundsorter/storyorder
have — and note Blend It is one of the four suites in the broken speech cluster, so fix
that first or a pre-reader gets a phonics game that never speaks.

## Open questions from the live QA pass, not yet resolved

- **Lamp "floats" above the table.** The QA agent measured an 80–100px gap at 176% scale;
  my measurements put the lamp bottom at 492px against a table spanning 435–565px, i.e.
  on the surface as authored (`SURFACE_Y.deco_table = 0.55`). Numbers disagree with eyes —
  **needs a screenshot at a few scales**, not another measurement.
- **All 60 wish chips reportedly show the same gold-star medallion.** Not investigated.
  If true, children cannot tell wishes apart in the tray — worth a look at
  `renderItem` for `kind:'wish'`.
- The reviewer's remaining SUGGESTIONS are in the review output, not actioned: the
  Bounce guard spawns no sparkle-hop when it fires, and `OUTDOOR_ONLY` includes
  `balloon` while `SKY_WISHES` does not (so the balloon chip says "sky only" for
  something not placed in the sky — the pack does authorise this).

---

## What shipped in run20b (the QA repair wave)

1. **Seated/sleeping Boos carry their own tap target.** The wrap stayed at the Boo's
   original x while only the artwork moved to the socket — measured 793px apart. Tap
   target, `z`s and thought bubble were all in empty space, so tapping the Boo you could
   see did nothing. Pre-existing; the suites hid it by seeding a Boo 2% from its bed.
   Gated on `role.socket` — `sleep` has no socket and must NOT shift (it would stack
   every dozing Boo onto the house).
2. **Nap `z`s and bubbles lifted above the bed.** A sleeper's wrap sits at `bedZ-1` so the
   duvet covers it, and a stacking context takes its children down with it. They now go
   into `ground` via `overlayOverWrap()`.
3. **Sky wishes greyed in the tray** with "sky only" + a warm guide line. `wishRefusedIndoors()`
   had been written and never called from anywhere.
4. **Bounce last-resort guard** — verifies the needed digit landed reachable, forces it if not.
   The reported unsolvable round never reproduced in 61 sampled digit rounds.
5. Grown-ups copy (one → two requests), What's New title at the Medium tier, and wish
   items no longer announce themselves as `wish_sun` to screen readers.
6. `r6p6-bounce` — two more classic-round assumptions; fails identically on the previous
   live build.

`REVIEW-SEED-19-20.txt` was rebuilt — it previously contained **no** owned dressings
despite the QA brief promising them, which blocked the entire room-dressing test.
It now carries all 18, at the Full content tier.
